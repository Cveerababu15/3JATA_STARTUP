const mongoose = require("mongoose");
const httpStatus = require("../constants/httpStatus");
const ApiError = require("../utils/ApiError");
const {
  parsePagination,
  buildPaginationMeta,
  escapeRegex,
  isValidObjectId,
} = require("../utils/queryFeatures");
const ProductVariant = require("../models/ProductVariant.model");
const Inventory = require("../models/Inventory.model");
const InventoryTransaction = require("../models/InventoryTransaction.model");
const AuditLog = require("../models/AuditLog.model");

function formatInventory(inv, variant = null) {
  const quantity = inv.quantity || 0;
  const reservedQuantity = inv.reservedQuantity || 0;
  const availableQuantity = Math.max(0, quantity - reservedQuantity);
  const lowStockThreshold = inv.lowStockThreshold ?? 10;

  const formatted = {
    id: String(inv._id),
    variantId: String(inv.variant?._id || inv.variant),
    quantity,
    reservedQuantity,
    availableQuantity,
    lowStockThreshold,
    isLowStock: availableQuantity > 0 && availableQuantity <= lowStockThreshold,
    isOutOfStock: availableQuantity === 0,
    updatedBy: inv.updatedBy ? String(inv.updatedBy) : null,
    updatedAt: inv.updatedAt,
  };

  const vDoc = variant || (inv.variant && inv.variant.sku ? inv.variant : null);
  if (vDoc) {
    formatted.variant = {
      id: String(vDoc._id),
      sku: vDoc.sku,
      label: vDoc.label,
      pricePaise: vDoc.pricePaise,
      isActive: Boolean(vDoc.isActive),
      product:
        vDoc.product && typeof vDoc.product === "object" && vDoc.product.slug
          ? {
              id: String(vDoc.product._id),
              name: vDoc.product.name,
              slug: vDoc.product.slug,
              status: vDoc.product.status,
            }
          : vDoc.product
            ? String(vDoc.product)
            : null,
    };
  }

  return formatted;
}

function formatTransaction(tx) {
  return {
    id: String(tx._id),
    inventoryId: String(tx.inventory),
    variantId: String(tx.variant?._id || tx.variant),
    variant:
      tx.variant && tx.variant.sku
        ? { id: String(tx.variant._id), sku: tx.variant.sku, label: tx.variant.label }
        : undefined,
    type: tx.type,
    quantityDelta: tx.quantityDelta,
    previousQuantity: tx.previousQuantity,
    newQuantity: tx.newQuantity,
    reason: tx.reason,
    reference: tx.reference || null,
    idempotencyKey: tx.idempotencyKey || null,
    performedBy:
      tx.performedBy && typeof tx.performedBy === "object" && tx.performedBy.email
        ? {
            id: String(tx.performedBy._id),
            name: tx.performedBy.name,
            email: tx.performedBy.email,
          }
        : String(tx.performedBy),
    createdAt: tx.createdAt,
  };
}

function validateDirection(type, quantityDelta) {
  if (["initial_stock", "stock_received", "return"].includes(type) && quantityDelta <= 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Adjustment type "${type}" requires a positive quantityDelta`
    );
  }
  if (["damaged", "expired"].includes(type) && quantityDelta >= 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Adjustment type "${type}" requires a negative quantityDelta`
    );
  }
}

async function ensureInventoryForVariant(variantId, actorId = null, session = null) {
  const variant = await ProductVariant.findById(variantId).session(session);
  if (!variant) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
  }

  const inv = await Inventory.findOneAndUpdate(
    { variant: variant._id },
    {
      $setOnInsert: {
        variant: variant._id,
        quantity: 0,
        reservedQuantity: 0,
        lowStockThreshold: 10,
        updatedBy: actorId,
      },
    },
    { upsert: true, returnDocument: "after", session }
  );

  return { variant, inventory: inv };
}

