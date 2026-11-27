# Product Catalogue

## 1. Purpose and Business Problem
3JATA sells structured organic powders (banana, beetroot, mango, amla, moringa, etc.) across multiple pack sizes (100g, 250g, 500g, 1kg). Customers need rich trust data (origin, ingredients, processing method, nutrition, storage, shelf life), search, filters, and variant-specific prices, while draft/archived items and internal staff notes must stay hidden from the storefront.

## 2. Concepts Explained for a Beginner
- **Product vs Variant:** A `Product` holds shared information (name, ingredients, origin, images), while each `ProductVariant` represents a purchasable pack size with its own unique `sku`, weight, and `pricePaise`.
- **Integer Paise Money Representation:** Storing ₹249.00 as `24900` integer paise prevents JavaScript decimal rounding bugs (`0.1 + 0.2`) and matches Razorpay's payment unit.
- **Non-Destructive Archival:** Deleting a product or category sets `status: "archived"` / `archivedAt` instead of wiping the database row, so future customer order history keeps valid references.
- **Category Cycle Prevention:** Before setting a category's `parent`, the service walks up the parent chain to ensure a category cannot become an ancestor of itself.

## 3. Files Created or Changed and Their Responsibilities
- `backend/src/utils/slug.js` — Deterministic URL slug normalizer (`toSlug`).
- `backend/src/config/cloudinary.js` & `services/cloudinary.service.js` — Real Cloudinary v2 SDK upload/destroy integration with explicit credential checks.
- `backend/src/middleware/upload.middleware.js` — Multer memory storage (2 MB max, MIME allowlist + JPEG/PNG/WebP magic-byte verification).
- `backend/src/models/Category.model.js`, `Product.model.js`, `ProductVariant.model.js` — Schemas and indexes.
- `backend/src/services/category.service.js` & `product.service.js` — Business logic, cycle detection, public visibility filtering, price/weight/inStock filtering, sorting, archival, and image ownership enforcement.
- `backend/src/validators/category.validator.js` & `product.validator.js` — Input validation + explicit rejection of `stock`, `quantity`, `rating`, `reviewCount` on catalogue endpoints.
- `backend/src/controllers/category.controller.js` & `product.controller.js` — Thin HTTP handlers.
- `backend/src/routes/category.routes.js`, `product.routes.js`, `variant.routes.js`, `routes/index.js` — Public & permission-gated endpoints.
- `backend/tests/integration/catalogue.test.js` & `tests/providers/cloudinary.test.js` — Integration and Cloudinary/upload tests.

## 4. Important Code Sections and Why They Exist
- **Public Visibility Boundary (`product.service.js`):** Public endpoints strictly query `{ status: "active", archivedAt: null }` and omit `internalNotes` (`select: false` + serializer exclusion).
- **Stock Isolation (`product.validator.js`):** `FORBIDDEN_PRODUCT_FIELDS` and `FORBIDDEN_VARIANT_FIELDS` reject any attempt to send `stock`, `quantity`, or `reservedQuantity` through product/variant routes.
- **Image Ownership Check (`deleteProductImage`):** `product.images.id(imageId)` ensures a caller can only delete images actually attached to that `:id` product.

## 5. Request Flow
- Public Browse: `GET /api/products?search=...&category=...&sort=price_asc&page=1&limit=12` -> `productController.listPublicProducts` -> `productService.listPublicProducts` -> attaches active variants & live availability -> `200 paginated`.
- Image Upload: `POST /api/products/:id/images` -> `authenticate` -> `requireCsrf` -> `requirePermission("products.update")` -> `productIdParamValidator` -> `uploadSingleProductImage` (size + MIME + magic bytes) -> `cloudinaryService.uploadProductImageBuffer` -> saves image on product -> `201`.

## 6. Database Fields, Indexes, and Relationships
- `Category`: unique `{ slug: 1 }`, `{ parent: 1, isActive: 1, displayOrder: 1 }`.
- `Product`: unique `{ slug: 1 }`, `{ status: 1, category: 1, isFeatured: 1, isBestseller: 1 }`, `{ tags: 1 }`, text index on name/shortDescription/description/tags/ingredients.
- `ProductVariant`: unique `{ sku: 1 }`, `{ product: 1, isActive: 1, pricePaise: 1 }`.

## 7. Design Decisions and Trade-offs
- **Integer Paise (`pricePaise`):** Chosen over decimal rupees for exact arithmetic and Razorpay compatibility.
- **Separate `/manage` Routes:** Management reads live at `GET /api/categories/manage` and `GET /api/products/manage` (mounted before `/:slug`) so public endpoints never accidentally expose drafts.

## 8. Security Rules and Edge Cases
- Duplicate slugs and SKUs return `409 Conflict`.
- `mrpPaise` cannot be lower than `pricePaise`.
- Subcategory must have `subcategory.parent === product.category`.
- Uploaded files must pass both Multer MIME filter, 2 MB size cap (`413`), and binary magic-byte header verification (`400`).

## 9. Exact Setup and Run Commands
- Configure Cloudinary credentials in `backend/.env` for live uploads:
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`
- Without Cloudinary credentials, all non-image catalogue APIs still work; image upload/delete returns `503 Service Unavailable`.

## 10. API and Postman Instructions Relevant to Product Catalogue
- Public: `GET /api/categories`, `GET /api/categories/:slug`, `GET /api/products`, `GET /api/products/:slug`.
- Management (`categories.*` / `products.*` + `X-CSRF-Token` for writes):
  - `GET /api/categories/manage`, `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id`
  - `GET /api/products/manage`, `GET /api/products/manage/:id`, `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id`
  - `POST /api/products/:id/variants`, `PATCH /api/variants/:id`, `DELETE /api/variants/:id`
  - `POST /api/products/:id/images` (`multipart/form-data`, field `image`), `DELETE /api/products/:id/images/:imageId`

## 11. Automated Tests and Actual Results
- `tests/integration/catalogue.test.js`: **3/3 passed** (categories/manage/slug/cycle prevention/archival, public vs draft visibility/SKUs/paise/variants/filtering/sorting/archival, image size/MIME/magic-byte validation & ownership-checked deletion with mocked Cloudinary service).
- `tests/providers/cloudinary.test.js`: **3/3 passed** (magic-byte checks, 503 when unconfigured, mocked Cloudinary SDK upload & destroy).
- Live Cloudinary check: Uploaded 1x1 test PNG, retrieved `200 image/png`, deleted asset (`result: "ok"`), and confirmed deletion via Cloudinary Admin API (`404 Not Found`; `leftoverAsset: false`).

## 12. Manual Testing Status
**Not run by user.**

## 13. Common Errors and Fixes
- **`503 Cloudinary credentials are not configured`:** Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to `backend/.env` and restart the server.
- **`400 Field "stock" cannot be modified via product endpoints`:** Manage stock exclusively via Inventory Management `/api/inventory/:variantId/adjust`.

## 14. Short, Accurate Interview Explanation
"I built a structured category, product, and variant catalogue with cycle-free category hierarchies, unique slugs and SKUs, integer paise pricing, strict public draft exclusion, non-destructive archival for order history safety, and permission- and ownership-restricted Cloudinary image management with magic-byte file validation."

## 15. Remaining Work and Next Step
- **Next Step:** See [Inventory Management](inventory-management.md).
