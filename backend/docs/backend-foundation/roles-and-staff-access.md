# Roles and Staff Access

## 1. Purpose and Business Problem
3JATA separates customer shopping accounts from internal staff accounts. Staff members should follow the **principle of least privilege** (e.g. a Product Manager manages products, not refunds or staff roles), while the Super Admin / Owner retains full control over staff provisioning, role assignments, and account suspension without accidentally locking out the last owner.

## 2. Concepts Explained for a Beginner
- **RBAC (Role-Based Access Control):** Users are assigned a **Role** (e.g., `product_manager`), and each Role has a curated list of **Permissions** (`products.read`, `products.create`, etc.). Route middleware checks the user's permissions on the backend.
- **Idempotent Seeding:** Running `npm run seed` multiple times updates or creates the exact same 13 roles and permissions without creating duplicates.
- **Owner Bootstrap:** Instead of committing a hardcoded admin password in source code, `npm run bootstrap:owner` creates the initial `super_admin` from local CLI flags, environment variables, or interactive prompts.
- **Audit Trail:** Sensitive operations (staff creation, role changes, suspensions, product/inventory changes) write an immutable `AuditLog` record showing who did what and when.

## 3. Files Created or Changed and Their Responsibilities
- `backend/src/constants/roles.js` — Added `customer` alongside the 12 staff role slugs.
- `backend/src/constants/permissions.js` — Full `resource.action` permission catalog (categories, products, inventory, orders, shipping, coupons, payments, refunds, staff, roles, audit logs, etc.).
- `backend/src/constants/rolePermissions.js` — Canonical role-to-permission mapping for `customer` (empty permissions) and all 12 staff roles.
- `backend/src/models/Permission.model.js`, `Role.model.js`, `AuditLog.model.js` — Mongoose schemas and indexes.
- `backend/src/services/audit.service.js` — `recordAudit(...)` helper.
- `backend/src/utils/seedRoles.js` & `backend/src/scripts/seed.js` — Idempotent role/permission seed (`npm run seed`).
- `backend/src/scripts/bootstrapOwner.js` — Secure local owner bootstrap CLI (`npm run bootstrap:owner`).
- `backend/src/middleware/permission.middleware.js` — `requireStaff`, `requirePermission`, `requireAnyPermission`.
- `backend/src/services/staff.service.js`, `validators/staff.validator.js`, `controllers/staff.controller.js`, `routes/admin.routes.js` — Admin staff, role, permission, and audit log APIs under `/api/admin`.
- `backend/src/routes/index.js` & `backend/package.json` — Mounted `/admin` and added `seed` & `bootstrap:owner` scripts.
- `backend/tests/integration/rbacStaff.test.js` — Integration tests for seeding, RBAC isolation, staff CRUD, session revocation, last-owner guard, self-suspension guard, and audit trail.

## 4. Important Code Sections and Why They Exist
- **Assignable Role Guard (`staff.service.js` -> `resolveAssignableStaffRole`):** Ensures referenced roles exist, are active, and have `isStaffRole === true` (so a staff account cannot be assigned the `customer` role).
- **Privilege Escalation Guard (`assertCanManageSuperAdmin`):** Only an active `super_admin` can create, edit, role-change, or suspend a `super_admin`.
- **Last Active Owner Guard (`assertNotLastActiveOwner`):** Blocks demoting or suspending the sole remaining active `super_admin`.
- **Session Revocation on Role Change / Suspension:** Calls `revokeUserSessions(staffId, ...)` immediately so old cookies cannot keep stale permissions.

## 5. Request Flow
`Request` -> `authenticate` (validates active session + user status + loads role permissions) -> `requireCsrf` (for writes) -> `requirePermission("...")` -> `validator` -> `validate` -> `staffController` -> `staffService` + `auditService`.

## 6. Database Fields, Indexes, and Relationships
- `Permission`: unique `{ code: 1 }`, compound `{ resource: 1, action: 1 }`.
- `Role`: unique `{ slug: 1 }`, `{ isStaffRole: 1, isActive: 1 }`, `permissions: [ObjectId -> Permission]`.
- `AuditLog`: `{ actor: 1 }`, `{ action: 1 }`, `{ resourceType: 1 }`, `{ resourceId: 1 }`, `{ createdAt: -1 }`.