function assertIdempotencyMatch(existingTx, { variantId, type, quantityDelta, reason }) {
  if (
    String(existingTx.variant) !== String(variantId) ||
    existingTx.type !== type ||
    existingTx.quantityDelta !== quantityDelta ||
    existingTx.reason !== reason.trim()
  ) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Idempotency-Key was already used with different adjustment parameters"
    );
  }
}

async function runAtomicAdjustment({
  actor,
  variantId,
  type,
  quantityDelta,
  reason,
  reference,
  idempotencyKey,
  session,
}) {
  if (idempotencyKey) {
    const existingTx = await InventoryTransaction.findOne({ idempotencyKey }).session(session);
    if (existingTx) {
      assertIdempotencyMatch(existingTx, { variantId, type, quantityDelta, reason });
      const currentInv = await Inventory.findById(existingTx.inventory)
        .populate({ path: "variant", populate: { path: "product", select: "name slug status" } })
        .session(session);
      return {
        inventory: formatInventory(currentInv),
        transaction: formatTransaction(existingTx),
        idempotentReplay: true,
      };
    }
  }

  const { variant } = await ensureInventoryForVariant(variantId, actor.id, session);
  if (variant.archivedAt) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Cannot adjust stock for an archived variant");
  }

  const updateFilter = { variant: variant._id };
  if (quantityDelta < 0) {
    // Atomic non-negative available-stock guard
    updateFilter.$expr = {
      $gte: [{ $add: ["$quantity", quantityDelta] }, "$reservedQuantity"],
    };
  }

  const updatedInv = await Inventory.findOneAndUpdate(
    updateFilter,
    {
      $inc: { quantity: quantityDelta },
      $set: { updatedBy: actor.id },
    },
    { returnDocument: "after", session }
  );

  if (!updatedInv) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Insufficient available stock: adjustment would result in negative stock"
    );
  }

  const previousQuantity = updatedInv.quantity - quantityDelta;
  const newQuantity = updatedInv.quantity;

  const [txDoc] = await InventoryTransaction.create(
    [
      {
        inventory: updatedInv._id,
        variant: variant._id,
        type,
        quantityDelta,
        previousQuantity,
        newQuantity,
        reason: reason.trim(),
        reference: reference ? String(reference).trim() : null,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        performedBy: actor.id,
      },
    ],
    { session }
  );

  await AuditLog.create(
    [
      {
        actor: actor.id,
        actorEmail: actor.email,
        action: "inventory.adjusted",
        resourceType: "Inventory",
        resourceId: String(updatedInv._id),
        before: { quantity: previousQuantity },
        after: { quantity: newQuantity, type, quantityDelta, reason: reason.trim() },
      },
    ],
    { session }
  );

  await updatedInv.populate({
    path: "variant",
    populate: { path: "product", select: "name slug status" },
  });

  return {
    inventory: formatInventory(updatedInv),
    transaction: formatTransaction(txDoc),
    idempotentReplay: false,
  };
}

function isTransactionUnsupportedError(err) {
  return (
    err &&
    (err.code === 20 ||
      err.codeName === "IllegalOperation" ||
      (typeof err.message === "string" && /replica set/i.test(err.message)))
  );
}

