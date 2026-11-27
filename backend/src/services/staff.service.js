const bcrypt = require("bcryptjs");
const env = require("../config/env");
const httpStatus = require("../constants/httpStatus");
const ROLES = require("../constants/roles");
const ApiError = require("../utils/ApiError");
const {
  parsePagination,
  buildPaginationMeta,
  parseSort,
  escapeRegex,
  isValidObjectId,
} = require("../utils/queryFeatures");
const Role = require("../models/Role.model");
const Permission = require("../models/Permission.model");
const User = require("../models/User.model");
const AuditLog = require("../models/AuditLog.model");
const { revokeUserSessions } = require("./auth.service");
const { recordAudit } = require("./audit.service");

const STAFF_SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 },
};

function formatStaffSummary(userDoc) {
  return {
    id: String(userDoc._id),
    name: userDoc.name,
    email: userDoc.email,
    userType: userDoc.userType,
    status: userDoc.status,
    isEmailVerified: Boolean(userDoc.isEmailVerified),
    role: userDoc.role
      ? {
          id: String(userDoc.role._id),
          slug: userDoc.role.slug,
          name: userDoc.role.name,
        }
      : null,
    lastLoginAt: userDoc.lastLoginAt || null,
    suspendedAt: userDoc.suspendedAt || null,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
}

async function resolveAssignableStaffRole({ roleId, roleSlug }) {
  let role = null;
  if (roleId) {
    if (!isValidObjectId(roleId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid roleId format");
    }
    role = await Role.findById(roleId);
  } else if (roleSlug) {
    role = await Role.findOne({ slug: String(roleSlug).trim().toLowerCase() });
  }

  if (!role || !role.isActive) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Referenced role does not exist or is inactive");
  }

  if (!role.isStaffRole || role.slug === ROLES.CUSTOMER) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Cannot assign customer role to a staff account");
  }

  return role;
}

function assertCanManageSuperAdmin(actor, targetRoleSlug) {
  const actorRoleSlug = actor?.role?.slug;
  if (targetRoleSlug === ROLES.SUPER_ADMIN && actorRoleSlug !== ROLES.SUPER_ADMIN) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only an active owner (super_admin) can assign or modify the super_admin role"
    );
  }
}

async function assertNotLastActiveOwner(targetUser) {
  const currentRoleSlug = targetUser.role?.slug;
  if (currentRoleSlug !== ROLES.SUPER_ADMIN || targetUser.status !== "active") {
    return;
  }

  const activeOwnerCount = await User.countDocuments({
    userType: "staff",
    role: targetUser.role._id,
    status: "active",
  });

  if (activeOwnerCount <= 1) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Operation rejected: cannot remove or suspend the last active owner"
    );
  }
}

async function listRoles() {
  const roles = await Role.find({ isActive: true })
    .populate("permissions", "code resource action description")
    .sort({ isStaffRole: 1, name: 1 })
    .lean();

  return roles.map((role) => ({
    id: String(role._id),
    slug: role.slug,
    name: role.name,
    description: role.description,
    isStaffRole: role.isStaffRole,
    permissions: (role.permissions || []).map((p) => p.code),
  }));
}

async function listPermissions() {
  const permissions = await Permission.find({})
    .select("code resource action description")
    .sort({ code: 1 })
    .lean();

  return permissions.map((p) => ({
    id: String(p._id),
    code: p.code,
    resource: p.resource,
    action: p.action,
    description: p.description,
  }));
}

async function createStaff({ actor, name, email, password, roleId, roleSlug }) {
  const targetRole = await resolveAssignableStaffRole({ roleId, roleSlug });
  assertCanManageSuperAdmin(actor, targetRole.slug);

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail }).select("_id").lean();
  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const staff = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    userType: "staff",
    role: targetRole._id,
    status: "active",
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    createdBy: actor.id,
  });

  await staff.populate("role", "slug name");

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "staff.created",
    resourceType: "User",
    resourceId: staff._id,
    after: {
      name: staff.name,
      email: staff.email,
      role: targetRole.slug,
      status: staff.status,
    },
  });

  return formatStaffSummary(staff);
}

