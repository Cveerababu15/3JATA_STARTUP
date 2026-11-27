# Manual Postman Test Results — 3JATA Backend Foundation

**Status Legend:** `Not run` | `Pass` | `Fail`

| Test ID | Request | Scenario | Expected Result | Actual Result | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| PM-01 | `GET /api/health` | Check API health and DB connection | `200`, `database: "connected"` | Not run | Not run | |
| PM-02 | `GET /api/health/ready` | Check strict readiness | `200`, `status: "ready"` | Not run | Not run | |
| PM-03 | `POST /api/auth/register` | Register new customer | `201`, verification email queued | Not run | Not run | |
| PM-04 | `POST /api/auth/register` | Reject privileged `role` field | `400` Validation failed | Not run | Not run | |
| PM-05 | `POST /api/auth/verify-email` | Verify customer with email token | `200`, `isEmailVerified: true` | Not run | Not run | |
| PM-06 | `POST /api/auth/verify-email` | Reuse consumed verification token | `400` invalid/expired | Not run | Not run | |
| PM-07 | `POST /api/auth/login` | Customer login | `200`, cookies + `csrfToken` set | Not run | Not run | |
| PM-08 | `GET /api/auth/me` | Fetch authenticated customer | `200`, no `passwordHash` | Not run | Not run | |
| PM-09 | `PATCH /api/auth/change-password` | Change password with CSRF header | `200`, sessions revoked | Not run | Not run | |
| PM-10 | `POST /api/auth/forgot-password` + `reset-password` | Reset customer password | `200`, token single-use | Not run | Not run | |
| PM-11 | `POST /api/auth/logout` | Logout with CSRF header | `200`, cookies cleared, `/me` -> `401` | Not run | Not run | |
| PM-12 | `GET /api/admin/roles` (as customer) | Customer blocked from admin | `403 Forbidden` | Not run | Not run | |
| PM-13 | `POST /api/auth/login` | Bootstrapped owner login | `200`, `super_admin` permissions | Not run | Not run | |
| PM-14 | `POST /api/admin/staff` | Owner provisions staff | `201`, staff created & audited | Not run | Not run | |
| PM-15 | `PATCH /api/admin/staff/:id/role` | Reassign staff role | `200`, target sessions revoked | Not run | Not run | |
| PM-16 | `PATCH /api/admin/staff/:id/status` | Suspend & reactivate staff | `200`, suspended login blocked `403` | Not run | Not run | |
| PM-17 | `GET /api/admin/audit-logs` | View audit trail | `200`, sensitive changes recorded | Not run | Not run | |
| PM-18 | `POST /api/categories` | Create root category & subcategory | `201` | Not run | Not run | |
| PM-19 | `POST /api/products` | Create product with variants (paise) | `201`, inventory initialized at `0` | Not run | Not run | |
| PM-20 | `PATCH /api/products/:id` | Reject forbidden `stock` field | `400` | Not run | Not run | |
| PM-21 | `POST /api/products/:id/images` | Upload product image to Cloudinary | `201` (or `503` if unconfigured) | Not run | Not run | |
| PM-22 | `DELETE /api/products/:id/images/:imageId` | Delete owned product image | `200` | Not run | Not run | |
| PM-23 | `PATCH /api/inventory/:variantId/adjust` | Initial stock + idempotent retry | `200`, stock = `25` on retry | Not run | Not run | |
| PM-24 | `PATCH /api/inventory/:variantId/adjust` | Conflicting `Idempotency-Key` | `409 Conflict` | Not run | Not run | |
| PM-25 | `PATCH /api/inventory/:variantId/adjust` | Negative stock attempt | `400` rejected | Not run | Not run | |
| PM-26 | `GET /api/inventory/transactions` | Inspect stock history & actor | `200`, movements listed | Not run | Not run | |
| PM-27 | `GET /api/products` & `/:slug` | Confirm public visibility & stock | `200`, no `internalNotes` | Not run | Not run | |
| PM-28 | `DELETE /api/products/:id` | Non-destructive archival | `200`, public slug -> `404` | Not run | Not run | |
