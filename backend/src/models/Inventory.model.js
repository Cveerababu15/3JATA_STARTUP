const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      unique: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "quantity must be an integer",
      },
    },
    reservedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "reservedQuantity must be an integer",
      },
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 10,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "lowStockThreshold must be an integer",
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

inventorySchema.index({ quantity: 1, lowStockThreshold: 1 });

const Inventory = mongoose.model("Inventory", inventorySchema);

module.exports = Inventory;
