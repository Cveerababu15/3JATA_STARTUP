const httpStatus = require("../constants/httpStatus");
const apiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const productService = require("../services/product.service");

const listPublicProducts = asyncHandler(async (req, res) => {
  const { items, pagination } = await productService.listPublicProducts(req.query);
  return apiResponse.paginated(res, "Products fetched successfully", items, pagination);
});

const getPublicProductBySlug = asyncHandler(async (req, res) => {
  const product = await productService.getPublicProductBySlug(req.params.slug);
  return apiResponse.success(res, "Product fetched successfully", { product }, httpStatus.OK);
});

const listAdminProducts = asyncHandler(async (req, res) => {
  const { items, pagination } = await productService.listAdminProducts(req.query);
  return apiResponse.paginated(res, "Products fetched successfully", items, pagination);
});

const getAdminProductById = asyncHandler(async (req, res) => {
  const product = await productService.getAdminProductById(req.params.id);
  return apiResponse.success(res, "Product fetched successfully", { product }, httpStatus.OK);
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct({
    actor: req.user,
    payload: req.body,
  });
  return apiResponse.success(res, "Product created successfully", { product }, httpStatus.CREATED);
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct({
    actor: req.user,
    productId: req.params.id,
    payload: req.body,
  });
  return apiResponse.success(res, "Product updated successfully", { product }, httpStatus.OK);
});

const archiveProduct = asyncHandler(async (req, res) => {
  const result = await productService.archiveProduct({
    actor: req.user,
    productId: req.params.id,
  });
  return apiResponse.success(res, "Product archived successfully", result, httpStatus.OK);
});

const addVariant = asyncHandler(async (req, res) => {
  const variant = await productService.addVariant({
    actor: req.user,
    productId: req.params.id,
    payload: req.body,
  });
  return apiResponse.success(res, "Variant created successfully", { variant }, httpStatus.CREATED);
});

const updateVariant = asyncHandler(async (req, res) => {
  const variant = await productService.updateVariant({
    actor: req.user,
    variantId: req.params.id,
    payload: req.body,
  });
  return apiResponse.success(res, "Variant updated successfully", { variant }, httpStatus.OK);
});

const archiveVariant = asyncHandler(async (req, res) => {
  const variant = await productService.archiveVariant({
    actor: req.user,
    variantId: req.params.id,
  });
  return apiResponse.success(res, "Variant archived successfully", { variant }, httpStatus.OK);
});

const uploadProductImage = asyncHandler(async (req, res) => {
  const image = await productService.uploadProductImage({
    actor: req.user,
    productId: req.params.id,
    file: req.file,
    alt: req.body.alt || "",
    isPrimary: req.body.isPrimary === "true" || req.body.isPrimary === true,
  });

  return apiResponse.success(
    res,
    "Product image uploaded successfully",
    { image },
    httpStatus.CREATED
  );
});

const deleteProductImage = asyncHandler(async (req, res) => {
  const result = await productService.deleteProductImage({
    actor: req.user,
    productId: req.params.id,
    imageId: req.params.imageId,
  });

  return apiResponse.success(res, "Product image deleted successfully", result, httpStatus.OK);
});

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
};
