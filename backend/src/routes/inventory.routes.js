const express = require("express");
const PERMISSIONS = require("../constants/permissions");
const validate = require("../middleware/validate.middleware");
const { authenticate, requireCsrf } = require("../middleware/auth.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const inventoryController = require("../controllers/inventory.controller");
const {
  variantIdParamValidator,
  adjustStockValidator,
  updateThresholdValidator,
} = require("../validators/inventory.validator");

const router = express.Router();

router.use(authenticate);

// Specific paths must precede /:variantId
router.get(
  "/low-stock",
  requirePermission(PERMISSIONS.INVENTORY_READ),
  inventoryController.listLowStock
);
router.get(
  "/transactions",
  requirePermission(PERMISSIONS.INVENTORY_READ),
  inventoryController.listTransactions
);

router.get("/", requirePermission(PERMISSIONS.INVENTORY_READ), inventoryController.listInventory);
router.get(
  "/:variantId",
  requirePermission(PERMISSIONS.INVENTORY_READ),
  variantIdParamValidator,
  validate,
  inventoryController.getInventoryByVariantId
);

router.patch(
  "/:variantId/adjust",
  requireCsrf,
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  adjustStockValidator,
  validate,
  inventoryController.adjustStock
);

router.patch(
  "/:variantId/threshold",
  requireCsrf,
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  updateThresholdValidator,
  validate,
  inventoryController.updateLowStockThreshold
);

module.exports = router;
