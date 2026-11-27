const httpStatus = require("../constants/httpStatus");
const ApiError = require("../utils/ApiError");
const { toSlug } = require("../utils/slug");
const {
  parsePagination,
  buildPaginationMeta,
  escapeRegex,
  isValidObjectId,
} = require("../utils/queryFeatures");
const Category = require("../models/Category.model");
const Product = require("../models/Product.model");
const { recordAudit } = require("./audit.service");

function formatCategory(cat) {
  return {
    id: String(cat._id),
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    parent: cat.parent
      ? typeof cat.parent === "object" && cat.parent.slug
        ? { id: String(cat.parent._id), name: cat.parent.name, slug: cat.parent.slug }
        : String(cat.parent)
      : null,
    image: cat.image?.url ? cat.image : null,
    displayOrder: cat.displayOrder,
    isActive: cat.isActive,
    archivedAt: cat.archivedAt || null,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  };
}

async function ensureUniqueCategorySlug(desiredSlug, excludeId = null) {
  const query = { slug: desiredSlug };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const existing = await Category.findOne(query).select("_id").lean();
  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "Category slug already exists");
  }
}

async function assertValidParentAndNoCycle(categoryId, parentId) {
  if (!parentId) return null;

  if (!isValidObjectId(parentId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid parent category ID format");
  }

  if (categoryId && String(categoryId) === String(parentId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "A category cannot be its own parent");
  }

  const visited = new Set();
  if (categoryId) {
    visited.add(String(categoryId));
  }

  let cursorId = String(parentId);
  let depth = 0;
  let immediateParent = null;

  while (cursorId) {
    if (visited.has(cursorId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Category hierarchy cannot contain a cycle");
    }
    visited.add(cursorId);

    const node = await Category.findById(cursorId).select("_id parent isActive archivedAt").lean();
    if (!node) {
      throw new ApiError(httpStatus.NOT_FOUND, "Parent category not found");
    }
    if (depth === 0) {
      if (node.archivedAt) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Cannot use an archived category as parent");
      }
      immediateParent = node;
    }

    cursorId = node.parent ? String(node.parent) : null;
    depth += 1;
    if (depth > 20) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Category nesting depth limit exceeded");
    }
  }

  return immediateParent;
}

async function listPublicCategories(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = { isActive: true, archivedAt: null };

  if (query.parent === "root") {
    filter.parent = null;
  } else if (query.parent && isValidObjectId(query.parent)) {
    filter.parent = query.parent;
  }

  if (query.search && String(query.search).trim()) {
    const regex = new RegExp(escapeRegex(String(query.search).trim()), "i");
    filter.$or = [{ name: regex }, { description: regex }];
  }

  const [items, total] = await Promise.all([
    Category.find(filter)
      .populate("parent", "name slug")
      .sort({ displayOrder: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Category.countDocuments(filter),
  ]);

  return {
    items: items.map(formatCategory),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function getPublicCategoryBySlug(slug) {
  const category = await Category.findOne({
    slug: String(slug).trim().toLowerCase(),
    isActive: true,
    archivedAt: null,
  })
    .populate("parent", "name slug")
    .lean();

  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  const subcategories = await Category.find({
    parent: category._id,
    isActive: true,
    archivedAt: null,
  })
    .sort({ displayOrder: 1, name: 1 })
    .lean();

  return {
    ...formatCategory(category),
    subcategories: subcategories.map(formatCategory),
  };
}

async function listAdminCategories(query = {}) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};

  if (query.includeArchived !== "true") {
    filter.archivedAt = null;
  }
  if (query.isActive === "true") filter.isActive = true;
  if (query.isActive === "false") filter.isActive = false;

  if (query.parent === "root") {
    filter.parent = null;
  } else if (query.parent && isValidObjectId(query.parent)) {
    filter.parent = query.parent;
  }

  if (query.search && String(query.search).trim()) {
    const regex = new RegExp(escapeRegex(String(query.search).trim()), "i");
    filter.$or = [{ name: regex }, { slug: regex }];
  }

  const [items, total] = await Promise.all([
    Category.find(filter)
      .populate("parent", "name slug")
      .sort({ displayOrder: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Category.countDocuments(filter),
  ]);

  return {
    items: items.map(formatCategory),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

async function createCategory({ actor, name, slug, description, parent, displayOrder, isActive }) {
  const normalizedSlug = toSlug(slug || name);
  if (!normalizedSlug) {
    throw new ApiError(httpStatus.BAD_REQUEST, "A valid category name or slug is required");
  }

  await ensureUniqueCategorySlug(normalizedSlug);
  await assertValidParentAndNoCycle(null, parent);

  const category = await Category.create({
    name: name.trim(),
    slug: normalizedSlug,
    description: description ? description.trim() : "",
    parent: parent || null,
    displayOrder: Number.isInteger(displayOrder) ? displayOrder : 0,
    isActive: typeof isActive === "boolean" ? isActive : true,
  });

  await category.populate("parent", "name slug");

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "category.created",
    resourceType: "Category",
    resourceId: category._id,
    after: { name: category.name, slug: category.slug, parent: parent || null },
  });

  return formatCategory(category);
}

async function updateCategory({ actor, categoryId, updates }) {
  if (!isValidObjectId(categoryId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category ID format");
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  const before = {
    name: category.name,
    slug: category.slug,
    parent: category.parent ? String(category.parent) : null,
    isActive: category.isActive,
  };

  if (updates.slug !== undefined) {
    const nextSlug = toSlug(updates.slug);
    if (!nextSlug) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category slug");
    }
    await ensureUniqueCategorySlug(nextSlug, category._id);
    category.slug = nextSlug;
  }

  if (updates.parent !== undefined) {
    await assertValidParentAndNoCycle(category._id, updates.parent);
    category.parent = updates.parent || null;
  }

  if (updates.name !== undefined) category.name = updates.name.trim();
  if (updates.description !== undefined) category.description = updates.description.trim();
  if (updates.displayOrder !== undefined) category.displayOrder = updates.displayOrder;
  if (updates.isActive !== undefined) {
    category.isActive = updates.isActive;
    if (updates.isActive) {
      category.archivedAt = null;
    }
  }

  await category.save();
  await category.populate("parent", "name slug");

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "category.updated",
    resourceType: "Category",
    resourceId: category._id,
    before,
    after: {
      name: category.name,
      slug: category.slug,
      parent: category.parent ? String(category.parent._id) : null,
      isActive: category.isActive,
    },
  });

  return formatCategory(category);
}

async function archiveCategory({ actor, categoryId }) {
  if (!isValidObjectId(categoryId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category ID format");
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  const activeChildCount = await Category.countDocuments({
    parent: category._id,
    archivedAt: null,
  });
  if (activeChildCount > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot archive a category that still has active subcategories"
    );
  }

  const activeProductCount = await Product.countDocuments({
    $or: [{ category: category._id }, { subcategory: category._id }],
    status: { $ne: "archived" },
  });
  if (activeProductCount > 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot archive a category that is assigned to non-archived products"
    );
  }

  category.isActive = false;
  category.archivedAt = new Date();
  await category.save();

  await recordAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "category.archived",
    resourceType: "Category",
    resourceId: category._id,
    after: { isActive: false, archivedAt: category.archivedAt },
  });

  return formatCategory(category);
}

module.exports = {
  listPublicCategories,
  getPublicCategoryBySlug,
  listAdminCategories,
  createCategory,
  updateCategory,
  archiveCategory,
};
