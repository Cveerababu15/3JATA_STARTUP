# Project Audit

## 1. Purpose and Business Problem
Before building authentication, RBAC, product catalog, and inventory for 3JATA, we must inspect the real state of the repository instead of guessing what exists. A broken startup script, empty `.env.example`, duplicate health route, or missing security defaults can silently break every feature built on top of it.

## 2. Concepts Explained for a Beginner
- **Audit:** Checking every existing file in the codebase to verify what is actually implemented, what is half-built, and what is missing.
- **Middleware Order in Express:** Express runs middleware and routes from top to bottom in the order you call `app.use(...)` or `app.get(...)`. If a `notFoundMiddleware` runs before a route, that route is unreachable dead code.
- **API Envelope:** A consistent JSON wrapper (`{ success, message, data }` or `{ success, message, errors }`) so the React frontend and Postman tests always know what shape to expect.

## 3. Verified Current-State Report (Files & Behavior Inspected)

### Git & Workspace State
- Baseline branch at audit time: `main` (`cdf5f6e feat: Setup Backend phase-1`, `83c88c9 feat: Connected the database`, `95f34c3 docs: complete project foundation documentation`).
- Pre-existing uncommitted items at audit time: modified `debug.log`, untracked root `.gitignore`, untracked `docs/00-project-context-for-ai.md`, local `backend/.env` (contains `PORT`, `NODE_ENV`, `MONGODB_URI`).
- `backend/src/models/` was **empty** — no `User` model or any other Mongoose model existed yet.
- `backend/src/services/` and `backend/src/validators/` were **empty**.
- `backend/.env.example` and `backend/docs/01-backend-foundation.md` existed as 0-byte empty files.

### Files & Behavior to Preserve
| File | Current Responsibility | Preserve? |
| --- | --- | --- |
| `backend/package.json` | CommonJS Express 5 + Mongoose 9 + `express-validator` + `helmet` + `cors` + `express-rate-limit` | Yes (extend scripts/deps) |
| `backend/src/server.js` | Connects DB then starts HTTP listener | Yes (enhance shutdown handling) |
| `backend/src/config/database.js` | Connects Mongoose to `env.mongodbUri` | Yes (add clean disconnect/readiness helpers) |
| `backend/src/constants/httpStatus.js` | Central HTTP status constants | Yes |
| `backend/src/constants/messages.js` | Standard response message strings | Yes |
| `backend/src/constants/roles.js` | 12 admin/staff role keys | Yes (add `customer` role in Roles and Staff Access) |
| `backend/src/constants/permissions.js` | Permission constants (`resource.action`) | Yes (extend for Roles/Staff & Catalogue) |
| `backend/src/utils/ApiError.js` | Operational error class | Yes (add `isOperational`) |
| `backend/src/utils/apiResponse.js` | Standard `success` and `error` envelope helpers | Yes |
| `backend/src/utils/asyncHandler.js` | Async route wrapper | Yes |
| `backend/src/routes/index.js` | Mounts `/health` under `/api` | Yes |
| `backend/src/routes/health.routes.js` | Maps `GET /` to `getHealth` | Yes |
| `backend/src/controllers/health.controller.js` | Returns `/api/health` envelope | Yes (fix hardcoded DB status in Backend Standards) |
| `backend/src/middleware/validate.middleware.js` | Formats `express-validator` errors | Yes |
| `backend/src/middleware/notFound.middleware.js` | JSON 404 envelope | Yes |
| `backend/src/middleware/rateLimit.middleware.js` | API rate limiter | Yes (tune & add auth limiters) |

### Security & Correctness Gaps Found
1. **Duplicate / Unreachable Health Handler (`backend/src/app.js`):** An inline `app.get("/api/health", ...)` existed *after* `notFoundMiddleware` and `errorMiddleware`. **Fixed during Project Audit** while preserving `/api/health` via `src/routes/index.js`.
2. **Hardcoded Health Status (`health.controller.js`):** Returned `database: "connected"` regardless of `mongoose.connection.readyState`.
3. **Permissive CORS (`app.js`):** `cors()` had no origin whitelist or `credentials: true` for cookie sessions.
4. **No Request Body Size Limits / Cookie Parser (`app.js`):** `express.json()` had no explicit size cap and `cookie-parser` was not installed.
5. **No Environment Validation (`config/env.js`):** Missing `MONGODB_URI` or auth secrets was not caught at startup; `dotenv.config()` relied on current working directory instead of resolving `backend/.env`.
6. **Stack/Internal Error Handling (`error.middleware.js`):** Did not normalize Mongoose `CastError`, `ValidationError`, duplicate key (`11000`), or invalid JSON errors, or distinguish operational vs unexpected 500 errors in production.
7. **No Request Correlation (`requestLogger.middleware.js`):** Logged only in `development` without a request ID (`X-Request-Id`).
8. **Empty `.env.example`:** Developers cloning the repo had no template of required env vars.
9. **No Test/Lint/Format Scripts:** `backend/package.json` lacked `test`, `lint`, and `format` scripts.
10. **No Auth, RBAC, Catalogue, or Inventory Models/Routes:** `models/`, `services/`, `validators/` were completely empty.

