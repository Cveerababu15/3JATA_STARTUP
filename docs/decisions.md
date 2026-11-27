# 3JATA Backend Technical Decisions

This log records material technical decisions made during the Backend Foundation so future developers understand both **what** was chosen and **why**.

---

## DEC-001: Keep CommonJS and Modular Monolith Architecture
- **Context:** `backend/` uses Node.js 22 with CommonJS (`require`/`module.exports`), Express 5, and Mongoose 9. Frontend uses React/Vite.
- **Decision:** Retain CommonJS and the `routes -> middleware -> validators -> controllers -> services -> models` modular monolith layout in `backend/src/`.
- **Trade-offs:** Avoids unnecessary migration churn and preserves compatibility with existing foundation files. Can be modularized further only when scale requires.

## DEC-002: Validation Library — `express-validator`
- **Context:** `express-validator` (`^7.3.2`) is already installed in `backend/package.json` and wired into `backend/src/middleware/validate.middleware.js`.
- **Decision:** Standardize on `express-validator` across all Backend Foundation validators rather than adding another validation library.
- **Trade-offs:** Keeps dependencies minimal and matches existing middleware. Schema builders must explicitly whitelist allowed fields (`body(...)` + explicit field extraction) to prevent mass assignment.

## DEC-003: API Base Path and Standard Envelope
- **Context:** Existing routes mount under `/api`, and `utils/apiResponse.js` + `middleware/error.middleware.js` return `{ success, message, data }` or `{ success, message, errors }`.
- **Decision:** Keep `/api` as the API base path (`baseUrl` in Postman includes `/api`, or `http://localhost:5000/api`) and keep the `{ success, message, data }` / `{ success, message, errors }` envelope everywhere, with `{ items, pagination }` inside `data` for paginated lists.
- **Trade-offs:** Consistent contract for frontend TanStack Query hooks and Postman scripts.

## DEC-004: Lint, Format, and Test Stack (ESLint 10, Prettier, Jest, Supertest, mongodb-memory-server)
- **Context:** `backend/` had no lint, formatting, or test runner scripts.
- **Decision:** Use Jest + Supertest + `mongodb-memory-server` for isolated unit and DB integration tests, plus ESLint 10 flat config and Prettier.
- **Trade-offs:** `mongodb-memory-server` keeps tests fast and guarantees zero accidental writes to the developer's Atlas cluster. `supertest` loopback tests run outside restricted Windows AppContainer sandboxes.

## DEC-005: Liveness vs Readiness Health Endpoints
- **Context:** `GET /api/health` previously hardcoded `database: "connected"`.
- **Decision:** `GET /api/health` reports real `mongoose.connection.readyState` with HTTP `200`, and `GET /api/health/ready` returns `200` when connected or `503` when disconnected.
- **Trade-offs:** Preserves backwards compatibility for `/api/health` while giving deployment platforms a strict readiness probe.

## DEC-006: Authentication Strategy — Opaque HttpOnly Cookie Sessions + Per-Session CSRF + Hashed Single-Use Tokens
- **Context:** The backend serves React web apps (customer storefront and admin portal) and is tested manually in Postman. Authentication requires session expiry, immediate revocation on logout/password-change/reset/suspension/role-change, and CSRF protection.
- **Decision:**
  1. **Password Hashing:** `bcryptjs` with configurable rounds (`12` in dev/prod, `4` in automated tests).
  2. **Session Storage:** Generate a 32-byte CSPRNG opaque token, store only its SHA-256 `tokenHash` in the MongoDB `Session` collection with an `expiresAt` TTL index, and send the raw token in an `HttpOnly` cookie (`3jata_sid`).
  3. **Cookie Settings (Dev vs Prod):**
     - Development (`NODE_ENV=development`): `httpOnly: true`, `secure: false` (works on `http://localhost`), `sameSite: "lax"`.
     - Production (`NODE_ENV=production`): `httpOnly: true`, `secure: true` (HTTPS only), `sameSite: "lax"` (or `"none"` if storefront/admin are hosted on a separate origin with HTTPS).
  4. **CSRF Protection:** Each `Session` stores a 32-byte `csrfToken`. On login, the backend sets a readable `3jata_csrf` cookie (`httpOnly: false`) and returns `csrfToken` in the JSON payload. Every authenticated state-changing request (`POST`, `PUT`, `PATCH`, `DELETE`) must send `X-CSRF-Token` matching both the `3jata_csrf` cookie and `session.csrfToken`.
  5. **Postman Handling:** Postman's built-in cookie jar automatically stores and sends `3jata_sid` and `3jata_csrf` for `localhost`. A Postman test script on login captures `csrfToken` into `{{csrfToken}}` for write requests. No Bearer tokens are used.
  6. **Verification & Reset Tokens:** `AuthToken` stores SHA-256 hashes of 32-byte random tokens with purpose (`email_verification` 24h, `password_reset` 30m), `expiresAt` TTL index, and atomic `usedAt` single-use enforcement.
  7. **Email Delivery:** `email.service.js` supports live SMTP via `nodemailer` (`EMAIL_MODE=smtp`) and a clearly labeled local development adapter (`EMAIL_MODE=local`) that writes email previews to `backend/tmp/local-emails/` without ever returning raw tokens in API responses.
- **Trade-offs:** Stateful MongoDB sessions add one indexed lookup per authenticated request, which is fast and gives instant server-side revocation for logout, password changes, role updates, and user suspension.

## DEC-007: Canonical Money Representation (Integer Paise)
- **Context:** Product variants store prices and MRPs, and Commerce and Operations integrates Razorpay (which uses integer paise). JavaScript floats suffer from binary rounding errors (`0.1 + 0.2 !== 0.3`).
- **Decision:** Store and accept variant prices as positive integers in paise (`pricePaise`, `mrpPaise`, `currency: "INR"`, minimum `100` paise = INR 1.00).
- **Trade-offs:** Avoids all floating-point arithmetic bugs and aligns directly with Razorpay. Frontend formats `pricePaise / 100` for display.

## DEC-008: Jest Test Environment Compatibility with MongoDB Driver 7 / BSON
- **Context:** MongoDB Node driver 7.6 resolves `os` via dynamic `import("os")` unless `runtimeAdapters.os` is passed, which fails inside Jest's default CJS VM context.
- **Decision:** Provide `runtimeAdapters: { os: require("os") }` in `tests/helpers/mongoMemory.js` and unify `Uint8Array`/`ArrayBuffer`/`Map` in `tests/helpers/jestNodeEnv.js`.
- **Trade-offs:** Keeps Jest + Supertest + `mongodb-memory-server` running cleanly in standard CommonJS without experimental VM flags.

## DEC-009: Inventory Source of Truth, Replica-Set Transactions, and Idempotency
- **Context:** Product updates must not alter stock, and concurrent or retried stock adjustments must stay consistent with movement history.
- **Decision:** Keep `Inventory` (one document per `ProductVariant`) as the sole source of truth initialized at `0`, require Mongoose replica-set transactions wrapping `Inventory` `$inc` + `InventoryTransaction` + `AuditLog` writes (failing closed with `503 Service Unavailable` on unsupported standalone MongoDB deployments rather than falling back to unsafe non-transactional writes), and enforce `Idempotency-Key` via a unique sparse index.
- **Trade-offs:** Requires a replica set (standard on MongoDB Atlas and `MongoMemoryReplSet` in tests) and guarantees stock and movement history can never diverge on failed writes.