async function adjustStock({
  actor,
  variantId,
  type,
  quantityDelta,
  reason,
  reference = null,
  idempotencyKey = null,
}) {
  if (!isValidObjectId(variantId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid variant ID format");
  }

  validateDirection(type, quantityDelta);
  const normalizedKey = idempotencyKey ? String(idempotencyKey).trim() : null;

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await runAtomicAdjustment({
        actor,
        variantId,
        type,
        quantityDelta,
        reason,
        reference,
        idempotencyKey: normalizedKey,
        session,
      });
    });
    return result;
  } catch (err) {
    // Handle concurrent duplicate idempotency-key race cleanly
    if (err && err.code === 11000 && normalizedKey) {
      const existingTx = await InventoryTransaction.findOne({ idempotencyKey: normalizedKey });
      if (existingTx) {
        assertIdempotencyMatch(existingTx, { variantId, type, quantityDelta, reason });
        const currentInv = await Inventory.findById(existingTx.inventory).populate({
          path: "variant",
          populate: { path: "product", select: "name slug status" },
        });
        return {
          inventory: formatInventory(currentInv),
          transaction: formatTransaction(existingTx),
          idempotentReplay: true,
        };
      }
    }

    // Require replica-set transactions so stock and movement history can never diverge
    if (isTransactionUnsupportedError(err)) {
      throw new ApiError(
        httpStatus.SERVICE_UNAVAILABLE,
        "Inventory adjustments require a MongoDB replica set for transactional stock-and-history consistency"
      );
    }

    throw err;
  } finally {
    await session.endSession();
  }
}

async function listInventory(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};

  if (query.search && String(query.search).trim()) {
    const regex = new RegExp(escapeRegex(String(query.search).trim()), "i");
    const matchingVariants = await ProductVariant.find({
      $or: [{ sku: regex }, { label: regex }],
    })
      .select("_id")
      .lean();
    filter.variant = { $in: matchingVariants.map((v) => v._id) };
  }

  if (query.lowStockOnly === "true") {
    filter.$expr = {
      $lte: [{ $subtract: ["$quantity", "$reservedQuantity"] }, "$lowStockThreshold"],
    };
  }

  const [items, total] = await Promise.all([
    Inventory.find(filter)
      .populate({
        path: "variant",
        populate: { path: "product", select: "name slug status" },
      })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Inventory.countDocuments(filter),
  ]);

  return {
    items: items.map((inv) => formatInventory(inv)),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function listLowStock(query = {}) {
  return listInventory({ ...query, lowStockOnly: "true" });
}

async function getInventoryByVariantId(variantId) {
  if (!isValidObjectId(variantId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid variant ID format");
  }

  const { inventory } = await ensureInventoryForVariant(variantId, null, null);
  await inventory.populate({
    path: "variant",
    populate: { path: "product", select: "name slug status" },
  });

  const recentTransactions = await InventoryTransaction.find({ variant: variantId })
    .populate("performedBy", "name email")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return {
    inventory: formatInventory(inventory),
    recentTransactions: recentTransactions.map(formatTransaction),
  };
}

async function updateLowStockThreshold({ actor, variantId, lowStockThreshold }) {
  if (!isValidObjectId(variantId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid variant ID format");
  }

  const { inventory } = await ensureInventoryForVariant(variantId, actor.id, null);
  const previous = inventory.lowStockThreshold;
  inventory.lowStockThreshold = lowStockThreshold;
  inventory.updatedBy = actor.id;
  await inventory.save();
  await inventory.populate({
    path: "variant",
    populate: { path: "product", select: "name slug status" },
  });

  await AuditLog.create({
    actor: actor.id,
    actorEmail: actor.email,
    action: "inventory.threshold_updated",
    resourceType: "Inventory",
    resourceId: String(inventory._id),
    before: { lowStockThreshold: previous },
    after: { lowStockThreshold },
  });

  return formatInventory(inventory);
}

async function listTransactions(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};

  if (query.variantId && isValidObjectId(query.variantId)) {
    filter.variant = query.variantId;
  }
  if (query.type && typeof query.type === "string") {
    filter.type = query.type.trim();
  }
  if (query.performedBy && isValidObjectId(query.performedBy)) {
    filter.performedBy = query.performedBy;
  }

  const [items, total] = await Promise.all([
    InventoryTransaction.find(filter)
      .populate("variant", "sku label")
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InventoryTransaction.countDocuments(filter),
  ]);

  return {
    items: items.map(formatTransaction),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

module.exports = {
  adjustStock,
  listInventory,
  listLowStock,
  getInventoryByVariantId,
  updateLowStockThreshold,
  listTransactions,
};
