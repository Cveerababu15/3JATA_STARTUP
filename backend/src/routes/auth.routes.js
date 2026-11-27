const express = require("express");
const validate = require("../middleware/validate.middleware");
const { authRateLimiter } = require("../middleware/rateLimit.middleware");
const { authenticate, requireCsrf } = require("../middleware/auth.middleware");
const authController = require("../controllers/auth.controller");
const {
  registerValidator,
  loginValidator,
  verifyEmailValidator,
  emailOnlyValidator,
  changePasswordValidator,
  resetPasswordValidator,
} = require("../validators/auth.validator");

const router = express.Router();

// Public authentication flows (rate-limited)
router.post("/register", authRateLimiter, registerValidator, validate, authController.register);
router.post(
  "/verify-email",
  authRateLimiter,
  verifyEmailValidator,
  validate,
  authController.verifyEmail
);
router.post(
  "/resend-verification",
  authRateLimiter,
  emailOnlyValidator,
  validate,
  authController.resendVerification
);
router.post("/login", authRateLimiter, loginValidator, validate, authController.login);
router.post(
  "/forgot-password",
  authRateLimiter,
  emailOnlyValidator,
  validate,
  authController.forgotPassword
);
router.post(
  "/reset-password",
  authRateLimiter,
  resetPasswordValidator,
  validate,
  authController.resetPassword
);

// Authenticated session flows
router.get("/me", authenticate, authController.getMe);
router.get("/csrf-token", authenticate, authController.getCsrfToken);
router.post("/logout", authenticate, requireCsrf, authController.logout);
router.patch(
  "/change-password",
  authenticate,
  requireCsrf,
  changePasswordValidator,
  validate,
  authController.changePassword
);

module.exports = router;
