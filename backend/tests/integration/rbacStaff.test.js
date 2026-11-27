const bcrypt = require("bcryptjs");
const request = require("supertest");
const app = require("../../src/app");
const ROLES = require("../../src/constants/roles");
const Role = require("../../src/models/Role.model");
const User = require("../../src/models/User.model");
const AuditLog = require("../../src/models/AuditLog.model");
const { seedRolesAndPermissions } = require("../../src/utils/seedRoles");
const {
  startTestDatabase,
  clearTestDatabase,
  stopTestDatabase,
} = require("../helpers/mongoMemory");

async function createVerifiedUser({ name, email, password, userType, roleSlug }) {
  const role = await Role.findOne({ slug: roleSlug });
  const passwordHash = await bcrypt.hash(password, 4);
  return User.create({
    name,
    email,
    passwordHash,
    userType,
    role: role._id,
    status: "active",
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
  });
}

describe("B1.4 Roles, Permissions, and Staff (Integration)", () => {
  beforeAll(async () => {
    await startTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    await seedRolesAndPermissions();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it("seeds roles idempotently with zero permissions on customer role", async () => {
    const first = await seedRolesAndPermissions();
    const second = await seedRolesAndPermissions();

    expect(first.rolesCount).toBe(second.rolesCount);
    const totalRoles = await Role.countDocuments({});
    expect(totalRoles).toBe(13);

    const customerRole = await Role.findOne({ slug: ROLES.CUSTOMER });
    expect(customerRole.isStaffRole).toBe(false);
    expect(customerRole.permissions).toHaveLength(0);
  });

  it("blocks customers and insufficient staff permissions from admin endpoints", async () => {
    await createVerifiedUser({
      name: "Customer One",
      email: "cust@example.com",
      password: "Password123",
      userType: "customer",
      roleSlug: ROLES.CUSTOMER,
    });

    await createVerifiedUser({
      name: "Product Manager",
      email: "pm@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.PRODUCT_MANAGER,
    });

    const custAgent = request.agent(app);
    await custAgent.post("/api/auth/login").send({
      email: "cust@example.com",
      password: "Password123",
    });

    const custRolesRes = await custAgent.get("/api/admin/roles");
    expect(custRolesRes.status).toBe(403);

    const custStaffRes = await custAgent.get("/api/admin/staff");
    expect(custStaffRes.status).toBe(403);

    const pmAgent = request.agent(app);
    const pmLogin = await pmAgent.post("/api/auth/login").send({
      email: "pm@example.com",
      password: "Password123",
    });
    expect(pmLogin.status).toBe(200);

    // Product manager lacks staff.create and roles.read
    const pmStaffRes = await pmAgent
      .post("/api/admin/staff")
      .set("X-CSRF-Token", pmLogin.body.data.csrfToken)
      .send({
        name: "Unauthorized Staff",
        email: "unauth@example.com",
        password: "Password123",
        roleSlug: ROLES.ANALYST,
      });
    expect(pmStaffRes.status).toBe(403);
  });

  it("allows owner to provision staff, validates roles, revokes sessions on role change and suspension, and protects last active owner", async () => {
    await createVerifiedUser({
      name: "Founder Owner",
      email: "owner@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.SUPER_ADMIN,
    });

    const ownerAgent = request.agent(app);
    const ownerLogin = await ownerAgent.post("/api/auth/login").send({
      email: "owner@example.com",
      password: "Password123",
    });
    const ownerCsrf = ownerLogin.body.data.csrfToken;
    const ownerId = ownerLogin.body.data.user.id;

    // Cannot assign customer role to staff
    const invalidRoleRes = await ownerAgent
      .post("/api/admin/staff")
      .set("X-CSRF-Token", ownerCsrf)
      .send({
        name: "Bad Staff",
        email: "badstaff@example.com",
        password: "Password123",
        roleSlug: ROLES.CUSTOMER,
      });
    expect(invalidRoleRes.status).toBe(400);

    // Owner inspects roles, permissions, and staff list/detail/update
    const rolesRes = await ownerAgent.get("/api/admin/roles");
    expect(rolesRes.status).toBe(200);
    expect(rolesRes.body.data.roles).toHaveLength(13);
    const custRole = rolesRes.body.data.roles.find((r) => r.slug === ROLES.CUSTOMER);
    expect(custRole.permissions).toEqual([]);

    const permsRes = await ownerAgent.get("/api/admin/permissions");
    expect(permsRes.status).toBe(200);
    expect(permsRes.body.data.permissions.length).toBeGreaterThan(20);

    // Create Inventory Manager staff
    const createRes = await ownerAgent
      .post("/api/admin/staff")
      .set("X-CSRF-Token", ownerCsrf)
      .send({
        name: "Devika Inventory",
        email: "devika@example.com",
        password: "Password123",
        roleSlug: ROLES.INVENTORY_MANAGER,
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.staff.passwordHash).toBeUndefined();
    expect(createRes.body.data.staff.role.slug).toBe(ROLES.INVENTORY_MANAGER);
    const staffId = createRes.body.data.staff.id;

    const listStaffRes = await ownerAgent.get("/api/admin/staff?search=Devika&status=active");
    expect(listStaffRes.status).toBe(200);
    expect(listStaffRes.body.data.items).toHaveLength(1);

    const getStaffRes = await ownerAgent.get(`/api/admin/staff/${staffId}`);
    expect(getStaffRes.status).toBe(200);
    expect(getStaffRes.body.data.staff.email).toBe("devika@example.com");

    const updateStaffRes = await ownerAgent
      .patch(`/api/admin/staff/${staffId}`)
      .set("X-CSRF-Token", ownerCsrf)
      .send({ name: "Devika Senior Inventory" });
    expect(updateStaffRes.status).toBe(200);
    expect(updateStaffRes.body.data.staff.name).toBe("Devika Senior Inventory");

    // Staff logs in
    const staffAgent = request.agent(app);
    const staffLogin = await staffAgent.post("/api/auth/login").send({
      email: "devika@example.com",
      password: "Password123",
    });
    expect(staffLogin.status).toBe(200);
    expect(staffLogin.body.data.user.permissions).toContain("inventory.adjust");

    // Owner changes staff role -> revokes active staff sessions
    const roleChangeRes = await ownerAgent
      .patch(`/api/admin/staff/${staffId}/role`)
      .set("X-CSRF-Token", ownerCsrf)
      .send({ roleSlug: ROLES.ANALYST });
    expect(roleChangeRes.status).toBe(200);
    expect(roleChangeRes.body.data.staff.role.slug).toBe(ROLES.ANALYST);

    const staffMeAfterRoleChange = await staffAgent.get("/api/auth/me");
    expect(staffMeAfterRoleChange.status).toBe(401);

    // Staff logs in again with updated role
    const staffRelogin = await staffAgent.post("/api/auth/login").send({
      email: "devika@example.com",
      password: "Password123",
    });
    expect(staffRelogin.status).toBe(200);
    expect(staffRelogin.body.data.user.permissions).toContain("analytics.read");
    expect(staffRelogin.body.data.user.permissions).not.toContain("inventory.adjust");

    // Owner suspends staff -> revokes active staff session
    const suspendRes = await ownerAgent
      .patch(`/api/admin/staff/${staffId}/status`)
      .set("X-CSRF-Token", ownerCsrf)
      .send({ status: "suspended", reason: "Offboarded" });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.staff.status).toBe("suspended");

    const staffMeAfterSuspend = await staffAgent.get("/api/auth/me");
    expect(staffMeAfterSuspend.status).toBe(401);

    // Suspended staff cannot log back in
    const suspendedLogin = await staffAgent.post("/api/auth/login").send({
      email: "devika@example.com",
      password: "Password123",
    });
    expect(suspendedLogin.status).toBe(403);

    // Owner cannot suspend themselves
    const selfSuspend = await ownerAgent
      .patch(`/api/admin/staff/${ownerId}/status`)
      .set("X-CSRF-Token", ownerCsrf)
      .send({ status: "suspended" });
    expect(selfSuspend.status).toBe(400);

    // Reactivate staff succeeds
    const reactivateRes = await ownerAgent
      .patch(`/api/admin/staff/${staffId}/status`)
      .set("X-CSRF-Token", ownerCsrf)
      .send({ status: "active" });
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.staff.status).toBe("active");

    // Cannot demote or suspend last active owner
    const demoteOwnerRes = await ownerAgent
      .patch(`/api/admin/staff/${ownerId}/role`)
      .set("X-CSRF-Token", ownerCsrf)
      .send({ roleSlug: ROLES.ANALYST });
    expect(demoteOwnerRes.status).toBe(400);

    const suspendOwnerRes = await ownerAgent
      .patch(`/api/admin/staff/${ownerId}/status`)
      .set("X-CSRF-Token", ownerCsrf)
      .send({ status: "suspended" });
    expect(suspendOwnerRes.status).toBe(400);

    // Audit trail endpoint returns recorded sensitive changes
    const auditLogsRes = await ownerAgent.get("/api/admin/audit-logs?limit=20");
    expect(auditLogsRes.status).toBe(200);
    const actions = auditLogsRes.body.data.items.map((a) => a.action);
    expect(actions).toContain("staff.created");
    expect(actions).toContain("staff.updated");
    expect(actions).toContain("staff.role_updated");
    expect(actions).toContain("staff.status_updated");

    const auditDocs = await AuditLog.countDocuments({});
    expect(auditDocs).toBeGreaterThanOrEqual(4);
  });
});
