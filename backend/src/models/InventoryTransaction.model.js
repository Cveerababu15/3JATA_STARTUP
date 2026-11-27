const mongoose = require("mongoose");

const ADJUSTMENT_TYPES = [
  "initial_stock",
  "stock_received",
  "manual_adjustment",
  "damaged",
  "expired",
  "return",
];

const ALL_TRANSACTION_TYPES = [...ADJUSTMENT_TYPES, "stock_sold"];

const inventoryTransactionSchema = new mongoose.Schema(
  {
    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      index: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ALL_TRANSACTION_TYPES,
      required: true,
      index: true,
    },
    quantityDelta: {
      type: Number,
      required: true,
      validate: {
        validator: (val) => Number.isInteger(val) && val !== 0,
        message: "quantityDelta must be a non-zero integer",
      },
    },
    previousQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    newQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 300,
    },
    reference: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    idempotencyKey: {
      type: String,
      default: undefined,
      trim: true,
      maxlength: 120,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

inventoryTransactionSchema.index({ variant: 1, createdAt: -1 });
inventoryTransactionSchema.index({ createdAt: -1 });
inventoryTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

const InventoryTransaction = mongoose.model("InventoryTransaction", inventoryTransactionSchema);

module.exports = InventoryTransaction;
module.exports.ADJUSTMENT_TYPES = ADJUSTMENT_TYPES;
module.exports.ALL_TRANSACTION_TYPES = ALL_TRANSACTION_TYPES;
