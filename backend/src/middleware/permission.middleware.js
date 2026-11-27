const httpStatus = require("../constants/httpStatus");
const messages = require("../constants/messages");
const ApiError = require("../utils/ApiError");

const requireStaff = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(httpStatus.UNAUTHORIZED, messages.UNAUTHORIZED));
  }
  if (req.user.userType !== "staff") {
    return next(new ApiError(httpStatus.FORBIDDEN, messages.FORBIDDEN));
  }
  return next();
};

const requirePermission = (permissionCode) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, messages.UNAUTHORIZED));
    }
    if (req.user.userType !== "staff") {
      return next(new ApiError(httpStatus.FORBIDDEN, messages.FORBIDDEN));
    }
    if (!req.permissions || !req.permissions.has(permissionCode)) {
      return next(new ApiError(httpStatus.FORBIDDEN, messages.FORBIDDEN));
    }
    return next();
  };
};

const requireAnyPermission = (permissionCodes = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, messages.UNAUTHORIZED));
    }
    if (req.user.userType !== "staff") {
      return next(new ApiError(httpStatus.FORBIDDEN, messages.FORBIDDEN));
    }
    const allowed = permissionCodes.some((code) => req.permissions?.has(code));
    if (!allowed) {
      return next(new ApiError(httpStatus.FORBIDDEN, messages.FORBIDDEN));
    }
    return next();
  };
};

module.exports = {
  requireStaff,
  requirePermission,
  requireAnyPermission,
};
