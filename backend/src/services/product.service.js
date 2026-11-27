const mongoose = require("mongoose");
const httpStatus = require("../constants/httpStatus");
const ApiError = require("../utils/ApiError");
const { toSlug } = require("../utils/slug");
const {
  parsePagination,
  buildPaginationMeta,
  parseSort,
  escapeRegex,
  isValidObjectId,
} = require("../utils/queryFeatures");
const Category = require("../models/Category.model");
const Product = require("../models/Product.model");
const ProductVariant = require("../models/ProductVariant.model");
require("../models/Inventory.model");
const cloudinaryService = require("./cloudinary.service");
const { recordAudit } = require("./audit.service");

const PRODUCT_SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 },
  rating_desc: { rating: -1, reviewCount: -1 },
};

function formatStockFromInventory(inventoryDoc) {
  if (!inventoryDoc) {
    return {
      availableQuantity: 0,
      inStock: false,
      isLowStock: false,
    };
  }
  const availableQuantity = Math.max(
    0,
    (inventoryDoc.quantity || 0) - (inventoryDoc.reservedQuantity || 0)
  );
  const threshold = inventoryDoc.lowStockThreshold ?? 10;
  return {
    availableQuantity,
    inStock: availableQuantity > 0,
    isLowStock: availableQuantity > 0 && availableQuantity <= threshold,
  };
}

function formatVariant(variant, inventoryDoc = null) {
  return {
    id: String(variant._id),
    productId: String(variant.product),
    sku: variant.sku,
    label: variant.label,
    weightValue: variant.weightValue,
    weightUnit: variant.weightUnit,
    pricePaise: variant.pricePaise,
    mrpPaise: variant.mrpPaise ?? null,
    currency: variant.currency,
    isActive: Boolean(variant.isActive),
    stock: formatStockFromInventory(inventoryDoc),
  };
}

function formatProduct(product, variants = [], { includeInternal = false } = {}) {
  const base = {
    id: String(product._id),
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    category:
      product.category && typeof product.category === "object" && product.category.slug
        ? {
            id: String(product.category._id),
            name: product.category.name,
            slug: product.category.slug,
          }
        : product.category
          ? String(product.category)
          : null,
    subcategory:
      product.subcategory && typeof product.subcategory === "object" && product.subcategory.slug
        ? {
            id: String(product.subcategory._id),
            name: product.subcategory.name,
            slug: product.subcategory.slug,
          }
        : product.subcategory
          ? String(product.subcategory)
          : null,
    images: (product.images || []).map((img) => ({
      id: String(img._id),
      url: img.url,
      publicId: img.publicId,
      alt: img.alt || "",
      isPrimary: Boolean(img.isPrimary),
      sortOrder: img.sortOrder || 0,
    })),
    ingredients: product.ingredients || [],
    usageGuidance: product.usageGuidance || "",
    origin: product.origin || "",
    processingMethod: product.processingMethod || "",
    nutrition: product.nutrition || {},
    storageInstructions: product.storageInstructions || "",
    shelfLife: product.shelfLife || "",
    tags: product.tags || [],
    status: product.status,
    isFeatured: Boolean(product.isFeatured),
    isBestseller: Boolean(product.isBestseller),
    rating: product.rating || 0,
    reviewCount: product.reviewCount || 0,
    seo: product.seo || {},
    variants,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };

  if (includeInternal) {
    base.internalNotes = product.internalNotes || "";
    base.archivedAt = product.archivedAt || null;
  }

  return base;
}

async function fetchInventoryMapForVariants(variantIds) {
  const InventoryModel = mongoose.models.Inventory;
  if (!InventoryModel || variantIds.length === 0) {
    return new Map();
  }
  const records = await InventoryModel.find({ variant: { $in: variantIds } }).lean();
  return new Map(records.map((rec) => [String(rec.variant), rec]));
}

async function ensureVariantInventoryInitialized(variantId, actorId = null) {
  const InventoryModel = mongoose.models.Inventory;
  if (!InventoryModel) return;

  await InventoryModel.findOneAndUpdate(
    { variant: variantId },
    {
      $setOnInsert: {
        variant: variantId,
        quantity: 0,
        reservedQuantity: 0,
        lowStockThreshold: 10,
        updatedBy: actorId || null,
      },
    },
    { upsert: true, returnDocument: "after" }
  );
}