### Backend Foundation Checklist
- [x] **Project Audit:** Audit existing repo, document gaps, remove duplicate health handler in `app.js`.
- [x] **Backend Standards:** Env validation, error handling, standard responses, CORS/security/limits, request correlation, pagination/filter conventions, real DB health check, `.env.example`, lint/format/test setup.
- [x] **Authentication:** User, Session, and AuthToken models, password hashing, register/login/logout/me/change-password/forgot-reset/email-verify, HttpOnly cookie + CSRF strategy, mail adapter.
- [x] **Roles and Staff Access:** Roles & permissions DB models, idempotent seeds, local owner bootstrap CLI, auth & permission middleware, owner-authorized staff management, audit trail.
- [x] **Product Catalogue:** Category, Product, ProductVariant models, slug/SKU uniqueness, integer paise money convention, public & management APIs, Cloudinary upload/delete.
- [x] **Inventory Management:** Inventory & InventoryTransaction models, transactional stock adjustments with reason & idempotency, low-stock & movement history APIs.
- [x] **Testing and Verification:** Unit, DB integration, and provider tests, OpenAPI spec, Postman collection/environment, manual test guide & results sheet.

## 4. Files Created or Changed in Project Audit
- `backend/src/app.js` — Removed the unreachable duplicate `app.get("/api/health", ...)` defined after `errorMiddleware`.
- `backend/docs/backend-foundation/README.md` — Created Backend Foundation docs index.
- `backend/docs/backend-foundation/project-audit.md` — Created this audit report.
- `docs/progress.md` — Created implementation tracking log.
- `docs/decisions.md` — Created technical decision log.

## 5. Important Code Sections and Why They Exist
In `backend/src/app.js`:
```js
// API routes
app.use("/api", apiRoutes);

// Unknown route handler
app.use(notFoundMiddleware);

// Global error handler
app.use(errorMiddleware);
```
`apiRoutes` (`src/routes/index.js`) already mounts `router.use("/health", healthRoutes)`, so removing the duplicate handler below `errorMiddleware` eliminates dead code and avoids confusing future developers.

## 6. Request Flow (Health Route)
`GET /api/health` -> `helmet` -> `cors` -> `express.json` -> `requestLogger` -> `apiRateLimiter` -> `apiRoutes (/api)` -> `healthRoutes (/health)` -> `healthController.getHealth` -> `200 JSON`.

## 7. Database Fields, Indexes, and Relationships
No database collections or Mongoose models were created in Project Audit itself (`backend/src/models/` was populated in Authentication onward).

## 8. Design Decisions and Trade-offs
- **API Base Path:** `/api` (preserved from existing `app.use("/api", apiRoutes)` and `docs/08-api-modules.md`).
- **Response Conventions:**
  - Success: `{ "success": true, "message": "...", "data": ... }`
  - Paginated List: `{ "success": true, "message": "...", "data": { "items": [], "pagination": { "page": 1, "limit": 12, "total": 0, "totalPages": 0 } } }`
  - Error: `{ "success": false, "message": "...", "errors": [] }`
- **Validation Library:** Keep `express-validator` (already installed and wired) rather than introducing a second validator.

## 9. Security Rules and Edge Cases
- Never commit `backend/.env` or print `MONGODB_URI`, passwords, tokens, or cookies in logs or docs.
- Never assume `docs/00-project-context-for-ai.md` is 100% current: it pre-dated commits `83c88c9` and `cdf5f6e` which already created `routes/`, `controllers/`, `middleware/`, `utils/`, and `constants/`.

## 10. Exact Setup and Run Commands
From `d:\3Jata\backend`:
```powershell
cd d:\3Jata\backend
npm install
# Ensure backend/.env has valid PORT, NODE_ENV, MONGODB_URI
npm run dev
```

## 11. API and Postman Instructions Relevant to Project Audit
- Baseline route: `GET http://localhost:5000/api/health`
- Expected status: `200 OK`
- Expected body:
```json
{
  "success": true,
  "message": "Server is healthy",
  "data": {
    "database": "connected"
  }
}
```
*(Full Postman collection and environment files live in `backend/postman/`.)*

## 12. Automated Tests and Actual Results
- Verified Node (`v22.15.0`) and npm (`10.9.2`) in workspace.
- Inspected all 15 baseline files under `backend/src/` and confirmed `app.js` no longer has the duplicate health handler.
- Subsequent test suites in Backend Standards through Testing and Verification verify runtime behavior across all 45 endpoints.

## 13. Manual Testing Status
**Not run by user.**

## 14. Common Errors and Fixes
- **`MongoDB connection failed: bad auth`:** Check username/password in `backend/.env` `MONGODB_URI`, URL-encode special characters in password (`@`, `:`, `/`, `?`, `#`), and ensure your IP is allowed in MongoDB Atlas Network Access.
- **`.env` not loaded when running from repo root:** `env.js` now resolves `backend/.env` regardless of working directory.

## 15. Short, Accurate Interview Explanation
"Before adding new features to the 3JATA Express backend, I audited the existing codebase to verify the real entry points, middleware order, dependencies, and gaps. I found that the foundation skeleton already existed with Express 5, Mongoose 9, and `express-validator`, but had an unreachable duplicate `/api/health` handler after the global error middleware, an empty `.env.example`, no env validation, unconfigured CORS, and empty `models/`, `services/`, and `validators/` directories. I fixed the duplicate health handler and documented the baseline API envelope and roadmap."

## 16. Remaining Work and Next Step
- **Next Step:** See [Backend Standards](backend-standards.md).
