const express = require("express");
const PERMISSIONS = require("../constants/permissions");
const validate = require("../middleware/validate.middleware");
const { authenticate, requireCsrf } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const { uploadSingleProductImage } = require("../middleware/upload.middleware");
const productController = require("../controllers/product.controller");
const {
  productIdParamValidator,
  imageIdParamValidator,
  createProductValidator,
  updateProductValidator,
  createVariantValidator,
} = require("../validators/product.validator");

const router = express.Router();

// Management reads (must be mounted before /:slug)
router.get(
  "/manage",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_READ),
  productController.listAdminProducts
);
router.get(
  "/manage/:id",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_READ),
  productIdParamValidator,
  validate,
  productController.getAdminProductById
);

// Public catalogue reads (active products only)
router.get("/", productController.listPublicProducts);
router.get("/:slug", productController.getPublicProductBySlug);

// Protected product & variant management
router.post(
  "/",
  authenticate,
  requireCsrf,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  createProductValidator,
  validate,
  productController.createProduct
);

router.patch(
  "/:id",
  authenticate,
  requireCsrf,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  updateProductValidator,
  validate,
  productController.updateProduct
);

router.delete(
  "/:id",
  authenticate,
  requireCsrf,
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  productIdParamValidator,
  validate,
  productController.archiveProduct
);

router.post(
  "/:id/variants",
  authenticate,
  requireCsrf,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  createVariantValidator,
  validate,
  productController.addVariant
);

router.post(
  "/:id/images",
  authenticate,
  requireCsrf,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  productIdParamValidator,
  validate,
  uploadSingleProductImage,
  productController.uploadProductImage
);

router.delete(
  "/:id/images/:imageId",
  authenticate,
  requireCsrf,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  imageIdParamValidator,
  validate,
  productController.deleteProductImage
);

module.exports = router;
