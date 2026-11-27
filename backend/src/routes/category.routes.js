const express = require("express");
const PERMISSIONS = require("../constants/permissions");
const validate = require("../middleware/validate.middleware");
const { authenticate, requireCsrf } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const categoryController = require("../controllers/category.controller");
const {
  categoryIdParamValidator,
  createCategoryValidator,
  updateCategoryValidator,
} = require("../validators/category.validator");

const router = express.Router();

// Management listing must come before /:slug
router.get(
  "/manage",
  authenticate,
  requirePermission(PERMISSIONS.CATEGORIES_READ),
  categoryController.listAdminCategories
);

// Public endpoints
router.get("/", categoryController.listPublicCategories);
router.get("/:slug", categoryController.getPublicCategoryBySlug);

// Protected category management
router.post(
  "/",
  authenticate,
  requireCsrf,
  requirePermission(PERMISSIONS.CATEGORIES_CREATE),
  createCategoryValidator,
  validate,
  categoryController.createCategory
);

router.patch(
  "/:id",
  authenticate,
  requireCsrf,
  requirePermission(PERMISSIONS.CATEGORIES_UPDATE),
  updateCategoryValidator,
  validate,
  categoryController.updateCategory
);

router.delete(
  "/:id",
  authenticate,
  requireCsrf,
  requirePermission(PERMISSIONS.CATEGORIES_DELETE),
  categoryIdParamValidator,
  validate,
  categoryController.archiveCategory
);

module.exports = router;
