const httpStatus = require("../constants/httpStatus");
const apiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const categoryService = require("../services/category.service");

const listPublicCategories = asyncHandler(async (req, res) => {
  const { items, pagination } = await categoryService.listPublicCategories(req.query);
  return apiResponse.paginated(res, "Categories fetched successfully", items, pagination);
});

const getPublicCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await categoryService.getPublicCategoryBySlug(req.params.slug);
  return apiResponse.success(res, "Category fetched successfully", { category }, httpStatus.OK);
});

const listAdminCategories = asyncHandler(async (req, res) => {
  const { items, pagination } = await categoryService.listAdminCategories(req.query);
  return apiResponse.paginated(res, "Categories fetched successfully", items, pagination);
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, slug, description, parent, displayOrder, isActive } = req.body;
  const category = await categoryService.createCategory({
    actor: req.user,
    name,
    slug,
    description,
    parent,
    displayOrder,
    isActive,
  });

  return apiResponse.success(
    res,
    "Category created successfully",
    { category },
    httpStatus.CREATED
  );
});

const updateCategory = asyncHandler(async (req, res) => {
  const { name, slug, description, parent, displayOrder, isActive } = req.body;
  const category = await categoryService.updateCategory({
    actor: req.user,
    categoryId: req.params.id,
    updates: { name, slug, description, parent, displayOrder, isActive },
  });

  return apiResponse.success(res, "Category updated successfully", { category }, httpStatus.OK);
});

const archiveCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.archiveCategory({
    actor: req.user,
    categoryId: req.params.id,
  });

  return apiResponse.success(res, "Category archived successfully", { category }, httpStatus.OK);
});

module.exports = {
  listPublicCategories,
  getPublicCategoryBySlug,
  listAdminCategories,
  createCategory,
  updateCategory,
  archiveCategory,
};
