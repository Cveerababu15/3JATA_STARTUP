const mongoose = require("mongoose");

const PRODUCT_STATUSES = ["draft", "active", "archived"];

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    alt: { type: String, default: "", trim: true, maxlength: 200 },
    isPrimary: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true }
);

const nutritionSchema = new mongoose.Schema(
  {
    servingSize: { type: String, default: "", trim: true, maxlength: 100 },
    energyKcal: { type: Number, default: null, min: 0 },
    proteinGrams: { type: Number, default: null, min: 0 },
    carbsGrams: { type: Number, default: null, min: 0 },
    fiberGrams: { type: Number, default: null, min: 0 },
    fatGrams: { type: Number, default: null, min: 0 },
    highlights: [{ type: String, trim: true, maxlength: 120 }],
  },
  { _id: false }
);

const seoSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 320 },
    keywords: [{ type: String, trim: true, maxlength: 60 }],
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 180,
    },
    shortDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    images: {
      type: [productImageSchema],
      default: [],
    },
    ingredients: {
      type: [String],
      default: [],
    },
    usageGuidance: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    origin: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    processingMethod: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    nutrition: {
      type: nutritionSchema,
      default: () => ({}),
    },
    storageInstructions: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    shelfLife: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: PRODUCT_STATUSES,
      default: "draft",
      required: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isBestseller: {
      type: Boolean,
      default: false,
      index: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    seo: {
      type: seoSchema,
      default: () => ({}),
    },
    internalNotes: {
      type: String,
      default: "",
      maxlength: 2000,
      select: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

productSchema.index({ status: 1, category: 1, isFeatured: 1, isBestseller: 1 });
productSchema.index({ tags: 1 });
productSchema.index({
  name: "text",
  shortDescription: "text",
  description: "text",
  tags: "text",
  ingredients: "text",
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
module.exports.PRODUCT_STATUSES = PRODUCT_STATUSES;