## 7. Documented Role-Permission Mappings
| Role Slug | Staff Role? | Permissions Summary |
| --- | --- | --- |
| `customer` | No | **None (`[]`)** — zero admin permissions |
| `super_admin` | Yes | All system permissions |
| `product_manager` | Yes | `categories.*`, `products.*` |
| `inventory_manager` | Yes | `inventory.read`, `inventory.adjust`, `products.read` |
| `order_manager` | Yes | `orders.read`, `orders.update`, `orders.cancel`, `customers.read` |
| `shipping_fulfilment_manager` | Yes | `orders.read`, `shipping.read`, `shipping.update` |
| `marketing_manager` | Yes | `coupons.*`, `products.read` |
| `finance_manager` | Yes | `payments.read`, `refunds.read`, `refunds.create`, `orders.read`, `analytics.read` |
| `customer_support` | Yes | `tickets.read`, `tickets.update`, `orders.read`, `customers.read`, `refunds.read` |
| `content_seo_manager` | Yes | `content.*`, `products.read` |
| `ai_manager` | Yes | `ai.*`, `products.read` |
| `analyst` | Yes | Read-only: `analytics.read`, `orders.read`, `products.read`, `inventory.read`, `payments.read`, `customers.read` |
| `procurement_supplier_manager` | Yes | `suppliers.read`, `suppliers.create`, `suppliers.update`, `inventory.read` |

## 8. Design Decisions and Trade-offs
- **No Arbitrary Permission Editor:** Roles and permissions are seeded from `rolePermissions.js` and assigned to staff via `/api/admin/staff/:id/role`, avoiding risky runtime permission tampering.
- **Limited Staff Output:** `formatStaffSummary` returns only account metadata (`id`, `name`, `email`, `userType`, `status`, `role`, timestamps), never password hashes or session tokens.

## 9. Exact Setup and Run Commands
```powershell
cd d:\3Jata\backend
npm run seed
npm run bootstrap:owner -- --name="Owner Name" --email="owner@3jata.local" --password="<YourStrongPassword>"
```
*(Or run `npm run bootstrap:owner` without flags to enter values interactively.)*

## 10. API and Postman Instructions Relevant to Roles and Staff Access
- `GET /api/admin/roles` (`roles.read`)
- `GET /api/admin/permissions` (`roles.read`)
- `GET /api/admin/staff` (`staff.read`)
- `POST /api/admin/staff` (`staff.create` + `X-CSRF-Token`)
- `GET /api/admin/staff/:id` (`staff.read`)
- `PATCH /api/admin/staff/:id` (`staff.update` + `X-CSRF-Token`)
- `PATCH /api/admin/staff/:id/role` (`roles.manage` + `X-CSRF-Token`)
- `PATCH /api/admin/staff/:id/status` (`staff.update` + `X-CSRF-Token`)
- `GET /api/admin/audit-logs` (`audit_logs.read`)

## 11. Automated Tests and Actual Results
- `tests/integration/rbacStaff.test.js`: **3/3 passed** (idempotent role seeding + zero customer permissions, customer/staff 403 enforcement, roles/permissions/staff CRUD & search, owner staff provisioning + role validation + session revocation on role change & suspension + reactivation + self-suspension/last-owner protection + audit log endpoint verification).

## 12. Manual Testing Status
**Not run by user.**

## 13. Common Errors and Fixes
- **`403 Forbidden` when calling `/api/admin/*` as a customer:** Customers have `userType: "customer"` and zero permissions. Log in as the bootstrapped `super_admin` owner.
- **`Cannot remove or suspend the last active owner`:** Provision a second active `super_admin` before demoting or suspending the first.

## 14. Short, Accurate Interview Explanation
"I implemented DB-backed RBAC with idempotent role/permission seeding, a zero-default-password CLI bootstrap for the initial owner, permission middleware enforcing least privilege, owner-authorized staff management with privilege-escalation and last-owner guards, immediate session revocation on role/status changes, and an immutable `AuditLog` trail."

## 15. Remaining Work and Next Step
- **Next Step:** See [Product Catalogue](product-catalogue.md).
