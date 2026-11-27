const mongoose = require("mongoose");

const WEIGHT_UNITS = ["g", "kg", "ml", "l"];

const productVariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 64,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    weightValue: {
      type: Number,
      required: true,
      min: 1,
    },
    weightUnit: {
      type: String,
      enum: WEIGHT_UNITS,
      default: "g",
      required: true,
    },
    // Canonical integer currency in paise (e.g., 24900 = INR 249.00) to avoid floating-point errors
    pricePaise: {
      type: Number,
      required: true,
      min: 100,
      validate: {
        validator: Number.isInteger,
        message: "pricePaise must be an integer",
      },
    },
    mrpPaise: {
      type: Number,
      default: null,
      validate: {
        validator: (val) =>
          val === null || val === undefined || (Number.isInteger(val) && val >= 100),
        message: "mrpPaise must be an integer >= 100",
      },
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

productVariantSchema.index({ product: 1, isActive: 1, pricePaise: 1 });

const ProductVariant = mongoose.model("ProductVariant", productVariantSchema);

module.exports = ProductVariant;
module.exports.WEIGHT_UNITS = WEIGHT_UNITS;
