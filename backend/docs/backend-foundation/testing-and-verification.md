# Testing and Verification

## 1. Purpose and Business Problem
Before moving to **Commerce and Operations** (cart, checkout, orders, Razorpay payments), the Backend Foundation needs automated proof that validation, authentication, CSRF, RBAC, catalogue visibility, Cloudinary file guards, and transactional inventory work together reliably—plus complete OpenAPI, endpoint index, and Postman artifacts so you can manually test every API end to end.

## 2. Concepts Explained for a Beginner
- **Unit Tests (`tests/unit`):** Fast tests of pure functions and contracts (slugs, pagination, error normalization, RBAC middleware, OpenAPI/Postman route coverage) without a database.
- **Database Integration Tests (`tests/integration`):** Full HTTP requests (`supertest`) hitting Express routes, middleware, validators, services, and an isolated in-memory MongoDB (`mongodb-memory-server` and `MongoMemoryReplSet` for transactions).
- **Provider / Mocked Provider Tests (`tests/providers`):** Tests verifying our local adapters and mocked external SDKs (Cloudinary & Nodemailer SMTP) without mutating live cloud state.
- **Contract Verification:** Programmatically checking that every mounted Express route exists in `openapi.yaml`, `api-endpoint-index.md`, and `3JATA-Backend-Foundation.postman_collection.json`.

## 3. Files Created or Changed and Their Responsibilities
- `backend/tests/unit/standards.test.js`, `b1CoreUnit.test.js`, `docsAndPostmanContract.test.js` — 3 unit test suites (13 tests).
- `backend/tests/integration/standards.test.js`, `auth.test.js`, `rbacStaff.test.js`, `catalogue.test.js`, `inventory.test.js` — 5 DB/HTTP integration test suites (19 tests).
- `backend/tests/providers/email.test.js`, `cloudinary.test.js` — 2 external-provider/mocked-provider suites (5 tests).
- `backend/postman/3JATA-Backend-Foundation.postman_collection.json` — Postman Collection v2.1 covering all 45 endpoints + negative tests + ID-capture scripts.
- `backend/postman/3JATA-local.postman_environment.json` — Clean local Postman environment (no embedded secrets).
- `backend/docs/api/openapi.yaml` — OpenAPI 3.0.3 specification covering all 45 endpoints.
- `backend/docs/backend-foundation/api-endpoint-index.md` — Complete 45-endpoint reference table.
- `backend/docs/backend-foundation/manual-postman-testing.md` — 12-step beginner Postman walkthrough.
- `backend/docs/backend-foundation/manual-test-results.md` — Tracking sheet (all tests initially `Not run`).
- `backend/docs/backend-foundation/testing-and-verification.md` — This verification & handoff document.

## 4. Important Code Sections and Why They Exist
- **`tests/unit/docsAndPostmanContract.test.js`:** Extracts all 45 routes from the Express routers and asserts zero missing endpoints in `openapi.yaml`, `api-endpoint-index.md`, and `3JATA-Backend-Foundation.postman_collection.json`.
- **`tests/helpers/mongoMemory.js`:** Defaults to `mongodb-memory-server` (or `MongoMemoryReplSet` for Inventory Management transactions) so automated tests never touch your development or production MongoDB Atlas database.

## 5. Request Flow (No New Production Routes)
Testing and Verification introduces **no new HTTP endpoints**. It verifies all 45 Backend Foundation endpoints across unit, integration, provider, and Postman contract checks.

## 6. Database Fields, Indexes, and Relationships
No new database models are added here. Automated integration tests exercise `User`, `Session`, `AuthToken`, `Role`, `Permission`, `AuditLog`, `Category`, `Product`, `ProductVariant`, `Inventory`, and `InventoryTransaction`.

## 7. Design Decisions and Trade-offs
- **Isolated In-Memory MongoDB vs Live Atlas:** Automated integration tests run against `mongodb-memory-server` / `MongoMemoryReplSet` by default (overrideable via `MONGODB_TEST_URI`), guaranteeing fast, repeatable runs without mutating your development Atlas DB.