async function validateCategoryAndSubcategory(categoryId, subcategoryId) {
  if (!isValidObjectId(categoryId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Valid category ID is required");
  }
  const category = await Category.findOne({ _id: categoryId, archivedAt: null }).lean();
  if (!category) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Referenced category does not exist or is archived");
  }

  if (subcategoryId) {
    if (!isValidObjectId(subcategoryId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Valid subcategory ID format is required");
    }
    const subcategory = await Category.findOne({ _id: subcategoryId, archivedAt: null }).lean();
    if (!subcategory) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Referenced subcategory does not exist or is archived"
      );
    }
    if (!subcategory.parent || String(subcategory.parent) !== String(category._id)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Subcategory must belong to the selected parent category"
      );
    }
  }
}

async function ensureUniqueProductSlug(slug, excludeProductId = null) {
  const filter = { slug };
  if (excludeProductId) {
    filter._id = { $ne: excludeProductId };
  }
  const existing = await Product.findOne(filter).select("_id").lean();
  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "Product slug already exists");
  }
}

async function validateAndAttachVariants(productIds, { onlyActiveVariants = true } = {}) {
  if (productIds.length === 0) return new Map();

  const variantFilter = { product: { $in: productIds } };
  if (onlyActiveVariants) {
    variantFilter.isActive = true;
    variantFilter.archivedAt = null;
  }

  const variants = await ProductVariant.find(variantFilter).sort({ pricePaise: 1 }).lean();
  const invMap = await fetchInventoryMapForVariants(variants.map((v) => v._id));

  const byProduct = new Map();
  for (const variant of variants) {
    const key = String(variant.product);
    if (!byProduct.has(key)) {
      byProduct.set(key, []);
    }
    byProduct.get(key).push(formatVariant(variant, invMap.get(String(variant._id))));
  }
  return byProduct;
}

