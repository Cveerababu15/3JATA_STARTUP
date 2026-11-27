const httpStatus = require("../constants/httpStatus");
const apiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const inventoryService = require("../services/inventory.service");

const listInventory = asyncHandler(async (req, res) => {
  const { items, pagination } = await inventoryService.listInventory(req.query);
  return apiResponse.paginated(res, "Inventory fetched successfully", items, pagination);
});

const listLowStock = asyncHandler(async (req, res) => {
  const { items, pagination } = await inventoryService.listLowStock(req.query);
  return apiResponse.paginated(res, "Low-stock inventory fetched successfully", items, pagination);
});

const listTransactions = asyncHandler(async (req, res) => {
  const { items, pagination } = await inventoryService.listTransactions(req.query);
  return apiResponse.paginated(
    res,
    "Inventory transactions fetched successfully",
    items,
    pagination
  );
});

const getInventoryByVariantId = asyncHandler(async (req, res) => {
  const result = await inventoryService.getInventoryByVariantId(req.params.variantId);
  return apiResponse.success(res, "Variant inventory fetched successfully", result, httpStatus.OK);
});

const adjustStock = asyncHandler(async (req, res) => {
  const idempotencyKey = req.get("Idempotency-Key") || req.body.idempotencyKey || null;
  const result = await inventoryService.adjustStock({
    actor: req.user,
    variantId: req.params.variantId,
    type: req.body.type,
    quantityDelta: req.body.quantityDelta,
    reason: req.body.reason,
    reference: req.body.reference || null,
    idempotencyKey,
  });

  const message = result.idempotentReplay
    ? "Stock adjustment replayed idempotently"
    : "Stock adjusted successfully";

  return apiResponse.success(res, message, result, httpStatus.OK);
});

const updateLowStockThreshold = asyncHandler(async (req, res) => {
  const inventory = await inventoryService.updateLowStockThreshold({
    actor: req.user,
    variantId: req.params.variantId,
    lowStockThreshold: req.body.lowStockThreshold,
  });

  return apiResponse.success(
    res,
    "Low-stock threshold updated successfully",
    { inventory },
    httpStatus.OK
  );
});

module.exports = {
  listInventory,
  listLowStock,
  listTransactions,
  getInventoryByVariantId,
  adjustStock,
  updateLowStockThreshold,
};