async function listStaff(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const sort = parseSort(query.sort, STAFF_SORT_MAP, STAFF_SORT_MAP.newest);

  const filter = { userType: "staff" };

  if (query.status && ["active", "suspended"].includes(query.status)) {
    filter.status = query.status;
  }

  if (query.roleId && isValidObjectId(query.roleId)) {
    filter.role = query.roleId;
  }

  if (query.search && String(query.search).trim()) {
    const regex = new RegExp(escapeRegex(String(query.search).trim()), "i");
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).populate("role", "slug name").sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map(formatStaffSummary),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function getStaffById(staffId) {
  if (!isValidObjectId(staffId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid staff ID format");
  }

  const staff = await User.findOne({ _id: staffId, userType: "staff" }).populate(
    "role",
    "slug name"
  );
  if (!staff) {
    throw new ApiError(httpStatus.NOT_FOUND, "Staff account not found");
  }

  return formatStaffSummary(staff);
}

async function updateStaff({ actor, staffId, name }) {
  if (!isValidObjectId(staffId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid staff ID format");
  }

  const staff = await User.findOne({ _id: staffId, userType: "staff" }).populate(
    "role",
    "slug name"
  );
  if (!staff) {
    throw new ApiError(httpStatus.NOT_FOUND, "Staff account not found");
  }

  assertCanManageSuperAdmin(actor, staff.role?.slug);

  const before = { name: staff.name };
  if (name !== undefined) {
    staff.name = name.trim();
  }
  await staff.save();

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "staff.updated",
    resourceType: "User",
    resourceId: staff._id,
    before,
    after: { name: staff.name },
  });

  return formatStaffSummary(staff);
}

async function assignStaffRole({ actor, staffId, roleId, roleSlug }) {
  if (!isValidObjectId(staffId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid staff ID format");
  }

  const staff = await User.findOne({ _id: staffId, userType: "staff" }).populate(
    "role",
    "slug name"
  );
  if (!staff) {
    throw new ApiError(httpStatus.NOT_FOUND, "Staff account not found");
  }

  const newRole = await resolveAssignableStaffRole({ roleId, roleSlug });
  assertCanManageSuperAdmin(actor, staff.role?.slug);
  assertCanManageSuperAdmin(actor, newRole.slug);

  if (String(staff.role?._id) === String(newRole._id)) {
    return formatStaffSummary(staff);
  }

  if (newRole.slug !== ROLES.SUPER_ADMIN) {
    await assertNotLastActiveOwner(staff);
  }

  const previousRoleSlug = staff.role?.slug || null;
  staff.role = newRole._id;
  await staff.save();
  await staff.populate("role", "slug name");

  // Force re-login so updated permissions apply cleanly and stale sessions cannot persist
  await revokeUserSessions(staff._id, "role_changed");

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "staff.role_updated",
    resourceType: "User",
    resourceId: staff._id,
    before: { role: previousRoleSlug },
    after: { role: newRole.slug },
  });

  return formatStaffSummary(staff);
}

async function updateStaffStatus({ actor, staffId, status, reason = null }) {
  if (!isValidObjectId(staffId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid staff ID format");
  }

  const staff = await User.findOne({ _id: staffId, userType: "staff" }).populate(
    "role",
    "slug name"
  );
  if (!staff) {
    throw new ApiError(httpStatus.NOT_FOUND, "Staff account not found");
  }

  if (String(actor.id) === String(staff._id) && status === "suspended") {
    throw new ApiError(httpStatus.BAD_REQUEST, "You cannot suspend your own account");
  }

  assertCanManageSuperAdmin(actor, staff.role?.slug);

  if (status === "suspended") {
    await assertNotLastActiveOwner(staff);
  }

  const previousStatus = staff.status;
  staff.status = status;
  staff.suspendedAt = status === "suspended" ? new Date() : null;
  staff.suspendedReason = status === "suspended" && reason ? String(reason).trim() : null;
  await staff.save();

  if (status === "suspended") {
    await revokeUserSessions(staff._id, "user_suspended");
  }

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "staff.status_updated",
    resourceType: "User",
    resourceId: staff._id,
    before: { status: previousStatus },
    after: { status: staff.status, reason: staff.suspendedReason },
  });

  return formatStaffSummary(staff);
}

async function listAuditLogs(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};

  if (query.action && typeof query.action === "string") {
    filter.action = query.action.trim();
  }
  if (query.resourceType && typeof query.resourceType === "string") {
    filter.resourceType = query.resourceType.trim();
  }
  if (query.actorId && isValidObjectId(query.actorId)) {
    filter.actor = query.actorId;
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => ({
      id: String(item._id),
      actor: item.actor ? String(item.actor) : null,
      actorEmail: item.actorEmail,
      action: item.action,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      before: item.before,
      after: item.after,
      metadata: item.metadata,
      createdAt: item.createdAt,
    })),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

module.exports = {
  listRoles,
  listPermissions,
  createStaff,
  listStaff,
  getStaffById,
  updateStaff,
  assignStaffRole,
  updateStaffStatus,
  listAuditLogs,
};
