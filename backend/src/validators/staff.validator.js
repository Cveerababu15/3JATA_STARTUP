const { body, param } = require("express-validator");
const { PASSWORD_REGEX, PASSWORD_MSG } = require("./auth.validator");

const staffIdParamValidator = [param("id").isMongoId().withMessage("Valid staff ID is required")];

const createStaffValidator = [
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
  body().custom((value) => {
    if (!value.roleId && !value.roleSlug) {
      throw new Error("Either roleId or roleSlug is required");
    }
    return true;
  }),
  body("roleId").optional().isMongoId().withMessage("roleId must be a valid ID"),
  body("roleSlug").optional().trim().notEmpty().withMessage("roleSlug cannot be empty"),
];

const updateStaffValidator = [
  ...staffIdParamValidator,
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
];

const assignStaffRoleValidator = [
  ...staffIdParamValidator,
  body().custom((value) => {
    if (!value.roleId && !value.roleSlug) {
      throw new Error("Either roleId or roleSlug is required");
    }
    return true;
  }),
  body("roleId").optional().isMongoId().withMessage("roleId must be a valid ID"),
  body("roleSlug").optional().trim().notEmpty().withMessage("roleSlug cannot be empty"),
];

const updateStaffStatusValidator = [
  ...staffIdParamValidator,
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["active", "suspended"])
    .withMessage('Status must be either "active" or "suspended"'),
  body("reason")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason must not exceed 500 characters"),
];

module.exports = {
  staffIdParamValidator,
  createStaffValidator,
  updateStaffValidator,
  assignStaffRoleValidator,
  updateStaffStatusValidator,
};
