# Inventory Management

## 1. Purpose and Business Problem
Stock accuracy is critical for an organic food store: two concurrent updates must never overwrite each other, negative stock must never be allowed, and every change (opening stock, supplier restock, damaged/expired stock, manual audit) must leave an immutable history record showing who changed it and why.

## 2. Concepts Explained for a Beginner
- **Single Source of Truth:** Stock lives only in the `Inventory` collection (one document per `ProductVariant`). Product/variant update routes forbid editing stock directly.
- **ACID Transaction:** A MongoDB transaction wraps the `Inventory` quantity update, the `InventoryTransaction` history write, and the `AuditLog` write so either all three succeed together or all three roll back on failure.
- **Idempotency Key:** Sending an `Idempotency-Key` header (e.g. a UUID) lets a client safely retry a timed-out stock adjustment request without accidentally adding or subtracting stock twice.
- **Replica-Set Requirement:** Multi-document MongoDB transactions require a **replica set** (which MongoDB Atlas provides automatically). On unsupported standalone deployments without a replica set, `adjustStock` refuses the write with `503 Service Unavailable` rather than silently running an unsafe non-transactional fallback that could leave stock and movement history inconsistent.

## 3. Files Created or Changed and Their Responsibilities
- `backend/src/models/Inventory.model.js` — Canonical stock per variant (`variant` unique, `quantity`, `reservedQuantity`, `lowStockThreshold`, `updatedBy`).
- `backend/src/models/InventoryTransaction.model.js` — Immutable stock movement ledger (`type`, `quantityDelta`, `previousQuantity`, `newQuantity`, `reason`, `reference`, sparse unique `idempotencyKey`, `performedBy`).
- `backend/src/services/inventory.service.js` — Atomic conditional updates, Mongoose transactions, idempotency replay/conflict handling, low-stock queries, and history listing.
- `backend/src/validators/inventory.validator.js` — Validates `type`, non-zero integer `quantityDelta`, required `reason`, optional `reference`/`idempotencyKey`.
- `backend/src/controllers/inventory.controller.js` — Thin HTTP handlers reading `Idempotency-Key` header or body.
- `backend/src/routes/inventory.routes.js` & `routes/index.js` — Permission-gated routes under `/api/inventory`.
- `backend/src/services/product.service.js` — Ensures `Inventory` model registration so newly created variants initialize at `quantity: 0`.
- `backend/tests/integration/inventory.test.js` — Replica-set integration tests for permissions, starting stock, negative-stock guards, threshold updates, idempotency, concurrency, rollback on failed write, and `503` fail-closed behavior on unsupported standalone deployments.

## 4. Important Code Sections and Why They Exist
- **Atomic Conditional Deduction (`inventory.service.js`):**
  ```js
  updateFilter.$expr = {
    $gte: [{ $add: ["$quantity", quantityDelta] }, "$reservedQuantity"],
  };
  ```
  Prevents concurrent deductions from ever pushing `quantity` below `reservedQuantity` or zero.
- **Starting Stock Creation:** Creating a variant initializes `Inventory` at `quantity: 0`. Adding opening stock happens via `PATCH /api/inventory/:variantId/adjust` with `type: "initial_stock"` and a required reason so every unit has a full audit trail from `0`.

## 5. Request Flow
`PATCH /api/inventory/:variantId/adjust` -> `authenticate` -> `requireCsrf` -> `requirePermission("inventory.adjust")` -> `adjustStockValidator` -> `validate` -> `inventoryController.adjustStock` -> `inventoryService.adjustStock` (MongoDB transaction: idempotency check -> atomic `$inc` -> `InventoryTransaction.create` -> `AuditLog.create`) -> `200 JSON`.

## 6. Database Fields, Indexes, and Relationships
- `Inventory`: unique `{ variant: 1 }` referencing `ProductVariant`, compound `{ quantity: 1, lowStockThreshold: 1 }`.
- `InventoryTransaction`: `{ variant: 1, createdAt: -1 }`, `{ createdAt: -1 }`, unique sparse `{ idempotencyKey: 1 }`.

## 7. Design Decisions and Trade-offs
- **Deferred to Commerce and Operations:** Checkout stock reservations (`reservedQuantity` mutations) and payment-driven deductions belong to Commerce and Operations orders/payments.
- **Direction Enforcement:** `initial_stock`, `stock_received`, and `return` require positive `quantityDelta`; `damaged` and `expired` require negative `quantityDelta`; `manual_adjustment` accepts any non-zero integer.

## 8. Security Rules and Edge Cases
- Readers require `inventory.read`; adjustments and threshold updates require `inventory.adjust` + `X-CSRF-Token`.
- Reusing an `Idempotency-Key` with different variant, type, delta, or reason returns `409 Conflict`.
- Archived variants cannot be adjusted.

## 9. Exact Setup and Run Commands
- MongoDB Atlas clusters are replica sets by default, so transactions work out of the box.
- Run tests (starts an in-memory `MongoMemoryReplSet` automatically):
  `cd d:\3Jata\backend && npm test`

## 10. API and Postman Instructions Relevant to Inventory Management
- `GET /api/inventory` (`inventory.read`)
- `GET /api/inventory/low-stock` (`inventory.read`)
- `GET /api/inventory/transactions` (`inventory.read`)
- `GET /api/inventory/:variantId` (`inventory.read`)
- `PATCH /api/inventory/:variantId/adjust` (`inventory.adjust` + `X-CSRF-Token`, optional `Idempotency-Key` header)
- `PATCH /api/inventory/:variantId/threshold` (`inventory.adjust` + `X-CSRF-Token`)

## 11. Automated Tests and Actual Results
- `tests/integration/inventory.test.js`: **3/3 passed** against `MongoMemoryReplSet` (permissions & starting stock & threshold & low stock, idempotency replay & 409 conflict, 5 concurrent adjustments + simulated transaction write-failure rollback + `503` standalone fail-closed check).

## 12. Manual Testing Status
**Not run by user.**

## 13. Common Errors and Fixes
- **`400 Insufficient available stock`:** Check current `availableQuantity` via `GET /api/inventory/:variantId` before deducting.
- **`409 Idempotency-Key was already used with different adjustment parameters`:** Generate a fresh UUID/key for each distinct stock adjustment.
- **`503 Inventory adjustments require a MongoDB replica set`:** Ensure your local or cloud MongoDB is running as a replica set (MongoDB Atlas is a replica set by default).

## 14. Short, Accurate Interview Explanation
"I made `Inventory` the single source of truth per variant, completely isolated from product updates. Every stock change runs through `inventory.service.js` inside a mandatory MongoDB replica-set transaction using an atomic conditional `$inc` guard to prevent negative stock, writing an immutable `InventoryTransaction` and `AuditLog` with `Idempotency-Key` retry protection."

## 15. Remaining Work and Next Step
- **Next Step:** See [Testing and Verification](testing-and-verification.md).
