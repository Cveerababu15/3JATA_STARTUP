const express = require("express");
const PERMISSIONS = require("../constants/permissions");
const validate = require("../middleware/validate.middleware");
const { authenticate, requireCsrf } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const productController = require("../controllers/product.controller");
const {
  variantIdParamValidator,
  updateVariantValidator,
} = require("../validators/product.validator");

const router = express.Router();

router.patch(
  "/:id",
  authenticate,
  requireCsrf,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  updateVariantValidator,
  validate,
  productController.updateVariant
);

router.delete(
  "/:id",
  authenticate,
  requireCsrf,
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  variantIdParamValidator,
  validate,
  productController.archiveVariant
);

module.exports = router;
