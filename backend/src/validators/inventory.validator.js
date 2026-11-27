const { body, param } = require("express-validator");
const { ADJUSTMENT_TYPES } = require("../models/InventoryTransaction.model");

const variantIdParamValidator = [
  param("variantId").isMongoId().withMessage("Valid variantId is required"),
];

const adjustStockValidator = [
  ...variantIdParamValidator,
  body("type")
    .notEmpty()
    .withMessage("Adjustment type is required")
    .isIn(ADJUSTMENT_TYPES)
    .withMessage(`type must be one of: ${ADJUSTMENT_TYPES.join(", ")}`),
  body("quantityDelta")
    .notEmpty()
    .withMessage("quantityDelta is required")
    .isInt()
    .withMessage("quantityDelta must be an integer")
    .custom((val) => Number(val) !== 0)
    .withMessage("quantityDelta must be non-zero")
    .toInt(),
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("A reason is required for stock adjustments")
    .isLength({ min: 3, max: 300 })
    .withMessage("Reason must be between 3 and 300 characters"),
  body("reference")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("Reference must not exceed 120 characters"),
  body("idempotencyKey")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 4, max: 120 })
    .withMessage("idempotencyKey must be between 4 and 120 characters"),
];

const updateThresholdValidator = [
  ...variantIdParamValidator,
  body("lowStockThreshold")
    .notEmpty()
    .withMessage("lowStockThreshold is required")
    .isInt({ min: 0, max: 100000 })
    .withMessage("lowStockThreshold must be a non-negative integer")
    .toInt(),
];

module.exports = {
  variantIdParamValidator,
  adjustStockValidator,
  updateThresholdValidator,
};
