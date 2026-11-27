# 3JATA Backend Foundation — API Endpoint Index

- **API Base Path:** `/api` (Postman `{{baseUrl}}` = `http://localhost:5000/api`)
- **Authentication:** `HttpOnly` session cookie `3jata_sid` (automatically managed by browser / Postman Cookie Jar)
- **CSRF Header:** `X-CSRF-Token: {{csrfToken}}` required on all authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests
- **Money Unit:** Integer paise (`pricePaise`, `mrpPaise`, `INR`)
- **Total Implemented Endpoints:** **45**

---

## 1. Health (2 endpoints)
| Method | Full Route | Access / Permission | CSRF? | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/api/health` | Public | No | Liveness + live Mongoose connection state |
| `GET` | `/api/health/ready` | Public | No | Readiness check (`200` connected, `503` disconnected) |

## 2. Authentication (10 endpoints)
| Method | Full Route | Access / Permission | CSRF? | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public (rate-limited) | No | Register customer account and queue verification email |
| `POST` | `/api/auth/verify-email` | Public (rate-limited) | No | Verify email using single-use token |
| `POST` | `/api/auth/resend-verification` | Public (rate-limited) | No | Resend verification email (anti-enumeration) |
| `POST` | `/api/auth/login` | Public (rate-limited) | No | Log in, set `3jata_sid` & `3jata_csrf` cookies, return `csrfToken` |
| `POST` | `/api/auth/forgot-password` | Public (rate-limited) | No | Request password reset email (anti-enumeration) |
| `POST` | `/api/auth/reset-password` | Public (rate-limited) | No | Reset password with single-use token and revoke sessions |
| `GET` | `/api/auth/me` | Authenticated | No | Fetch current authenticated user and permissions |
| `GET` | `/api/auth/csrf-token` | Authenticated | No | Fetch active session CSRF token |
| `POST` | `/api/auth/logout` | Authenticated | Yes | Revoke current session and clear cookies |
| `PATCH` | `/api/auth/change-password` | Authenticated | Yes | Change password and revoke all active sessions |

## 3. Admin — Roles, Permissions, Staff & Audit (9 endpoints)
| Method | Full Route | Access / Permission | CSRF? | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/api/admin/roles` | Staff + `roles.read` | No | List active roles and assigned permission codes |
| `GET` | `/api/admin/permissions` | Staff + `roles.read` | No | List all defined system permissions |
| `GET` | `/api/admin/staff` | Staff + `staff.read` | No | Paginated staff account listing |
| `POST` | `/api/admin/staff` | Staff + `staff.create` | Yes | Provision a new staff account |
| `GET` | `/api/admin/staff/:id` | Staff + `staff.read` | No | Fetch a single staff account |
| `PATCH` | `/api/admin/staff/:id` | Staff + `staff.update` | Yes | Update staff profile fields |
| `PATCH` | `/api/admin/staff/:id/role` | Staff + `roles.manage` | Yes | Assign role to staff and revoke target sessions |
| `PATCH` | `/api/admin/staff/:id/status` | Staff + `staff.update` | Yes | Suspend or reactivate staff account |
| `GET` | `/api/admin/audit-logs` | Staff + `audit_logs.read` | No | Paginated immutable audit trail |

## 4. Categories (6 endpoints)
| Method | Full Route | Access / Permission | CSRF? | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/api/categories` | Public | No | Paginated active categories |
| `GET` | `/api/categories/manage` | Staff + `categories.read` | No | Paginated admin category list (includes inactive/archived) |
| `GET` | `/api/categories/:slug` | Public | No | Fetch active category + active subcategories by slug |
| `POST` | `/api/categories` | Staff + `categories.create` | Yes | Create category or subcategory |
| `PATCH` | `/api/categories/:id` | Staff + `categories.update` | Yes | Update category with hierarchy cycle prevention |
| `DELETE` | `/api/categories/:id` | Staff + `categories.delete` | Yes | Archive category non-destructively |

## 5. Products & Images (10 endpoints)
| Method | Full Route | Access / Permission | CSRF? | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/api/products` | Public | No | Search, filter, sort, paginate active products |
| `GET` | `/api/products/manage` | Staff + `products.read` | No | Paginated admin product list (includes drafts/archived) |
| `GET` | `/api/products/manage/:id` | Staff + `products.read` | No | Fetch full admin product details including `internalNotes` |
| `GET` | `/api/products/:slug` | Public | No | Fetch active product detail with variants and stock availability |
| `POST` | `/api/products` | Staff + `products.create` | Yes | Create product and optional initial variants |
| `PATCH` | `/api/products/:id` | Staff + `products.update` | Yes | Update product metadata or status |
| `DELETE` | `/api/products/:id` | Staff + `products.delete` | Yes | Archive product and its variants non-destructively |
| `POST` | `/api/products/:id/variants` | Staff + `products.update` | Yes | Add variant to product and initialize inventory at `0` |
| `POST` | `/api/products/:id/images` | Staff + `products.update` | Yes | Upload JPEG/PNG/WebP image (max 2MB) to Cloudinary |
| `DELETE` | `/api/products/:id/images/:imageId` | Staff + `products.update` | Yes | Delete product-owned image from Cloudinary & DB |

## 6. Variants (2 endpoints)
| Method | Full Route | Access / Permission | CSRF? | Purpose |
| --- | --- | --- | --- | --- |
| `PATCH` | `/api/variants/:id` | Staff + `products.update` | Yes | Update variant SKU, weight, `pricePaise`, or active flag |
| `DELETE` | `/api/variants/:id` | Staff + `products.delete` | Yes | Archive variant non-destructively |

## 7. Inventory (6 endpoints)
| Method | Full Route | Access / Permission | CSRF? | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/api/inventory` | Staff + `inventory.read` | No | Paginated variant stock levels |
| `GET` | `/api/inventory/low-stock` | Staff + `inventory.read` | No | Variants at or below `lowStockThreshold` |
| `GET` | `/api/inventory/transactions` | Staff + `inventory.read` | No | Paginated stock movement history |
| `GET` | `/api/inventory/:variantId` | Staff + `inventory.read` | No | Variant inventory + last 10 transactions |
| `PATCH` | `/api/inventory/:variantId/adjust` | Staff + `inventory.adjust` | Yes | Atomic/transactional stock adjustment with required reason |
| `PATCH` | `/api/inventory/:variantId/threshold` | Staff + `inventory.adjust` | Yes | Update variant `lowStockThreshold` |
