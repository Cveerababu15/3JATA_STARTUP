const { body, param } = require("express-validator");
const { PRODUCT_STATUSES } = require("../models/Product.model");
const { WEIGHT_UNITS } = require("../models/ProductVariant.model");

const FORBIDDEN_PRODUCT_FIELDS = [
  "stock",
  "quantity",
  "reservedQuantity",
  "rating",
  "reviewCount",
  "archivedAt",
  "createdBy",
  "updatedBy",
];

const FORBIDDEN_VARIANT_FIELDS = ["stock", "quantity", "reservedQuantity", "archivedAt"];

const productIdParamValidator = [
  param("id").isMongoId().withMessage("Valid product ID is required"),
];

const variantIdParamValidator = [
  param("id").isMongoId().withMessage("Valid variant ID is required"),
];

const imageIdParamValidator = [
  param("id").isMongoId().withMessage("Valid product ID is required"),
  param("imageId").isMongoId().withMessage("Valid image ID is required"),
];

const createProductValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ min: 2, max: 150 })
    .withMessage("Product name must be between 2 and 150 characters"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 180 })
    .withMessage("Slug must be between 2 and 180 characters"),
  body("shortDescription")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Short description must not exceed 300 characters"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Product description is required")
    .isLength({ max: 5000 })
    .withMessage("Description must not exceed 5000 characters"),
  body("category")
    .notEmpty()
    .withMessage("Category ID is required")
    .isMongoId()
    .withMessage("Category must be a valid ID"),
  body("subcategory")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("Subcategory must be a valid ID"),
  body("ingredients").optional().isArray().withMessage("Ingredients must be an array of strings"),
  body("tags").optional().isArray().withMessage("Tags must be an array of strings"),
  body("status")
    .optional()
    .isIn(PRODUCT_STATUSES)
    .withMessage(`Status must be one of: ${PRODUCT_STATUSES.join(", ")}`),
  body("isFeatured").optional().isBoolean().withMessage("isFeatured must be a boolean").toBoolean(),
  body("isBestseller")
    .optional()
    .isBoolean()
    .withMessage("isBestseller must be a boolean")
    .toBoolean(),
  body("variants").optional().isArray().withMessage("variants must be an array"),
  body("variants.*.sku")
    .if(body("variants").exists())
    .trim()
    .notEmpty()
    .withMessage("Each variant requires a SKU")
    .isLength({ max: 64 })
    .withMessage("SKU must not exceed 64 characters"),
  body("variants.*.weightValue")
    .if(body("variants").exists())
    .isFloat({ min: 1 })
    .withMessage("Each variant requires weightValue >= 1"),
  body("variants.*.weightUnit")
    .if(body("variants").exists())
    .optional()
    .isIn(WEIGHT_UNITS)
    .withMessage(`weightUnit must be one of: ${WEIGHT_UNITS.join(", ")}`),
  body("variants.*.pricePaise")
    .if(body("variants").exists())
    .isInt({ min: 100 })
    .withMessage("Each variant pricePaise must be an integer >= 100 (INR 1.00)"),
  body("variants.*.mrpPaise")
    .if(body("variants").exists())
    .optional({ nullable: true })
    .isInt({ min: 100 })
    .withMessage("mrpPaise must be an integer >= 100"),
  body("variants.*.stock")
    .custom((val) => val === undefined)
    .withMessage("Stock cannot be set via product creation; use /api/inventory endpoints"),
  ...FORBIDDEN_PRODUCT_FIELDS.map((field) =>
    body(field)
      .custom((val) => val === undefined)
      .withMessage(`Field "${field}" cannot be modified via product endpoints`)
  ),
];

