const mongoose = require("mongoose");
const env = require("../config/env");
const httpStatus = require("../constants/httpStatus");
const messages = require("../constants/messages");
const ApiError = require("../utils/ApiError");
const { hashToken, safeTimingEqual } = require("../utils/crypto");
const Session = require("../models/Session.model");
const User = require("../models/User.model");
const { sanitizeUser, extractPermissionsFromUser } = require("../services/auth.service");

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const authenticate = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[env.sessionCookieName];
    if (!rawToken) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, messages.UNAUTHORIZED));
    }

    const session = await Session.findOne({
      tokenHash: hashToken(rawToken),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, "Session expired or revoked"));
    }

    const userQuery = User.findById(session.user);
    if (mongoose.models.Role) {
      userQuery.populate({
        path: "role",
        populate: mongoose.models.Permission
          ? { path: "permissions", select: "code name" }
          : undefined,
      });
    }

    const user = await userQuery;
    if (!user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, messages.UNAUTHORIZED));
    }

    if (user.status !== "active") {
      await Session.updateMany(
        { user: user._id, revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: "user_suspended" } }
      );
      return next(new ApiError(httpStatus.FORBIDDEN, "Your account is suspended. Access denied."));
    }

    req.session = session;
    req.userDoc = user;
    req.user = sanitizeUser(user);
    req.permissions = new Set(extractPermissionsFromUser(user));

    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Verifies the double-submit CSRF token + session binding for authenticated write requests.
 */
const requireCsrf = (req, res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) {
    return next();
  }

  if (!req.session) {
    return next(new ApiError(httpStatus.UNAUTHORIZED, messages.UNAUTHORIZED));
  }

  const headerToken = req.get("X-CSRF-Token");
  const cookieToken = req.cookies?.[env.csrfCookieName];
  const sessionToken = req.session.csrfToken;

  const valid =
    headerToken &&
    cookieToken &&
    sessionToken &&
    safeTimingEqual(headerToken, cookieToken) &&
    safeTimingEqual(headerToken, sessionToken);

  if (!valid) {
    return next(new ApiError(httpStatus.FORBIDDEN, "Invalid or missing CSRF token"));
  }

  return next();
};

module.exports = {
  authenticate,
  requireCsrf,
};
