const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const env = require("../config/env");
const httpStatus = require("../constants/httpStatus");
const ApiError = require("../utils/ApiError");
const { generateRandomToken, hashToken } = require("../utils/crypto");
const User = require("../models/User.model");
const Session = require("../models/Session.model");
const AuthToken = require("../models/AuthToken.model");
const emailService = require("./email.service");

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

function extractPermissionsFromUser(userDoc) {
  if (!userDoc || userDoc.userType !== "staff" || !userDoc.role) {
    return [];
  }
  const rawPerms = userDoc.role.permissions;
  if (!Array.isArray(rawPerms)) {
    return [];
  }
  return rawPerms
    .map((perm) => (typeof perm === "string" ? perm : perm?.code || perm?.name))
    .filter(Boolean);
}

function sanitizeUser(userDoc) {
  if (!userDoc) return null;

  const roleObj =
    userDoc.role && typeof userDoc.role === "object" && userDoc.role.slug
      ? {
          id: String(userDoc.role._id),
          name: userDoc.role.name,
          slug: userDoc.role.slug,
        }
      : userDoc.role
        ? { id: String(userDoc.role) }
        : null;

  return {
    id: String(userDoc._id),
    name: userDoc.name,
    email: userDoc.email,
    userType: userDoc.userType,
    role: roleObj,
    permissions: extractPermissionsFromUser(userDoc),
    status: userDoc.status,
    isEmailVerified: Boolean(userDoc.isEmailVerified),
    emailVerifiedAt: userDoc.emailVerifiedAt || null,
    lastLoginAt: userDoc.lastLoginAt || null,
    createdAt: userDoc.createdAt,
  };
}

async function createSingleUseToken({ userId, purpose, ttlMs }) {
  // Invalidate previous unused tokens of the same purpose for this user
  await AuthToken.updateMany(
    { user: userId, purpose, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  const rawToken = generateRandomToken(32);
  await AuthToken.create({
    user: userId,
    purpose,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + ttlMs),
  });

  return rawToken;
}

async function revokeUserSessions(userId, reason = "revoked") {
  await Session.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
}

async function findCustomerRoleId() {
  const RoleModel = mongoose.models.Role;
  if (!RoleModel) {
    return null;
  }
  const customerRole = await RoleModel.findOne({ slug: "customer" }).select("_id").lean();
  return customerRole ? customerRole._id : null;
}

async function registerCustomer({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail }).select("_id").lean();
  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const customerRoleId = await findCustomerRoleId();

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    userType: "customer",
    role: customerRoleId,
    status: "active",
    isEmailVerified: false,
  });

  const verificationToken = await createSingleUseToken({
    userId: user._id,
    purpose: "email_verification",
    ttlMs: VERIFICATION_TTL_MS,
  });

  await emailService.sendVerificationEmail({
    to: user.email,
    name: user.name,
    token: verificationToken,
  });

  return {
    user: sanitizeUser(user),
  };
}

async function verifyEmail(rawToken) {
  const now = new Date();
  const tokenDoc = await AuthToken.findOneAndUpdate(
    {
      tokenHash: hashToken(rawToken),
      purpose: "email_verification",
      usedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { usedAt: now } },
    { returnDocument: "after" }
  );

  if (!tokenDoc) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Verification token is invalid or has expired");
  }

  const user = await User.findByIdAndUpdate(
    tokenDoc.user,
    { $set: { isEmailVerified: true, emailVerifiedAt: now } },
    { returnDocument: "after" }
  );

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "Account no longer exists");
  }

  return {
    user: sanitizeUser(user),
  };
}

async function resendVerification(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (user && user.status === "active" && !user.isEmailVerified) {
    const verificationToken = await createSingleUseToken({
      userId: user._id,
      purpose: "email_verification",
      ttlMs: VERIFICATION_TTL_MS,
    });

    await emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: verificationToken,
    });
  }

  return {
    message:
      "If an unverified active account exists for that email, a verification email has been sent.",
  };
}

async function login({ email, password, userAgent = "", ipAddress = "" }) {
  const normalizedEmail = email.trim().toLowerCase();
  const query = User.findOne({ email: normalizedEmail }).select("+passwordHash");
  if (mongoose.models.Role) {
    query.populate({
      path: "role",
      populate: mongoose.models.Permission
        ? { path: "permissions", select: "code name" }
        : undefined,
    });
  }

  const user = await query;
  if (!user) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  if (user.status !== "active") {
    throw new ApiError(httpStatus.FORBIDDEN, "Your account is suspended. Please contact support.");
  }

  if (!user.isEmailVerified) {
    throw new ApiError(httpStatus.FORBIDDEN, "Please verify your email address before logging in.");
  }

  const sessionToken = generateRandomToken(32);
  const csrfToken = generateRandomToken(24);
  const expiresAt = new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000);

  await Session.create({
    user: user._id,
    tokenHash: hashToken(sessionToken),
    csrfToken,
    userAgent: String(userAgent).slice(0, 255),
    ipAddress: String(ipAddress).slice(0, 64),
    expiresAt,
  });

  user.lastLoginAt = new Date();
  await user.save();

  return {
    user: sanitizeUser(user),
    sessionToken,
    csrfToken,
    expiresAt,
  };
}

async function logout(sessionId) {
  if (!sessionId) return;
  await Session.findByIdAndUpdate(sessionId, {
    $set: { revokedAt: new Date(), revokedReason: "logout" },
  });
}

async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Current password is incorrect");
  }

  if (currentPassword === newPassword) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "New password must be different from your current password"
    );
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  user.passwordChangedAt = new Date();
  await user.save();

  // Force re-login across all sessions after password change
  await revokeUserSessions(user._id, "password_changed");
}

async function forgotPassword(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (user && user.status === "active") {
    const resetToken = await createSingleUseToken({
      userId: user._id,
      purpose: "password_reset",
      ttlMs: PASSWORD_RESET_TTL_MS,
    });

    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token: resetToken,
    });
  }

  return {
    message: "If an active account exists for that email, a password reset link has been sent.",
  };
}

async function resetPassword({ token, newPassword }) {
  const now = new Date();
  const tokenDoc = await AuthToken.findOneAndUpdate(
    {
      tokenHash: hashToken(token),
      purpose: "password_reset",
      usedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { usedAt: now } },
    { returnDocument: "after" }
  );

  if (!tokenDoc) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Password reset token is invalid or has expired");
  }

  const user = await User.findById(tokenDoc.user).select("+passwordHash");
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "Account no longer exists");
  }

  if (user.status !== "active") {
    throw new ApiError(httpStatus.FORBIDDEN, "Your account is suspended. Please contact support.");
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  user.passwordChangedAt = now;
  await user.save();

  await revokeUserSessions(user._id, "password_reset");
}

module.exports = {
  sanitizeUser,
  extractPermissionsFromUser,
  revokeUserSessions,
  registerCustomer,
  verifyEmail,
  resendVerification,
  login,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
};