async function listPublicProducts(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 12, maxLimit: 100 });
  const filter = { status: "active", archivedAt: null };

  if (query.category) {
    if (isValidObjectId(query.category)) {
      filter.$or = [{ category: query.category }, { subcategory: query.category }];
    } else {
      const cat = await Category.findOne({
        slug: String(query.category).trim().toLowerCase(),
        isActive: true,
        archivedAt: null,
      })
        .select("_id")
        .lean();
      if (!cat) {
        return { items: [], pagination: buildPaginationMeta({ page, limit, total: 0 }) };
      }
      filter.$or = [{ category: cat._id }, { subcategory: cat._id }];
    }
  }

  if (query.tag && String(query.tag).trim()) {
    filter.tags = String(query.tag).trim().toLowerCase();
  }
  if (query.featured === "true") filter.isFeatured = true;
  if (query.bestseller === "true") filter.isBestseller = true;

  if (query.search && String(query.search).trim()) {
    const regex = new RegExp(escapeRegex(String(query.search).trim()), "i");
    const searchCondition = [
      { name: regex },
      { shortDescription: regex },
      { tags: regex },
      { ingredients: regex },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchCondition }];
      delete filter.$or;
    } else {
      filter.$or = searchCondition;
    }
  }

  // Variant-level filters (price range, weight, inStock)
  const variantFilter = { isActive: true, archivedAt: null };
  let hasVariantFilter = false;

  if (query.minPricePaise !== undefined || query.maxPricePaise !== undefined) {
    variantFilter.pricePaise = {};
    if (query.minPricePaise !== undefined && query.minPricePaise !== "") {
      const min = Number.parseInt(query.minPricePaise, 10);
      if (Number.isInteger(min) && min >= 0) {
        variantFilter.pricePaise.$gte = min;
        hasVariantFilter = true;
      }
    }
    if (query.maxPricePaise !== undefined && query.maxPricePaise !== "") {
      const max = Number.parseInt(query.maxPricePaise, 10);
      if (Number.isInteger(max) && max >= 0) {
        variantFilter.pricePaise.$lte = max;
        hasVariantFilter = true;
      }
    }
    if (Object.keys(variantFilter.pricePaise).length === 0) {
      delete variantFilter.pricePaise;
    }
  }

  if (query.weight && String(query.weight).trim()) {
    const match = String(query.weight)
      .trim()
      .toLowerCase()
      .match(/^(\d+)(g|kg|ml|l)$/);
    if (match) {
      variantFilter.weightValue = Number(match[1]);
      variantFilter.weightUnit = match[2];
      hasVariantFilter = true;
    }
  }

  if (hasVariantFilter || query.inStock === "true") {
    let matchingVariants = await ProductVariant.find(variantFilter).select("_id product").lean();

    if (query.inStock === "true") {
      const invMap = await fetchInventoryMapForVariants(matchingVariants.map((v) => v._id));
      matchingVariants = matchingVariants.filter((v) => {
        const inv = invMap.get(String(v._id));
        return inv && inv.quantity - inv.reservedQuantity > 0;
      });
    }

    const matchingProductIds = matchingVariants.map((v) => v.product);
    filter._id = { $in: matchingProductIds };
  }

  // Price sorting uses variant min price when requested
  if (query.sort === "price_asc" || query.sort === "price_desc") {
    const allMatched = await Product.find(filter)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .lean();
    const variantMap = await validateAndAttachVariants(
      allMatched.map((p) => p._id),
      { onlyActiveVariants: true }
    );

    const enriched = allMatched.map((p) => {
      const variants = variantMap.get(String(p._id)) || [];
      const minPrice = variants.length > 0 ? variants[0].pricePaise : Number.MAX_SAFE_INTEGER;
      return { product: p, variants, minPrice };
    });

    enriched.sort((a, b) =>
      query.sort === "price_asc" ? a.minPrice - b.minPrice : b.minPrice - a.minPrice
    );

    const paged = enriched.slice(skip, skip + limit);
    return {
      items: paged.map((entry) => formatProduct(entry.product, entry.variants)),
      pagination: buildPaginationMeta({ page, limit, total: enriched.length }),
    };
  }

  const sort = parseSort(query.sort, PRODUCT_SORT_MAP, PRODUCT_SORT_MAP.newest);
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const variantMap = await validateAndAttachVariants(
    products.map((p) => p._id),
    { onlyActiveVariants: true }
  );

  return {
    items: products.map((p) => formatProduct(p, variantMap.get(String(p._id)) || [])),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function getPublicProductBySlug(slug) {
  const product = await Product.findOne({
    slug: String(slug).trim().toLowerCase(),
    status: "active",
    archivedAt: null,
  })
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .lean();

  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  const variantMap = await validateAndAttachVariants([product._id], { onlyActiveVariants: true });
  return formatProduct(product, variantMap.get(String(product._id)) || []);
}

async function listAdminProducts(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};

  if (query.status && ["draft", "active", "archived"].includes(query.status)) {
    filter.status = query.status;
  }
  if (query.category && isValidObjectId(query.category)) {
    filter.category = query.category;
  }
  if (query.search && String(query.search).trim()) {
    const regex = new RegExp(escapeRegex(String(query.search).trim()), "i");
    filter.$or = [{ name: regex }, { slug: regex }];
  }

  const sort = parseSort(query.sort, PRODUCT_SORT_MAP, PRODUCT_SORT_MAP.newest);
  const [products, total] = await Promise.all([
    Product.find(filter)
      .select("+internalNotes")
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const variantMap = await validateAndAttachVariants(
    products.map((p) => p._id),
    { onlyActiveVariants: false }
  );

  return {
    items: products.map((p) =>
      formatProduct(p, variantMap.get(String(p._id)) || [], { includeInternal: true })
    ),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function getAdminProductById(productId) {
  if (!isValidObjectId(productId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product ID format");
  }

  const product = await Product.findById(productId)
    .select("+internalNotes")
    .populate("category", "name slug")
    .populate("subcategory", "name slug")
    .lean();

  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  const variantMap = await validateAndAttachVariants([product._id], { onlyActiveVariants: false });
  return formatProduct(product, variantMap.get(String(product._id)) || [], {
    includeInternal: true,
  });
}

function normalizeVariantPayload(input) {
  const sku = String(input.sku || "")
    .trim()
    .toUpperCase();
  const weightValue = Number(input.weightValue);
  const weightUnit = input.weightUnit || "g";
  const pricePaise = Number(input.pricePaise);
  const mrpPaise =
    input.mrpPaise !== undefined && input.mrpPaise !== null ? Number(input.mrpPaise) : null;

  if (mrpPaise !== null && mrpPaise < pricePaise) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Variant ${sku || ""}: mrpPaise cannot be less than pricePaise`
    );
  }

  const label = input.label ? String(input.label).trim() : `${weightValue}${weightUnit}`;

  return {
    sku,
    label,
    weightValue,
    weightUnit,
    pricePaise,
    mrpPaise,
    currency: "INR",
    isActive: typeof input.isActive === "boolean" ? input.isActive : true,
  };
}

async function createProduct({ actor, payload }) {
  const normalizedSlug = toSlug(payload.slug || payload.name);
  if (!normalizedSlug) {
    throw new ApiError(httpStatus.BAD_REQUEST, "A valid product name or slug is required");
  }

  await ensureUniqueProductSlug(normalizedSlug);
  await validateCategoryAndSubcategory(payload.category, payload.subcategory);

  const initialVariants = Array.isArray(payload.variants)
    ? payload.variants.map(normalizeVariantPayload)
    : [];

  if (initialVariants.length > 0) {
    const skus = initialVariants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Duplicate SKUs provided within variants");
    }
    const existingSku = await ProductVariant.findOne({ sku: { $in: skus } })
      .select("sku")
      .lean();
    if (existingSku) {
      throw new ApiError(httpStatus.CONFLICT, `SKU ${existingSku.sku} already exists`);
    }
  }

  const product = await Product.create({
    name: payload.name.trim(),
    slug: normalizedSlug,
    shortDescription: payload.shortDescription ? payload.shortDescription.trim() : "",
    description: payload.description.trim(),
    category: payload.category,
    subcategory: payload.subcategory || null,
    ingredients: Array.isArray(payload.ingredients)
      ? payload.ingredients.map((s) => String(s).trim()).filter(Boolean)
      : [],
    usageGuidance: payload.usageGuidance ? payload.usageGuidance.trim() : "",
    origin: payload.origin ? payload.origin.trim() : "",
    processingMethod: payload.processingMethod ? payload.processingMethod.trim() : "",
    nutrition: payload.nutrition || {},
    storageInstructions: payload.storageInstructions ? payload.storageInstructions.trim() : "",
    shelfLife: payload.shelfLife ? payload.shelfLife.trim() : "",
    tags: Array.isArray(payload.tags)
      ? payload.tags.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : [],
    status: payload.status || "draft",
    isFeatured: Boolean(payload.isFeatured),
    isBestseller: Boolean(payload.isBestseller),
    seo: payload.seo || {},
    internalNotes: payload.internalNotes ? payload.internalNotes.trim() : "",
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  const createdVariants = [];
  for (const v of initialVariants) {
    const variantDoc = await ProductVariant.create({
      product: product._id,
      ...v,
    });
    await ensureVariantInventoryInitialized(variantDoc._id, actor.id);
    createdVariants.push(formatVariant(variantDoc, null));
  }

  await product.populate([
    { path: "category", select: "name slug" },
    { path: "subcategory", select: "name slug" },
  ]);

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.created",
    resourceType: "Product",
    resourceId: product._id,
    after: {
      name: product.name,
      slug: product.slug,
      status: product.status,
      variantCount: createdVariants.length,
    },
  });

  return formatProduct(product, createdVariants, { includeInternal: true });
}

async function updateProduct({ actor, productId, payload }) {
  if (!isValidObjectId(productId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product ID format");
  }

  const product = await Product.findById(productId).select("+internalNotes");
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  const before = {
    name: product.name,
    slug: product.slug,
    status: product.status,
    category: String(product.category),
  };

  if (payload.slug !== undefined) {
    const nextSlug = toSlug(payload.slug);
    if (!nextSlug) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product slug");
    }
    await ensureUniqueProductSlug(nextSlug, product._id);
    product.slug = nextSlug;
  }

  if (payload.category !== undefined || payload.subcategory !== undefined) {
    const nextCat = payload.category !== undefined ? payload.category : String(product.category);
    const nextSub =
      payload.subcategory !== undefined
        ? payload.subcategory
        : product.subcategory
          ? String(product.subcategory)
          : null;
    await validateCategoryAndSubcategory(nextCat, nextSub);
    product.category = nextCat;
    product.subcategory = nextSub || null;
  }

  const scalarFields = [
    "name",
    "shortDescription",
    "description",
    "usageGuidance",
    "origin",
    "processingMethod",
    "storageInstructions",
    "shelfLife",
    "internalNotes",
  ];
  for (const field of scalarFields) {
    if (payload[field] !== undefined) {
      product[field] = String(payload[field]).trim();
    }
  }

  if (payload.ingredients !== undefined) {
    product.ingredients = payload.ingredients.map((s) => String(s).trim()).filter(Boolean);
  }
  if (payload.tags !== undefined) {
    product.tags = payload.tags.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  }
  if (payload.nutrition !== undefined) product.nutrition = payload.nutrition;
  if (payload.seo !== undefined) product.seo = payload.seo;
  if (payload.isFeatured !== undefined) product.isFeatured = Boolean(payload.isFeatured);
  if (payload.isBestseller !== undefined) product.isBestseller = Boolean(payload.isBestseller);

  if (payload.status !== undefined) {
    product.status = payload.status;
    product.archivedAt = payload.status === "archived" ? new Date() : null;
  }

  product.updatedBy = actor.id;
  await product.save();
  await product.populate([
    { path: "category", select: "name slug" },
    { path: "subcategory", select: "name slug" },
  ]);

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.updated",
    resourceType: "Product",
    resourceId: product._id,
    before,
    after: {
      name: product.name,
      slug: product.slug,
      status: product.status,
      category: String(product.category._id),
    },
  });

  const variantMap = await validateAndAttachVariants([product._id], { onlyActiveVariants: false });
  return formatProduct(product, variantMap.get(String(product._id)) || [], {
    includeInternal: true,
  });
}

async function archiveProduct({ actor, productId }) {
  if (!isValidObjectId(productId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product ID format");
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  const now = new Date();
  product.status = "archived";
  product.archivedAt = now;
  product.updatedBy = actor.id;
  await product.save();

  await ProductVariant.updateMany(
    { product: product._id, archivedAt: null },
    { $set: { isActive: false, archivedAt: now } }
  );

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.archived",
    resourceType: "Product",
    resourceId: product._id,
    after: { status: "archived", archivedAt: now },
  });

  return { id: String(product._id), status: product.status, archivedAt: product.archivedAt };
}

async function addVariant({ actor, productId, payload }) {
  if (!isValidObjectId(productId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product ID format");
  }

  const product = await Product.findById(productId).select("_id status");
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }
  if (product.status === "archived") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Cannot add variants to an archived product");
  }

  const normalized = normalizeVariantPayload(payload);
  const duplicate = await ProductVariant.findOne({ sku: normalized.sku }).select("_id").lean();
  if (duplicate) {
    throw new ApiError(httpStatus.CONFLICT, `SKU ${normalized.sku} already exists`);
  }

  const variant = await ProductVariant.create({
    product: product._id,
    ...normalized,
  });

  await ensureVariantInventoryInitialized(variant._id, actor.id);

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "variant.created",
    resourceType: "ProductVariant",
    resourceId: variant._id,
    after: { productId: String(product._id), sku: variant.sku, pricePaise: variant.pricePaise },
  });

  const invMap = await fetchInventoryMapForVariants([variant._id]);
  return formatVariant(variant, invMap.get(String(variant._id)));
}

async function updateVariant({ actor, variantId, payload }) {
  if (!isValidObjectId(variantId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid variant ID format");
  }

  const variant = await ProductVariant.findById(variantId);
  if (!variant) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
  }

  const before = {
    sku: variant.sku,
    pricePaise: variant.pricePaise,
    mrpPaise: variant.mrpPaise,
    isActive: variant.isActive,
  };

  if (payload.sku !== undefined) {
    const nextSku = String(payload.sku).trim().toUpperCase();
    const conflict = await ProductVariant.findOne({
      sku: nextSku,
      _id: { $ne: variant._id },
    })
      .select("_id")
      .lean();
    if (conflict) {
      throw new ApiError(httpStatus.CONFLICT, `SKU ${nextSku} already exists`);
    }
    variant.sku = nextSku;
  }

  if (payload.label !== undefined) variant.label = String(payload.label).trim();
  if (payload.weightValue !== undefined) variant.weightValue = Number(payload.weightValue);
  if (payload.weightUnit !== undefined) variant.weightUnit = payload.weightUnit;
  if (payload.pricePaise !== undefined) variant.pricePaise = Number(payload.pricePaise);
  if (payload.mrpPaise !== undefined) {
    variant.mrpPaise = payload.mrpPaise === null ? null : Number(payload.mrpPaise);
  }
  if (variant.mrpPaise !== null && variant.mrpPaise < variant.pricePaise) {
    throw new ApiError(httpStatus.BAD_REQUEST, "mrpPaise cannot be less than pricePaise");
  }
  if (payload.isActive !== undefined) {
    variant.isActive = Boolean(payload.isActive);
    if (variant.isActive) {
      variant.archivedAt = null;
    }
  }

  await variant.save();

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "variant.updated",
    resourceType: "ProductVariant",
    resourceId: variant._id,
    before,
    after: {
      sku: variant.sku,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      isActive: variant.isActive,
    },
  });

  const invMap = await fetchInventoryMapForVariants([variant._id]);
  return formatVariant(variant, invMap.get(String(variant._id)));
}

async function archiveVariant({ actor, variantId }) {
  if (!isValidObjectId(variantId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid variant ID format");
  }

  const variant = await ProductVariant.findById(variantId);
  if (!variant) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product variant not found");
  }

  variant.isActive = false;
  variant.archivedAt = new Date();
  await variant.save();

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "variant.archived",
    resourceType: "ProductVariant",
    resourceId: variant._id,
    after: { isActive: false, archivedAt: variant.archivedAt },
  });

  return formatVariant(variant, null);
}

async function uploadProductImage({ actor, productId, file, alt = "", isPrimary = false }) {
  if (!isValidObjectId(productId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product ID format");
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }
  if (product.status === "archived") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Cannot upload images to an archived product");
  }
  if (product.images.length >= 10) {
    throw new ApiError(httpStatus.BAD_REQUEST, "A product can have at most 10 images");
  }

  const uploaded = await cloudinaryService.uploadProductImageBuffer({
    buffer: file.buffer,
    productId: String(product._id),
    filename: file.originalname,
  });

  const shouldBePrimary = Boolean(isPrimary) || product.images.length === 0;
  if (shouldBePrimary) {
    product.images.forEach((img) => {
      img.isPrimary = false;
    });
  }

  product.images.push({
    url: uploaded.url,
    publicId: uploaded.publicId,
    alt: String(alt || "").trim(),
    isPrimary: shouldBePrimary,
    sortOrder: product.images.length,
    uploadedBy: actor.id,
  });

  product.updatedBy = actor.id;
  await product.save();

  const added = product.images[product.images.length - 1];

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.image_uploaded",
    resourceType: "Product",
    resourceId: product._id,
    after: { imageId: String(added._id), publicId: added.publicId },
  });

  return {
    id: String(added._id),
    url: added.url,
    publicId: added.publicId,
    alt: added.alt,
    isPrimary: added.isPrimary,
    sortOrder: added.sortOrder,
  };
}

async function deleteProductImage({ actor, productId, imageId }) {
  if (!isValidObjectId(productId) || !isValidObjectId(imageId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid product or image ID format");
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  // Ownership check: image must belong to this product
  const targetImage = product.images.id(imageId);
  if (!targetImage) {
    throw new ApiError(httpStatus.NOT_FOUND, "Image not found on this product");
  }

  const deletedPublicId = targetImage.publicId;
  await cloudinaryService.deleteCloudinaryImage(deletedPublicId);

  const wasPrimary = targetImage.isPrimary;
  targetImage.deleteOne();

  if (wasPrimary && product.images.length > 0) {
    product.images[0].isPrimary = true;
  }

  product.updatedBy = actor.id;
  await product.save();

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.image_deleted",
    resourceType: "Product",
    resourceId: product._id,
    before: { imageId, publicId: deletedPublicId },
  });

  return { deletedImageId: imageId, publicId: deletedPublicId };
}

module.exports = {
  listPublicProducts,
  getPublicProductBySlug,
  listAdminProducts,
  getAdminProductById,
  createProduct,
  updateProduct,
  archiveProduct,
  addVariant,
  updateVariant,
  archiveVariant,
  uploadProductImage,
  deleteProductImage,
  ensureVariantInventoryInitialized,
};