## 8. Security Rules and Edge Cases
- No live passwords, session tokens, cookies, or Atlas URIs are stored in Postman files, OpenAPI, or documentation.
- Postman tests cover negative cases: privileged registration rejection (`400`), unauthenticated `/auth/me` (`401`), customer accessing `/admin/roles` (`403`), product update attempting `stock` change (`400`), negative stock (`400`), and conflicting `Idempotency-Key` (`409`).

## 9. Exact Setup and Run Commands
```powershell
cd d:\3Jata\backend
npm run lint
npm run format:check
npm run test:unit
npm run test:providers
npm run test:integration
```
To seed and start the local server for Postman:
```powershell
npm run seed
npm run bootstrap:owner -- --name="Founder Owner" --email="owner@3jata.local" --password="<YourStrongPassword123>"
npm run dev
```

## 10. API and Postman Instructions Relevant to Testing and Verification
- Endpoint Coverage Total: **45 / 45** implemented routes covered in `3JATA-Backend-Foundation.postman_collection.json`, `openapi.yaml`, and `api-endpoint-index.md` (`0` missing).
- Follow [manual-postman-testing.md](manual-postman-testing.md) starting with `GET {{baseUrl}}/health`.

## 11. Automated Tests and Actual Results
- `npm run lint` -> **Passed** (0 errors)
- `npm run format:check` -> **Passed**
- `npm run test:unit` -> **3 suites passed, 13/13 tests passed**
- `npm run test:providers` -> **2 suites passed, 5/5 tests passed**
- `npm run test:integration` -> **5 suites passed, 19/19 tests passed**
- **Total Automated Coverage:** **10 suites passed, 37/37 tests passed**

### Live External-Provider Verification (2026-11-27)
- **Live SMTP (`EMAIL_MODE=smtp`, port 587):** `transporter.verify()` succeeded; one `[3JATA B1 Live Verification]` test email sent to the configured sender's own address was accepted by SMTP (`250 2.0.0 OK`, `acceptedCount: 1`, `rejectedCount: 0`). *(SMTP acceptance verified; inbox delivery not directly observed via IMAP.)*
- **Live Cloudinary:** Uploaded 1x1 test PNG (`verify-1795800827709`), retrieved `200 image/png`, deleted via `cloudinary.uploader.destroy` (`result: "ok"`), and verified removal via Cloudinary Admin API (`404 Not Found`; `leftoverAsset: false`).
- **Remaining Unrun Live Check:** Live MongoDB Atlas startup (`npm run seed`, `npm run bootstrap:owner`, `npm run dev`) is left for the user's local run so existing development data is not modified.

## 12. Manual Testing Status
**Not run by user.** (See [manual-test-results.md](manual-test-results.md).)

## 13. Common Errors and Fixes
- **Loopback `EACCES 127.0.0.1` inside restricted sandboxes:** Run `npm test` in your normal Windows PowerShell/terminal where `localhost` loopback sockets are allowed.

## 14. Short, Accurate Interview Explanation
"For Backend Foundation handoff, I separated our Jest suite into unit tests, isolated in-memory MongoDB/ReplicaSet integration tests, and mocked external provider tests (Cloudinary and Nodemailer), plus a contract test that verifies 100% alignment between all 45 mounted Express routes, our OpenAPI 3.0 spec, the endpoint index, and the Postman v2.1 collection."

## 15. Remaining Work and Next Step
- **Remaining Work:** User manual Postman verification ([manual-test-results.md](manual-test-results.md)), plus Commerce and Operations implementation on `feat/commerce-operations`.
- **Next Step:** Run `npm run seed`, `npm run bootstrap:owner`, and `npm run dev` in `d:\3Jata\backend`, then execute `GET {{baseUrl}}/health` in Postman!