const updateProductValidator = [
  ...productIdParamValidator,
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage("Product name must be between 2 and 150 characters"),
  body("slug")
    .optional()
    .trim()
    .isLength({ min: 2, max: 180 })
    .withMessage("Slug must be between 2 and 180 characters"),
  body("shortDescription")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Short description must not exceed 300 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("Description must be between 1 and 5000 characters"),
  body("category").optional().isMongoId().withMessage("Category must be a valid ID"),
  body("subcategory")
    .optional({ nullable: true })
    .custom((val) => val === null || /^[a-fA-F0-9]{24}$/.test(String(val)))
    .withMessage("Subcategory must be null or a valid ID"),
  body("ingredients").optional().isArray().withMessage("Ingredients must be an array"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("status")
    .optional()
    .isIn(PRODUCT_STATUSES)
    .withMessage(`Status must be one of: ${PRODUCT_STATUSES.join(", ")}`),
  body("isFeatured").optional().isBoolean().withMessage("isFeatured must be a boolean").toBoolean(),
  body("isBestseller")
    .optional()
    .isBoolean()
    .withMessage("isBestseller must be a boolean")
    .toBoolean(),
  ...FORBIDDEN_PRODUCT_FIELDS.map((field) =>
    body(field)
      .custom((val) => val === undefined)
      .withMessage(`Field "${field}" cannot be modified via product endpoints`)
  ),
];

const createVariantValidator = [
  ...productIdParamValidator,
  body("sku")
    .trim()
    .notEmpty()
    .withMessage("SKU is required")
    .isLength({ max: 64 })
    .withMessage("SKU must not exceed 64 characters"),
  body("label")
    .optional()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage("Label must not exceed 80 characters"),
  body("weightValue")
    .notEmpty()
    .withMessage("weightValue is required")
    .isFloat({ min: 1 })
    .withMessage("weightValue must be >= 1"),
  body("weightUnit")
    .optional()
    .isIn(WEIGHT_UNITS)
    .withMessage(`weightUnit must be one of: ${WEIGHT_UNITS.join(", ")}`),
  body("pricePaise")
    .notEmpty()
    .withMessage("pricePaise is required")
    .isInt({ min: 100 })
    .withMessage("pricePaise must be an integer >= 100"),
  body("mrpPaise")
    .optional({ nullable: true })
    .isInt({ min: 100 })
    .withMessage("mrpPaise must be an integer >= 100"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean").toBoolean(),
  ...FORBIDDEN_VARIANT_FIELDS.map((field) =>
    body(field)
      .custom((val) => val === undefined)
      .withMessage(`Field "${field}" cannot be modified via variant endpoints`)
  ),
];

const updateVariantValidator = [
  ...variantIdParamValidator,
  body("sku")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("SKU cannot be empty")
    .isLength({ max: 64 })
    .withMessage("SKU must not exceed 64 characters"),
  body("label")
    .optional()
    .trim()
    .isLength({ min: 1, max: 80 })
    .withMessage("Label must not exceed 80 characters"),
  body("weightValue").optional().isFloat({ min: 1 }).withMessage("weightValue must be >= 1"),
  body("weightUnit")
    .optional()
    .isIn(WEIGHT_UNITS)
    .withMessage(`weightUnit must be one of: ${WEIGHT_UNITS.join(", ")}`),
  body("pricePaise")
    .optional()
    .isInt({ min: 100 })
    .withMessage("pricePaise must be an integer >= 100"),
  body("mrpPaise")
    .optional({ nullable: true })
    .custom((val) => val === null || (Number.isInteger(Number(val)) && Number(val) >= 100))
    .withMessage("mrpPaise must be null or an integer >= 100"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean").toBoolean(),
  ...FORBIDDEN_VARIANT_FIELDS.map((field) =>
    body(field)
      .custom((val) => val === undefined)
      .withMessage(`Field "${field}" cannot be modified via variant endpoints`)
  ),
];

module.exports = {
  productIdParamValidator,
  variantIdParamValidator,
  imageIdParamValidator,
  createProductValidator,
  updateProductValidator,
  createVariantValidator,
  updateVariantValidator,
};
