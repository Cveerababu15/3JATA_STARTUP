const env = require("../config/env");
const httpStatus = require("../constants/httpStatus");
const apiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const authService = require("../services/auth.service");

function setSessionCookies(res, { sessionToken, csrfToken, expiresAt }) {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
  const baseCookieOptions = {
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: "/",
    maxAge,
  };

  res.cookie(env.sessionCookieName, sessionToken, {
    ...baseCookieOptions,
    httpOnly: true,
  });

  res.cookie(env.csrfCookieName, csrfToken, {
    ...baseCookieOptions,
    httpOnly: false,
  });
}

function clearSessionCookies(res) {
  const clearOptions = {
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: "/",
  };
  res.clearCookie(env.sessionCookieName, { ...clearOptions, httpOnly: true });
  res.clearCookie(env.csrfCookieName, { ...clearOptions, httpOnly: false });
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.registerCustomer({ name, email, password });

  return apiResponse.success(
    res,
    "Registration successful. Please check your email to verify your account.",
    result,
    httpStatus.CREATED
  );
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const result = await authService.verifyEmail(token);

  return apiResponse.success(res, "Email verified successfully", result, httpStatus.OK);
});

const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.resendVerification(email);

  return apiResponse.success(res, result.message, null, httpStatus.OK);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({
    email,
    password,
    userAgent: req.get("User-Agent") || "",
    ipAddress: req.ip || "",
  });

  setSessionCookies(res, result);

  return apiResponse.success(
    res,
    "Login successful",
    {
      user: result.user,
      csrfToken: result.csrfToken,
      expiresAt: result.expiresAt,
    },
    httpStatus.OK
  );
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.session?._id);
  clearSessionCookies(res);

  return apiResponse.success(res, "Logout successful", null, httpStatus.OK);
});

const getMe = asyncHandler(async (req, res) => {
  return apiResponse.success(res, "Authenticated user fetched", { user: req.user }, httpStatus.OK);
});

const getCsrfToken = asyncHandler(async (req, res) => {
  return apiResponse.success(
    res,
    "CSRF token fetched",
    { csrfToken: req.session.csrfToken },
    httpStatus.OK
  );
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword({
    userId: req.user.id,
    currentPassword,
    newPassword,
  });

  clearSessionCookies(res);

  return apiResponse.success(
    res,
    "Password changed successfully. Please log in again.",
    null,
    httpStatus.OK
  );
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const result = await authService.forgotPassword(email);

  return apiResponse.success(res, result.message, null, httpStatus.OK);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  await authService.resetPassword({ token, newPassword });

  return apiResponse.success(
    res,
    "Password reset successful. You can now log in with your new password.",
    null,
    httpStatus.OK
  );
});

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  getMe,
  getCsrfToken,
  changePassword,
  forgotPassword,
  resetPassword,
};
