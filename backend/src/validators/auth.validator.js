const { body } = require("express-validator");

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;
const PASSWORD_MSG =
  "Password must be 8-72 characters and include uppercase, lowercase, and a number";

const DISALLOWED_REGISTRATION_FIELDS = [
  "role",
  "userType",
  "status",
  "isEmailVerified",
  "permissions",
  "createdBy",
];

const registerValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .matches(PASSWORD_REGEX)
    .withMessage(PASSWORD_MSG),
  ...DISALLOWED_REGISTRATION_FIELDS.map((field) =>
    body(field)
      .custom((value) => value === undefined)
      .withMessage(`Field "${field}" is not allowed during public registration`)
  ),
];

const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const verifyEmailValidator = [
  body("token")
    .trim()
    .notEmpty()
    .withMessage("Verification token is required")
    .isLength({ min: 32, max: 128 })
    .withMessage("Invalid verification token format"),
];

const emailOnlyValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
];

const changePasswordValidator = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .matches(PASSWORD_REGEX)
    .withMessage(PASSWORD_MSG),
];

const resetPasswordValidator = [
  body("token")
    .trim()
    .notEmpty()
    .withMessage("Reset token is required")
    .isLength({ min: 32, max: 128 })
    .withMessage("Invalid reset token format"),
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .matches(PASSWORD_REGEX)
    .withMessage(PASSWORD_MSG),
];

module.exports = {
  PASSWORD_REGEX,
  PASSWORD_MSG,
  registerValidator,
  loginValidator,
  verifyEmailValidator,
  emailOnlyValidator,
  changePasswordValidator,
  resetPasswordValidator,
};
