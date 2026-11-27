const { body, param } = require("express-validator");

const categoryIdParamValidator = [
  param("id").isMongoId().withMessage("Valid category ID is required"),
];

const createCategoryValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Category name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Category name must be between 2 and 100 characters"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Slug must be between 2 and 120 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),
  body("parent")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("Parent must be a valid category ID"),
  body("displayOrder")
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage("displayOrder must be an integer between 0 and 10000")
    .toInt(),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean").toBoolean(),
];

const updateCategoryValidator = [
  ...categoryIdParamValidator,
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Category name must be between 2 and 100 characters"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Slug must be between 2 and 120 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),
  body("parent")
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === "") return true;
      return /^[a-fA-F0-9]{24}$/.test(String(value));
    })
    .withMessage("Parent must be null or a valid category ID"),
  body("displayOrder")
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage("displayOrder must be an integer between 0 and 10000")
    .toInt(),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean").toBoolean(),
];

module.exports = {
  categoryIdParamValidator,
  createCategoryValidator,
  updateCategoryValidator,
};
