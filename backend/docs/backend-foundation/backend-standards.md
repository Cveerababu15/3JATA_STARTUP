# Backend Standards

## 1. Purpose and Business Problem
Before implementing user accounts, products, and stock updates, every API endpoint needs shared guardrails: startup environment validation, consistent JSON success/error envelopes, safe error handling without leaking database internals or stack traces, request size limits, CORS rules, rate limits, request correlation IDs, and safe query/pagination helpers.

## 2. Concepts Explained for a Beginner
- **Environment Validation:** Failing fast at startup when required settings (like `MONGODB_URI`) are missing, instead of crashing randomly later.
- **Error Normalization:** Converting messy database or syntax errors (like MongoDB `11000` duplicate key or Mongoose `CastError`) into clean, predictable `409` or `400` JSON responses.
- **Request Correlation (`X-Request-Id`):** Attaching a unique ID to every request and response header so you can trace logs for one Postman call easily.
- **Allowlisted Query Construction:** Never passing raw `req.query` directly into `Model.find(req.query)` or `.sort(req.query.sort)`, because attackers could send MongoDB operators like `$ne` or `$where`.

## 3. Files Created or Changed and Their Responsibilities
- `backend/src/config/env.js` — Resolves `backend/.env`, parses typed config, exports `validateEnv()`.
- `backend/src/config/database.js` — Exports `connectDatabase`, `disconnectDatabase`, `getDatabaseState`, `isDatabaseConnected`.
- `backend/src/constants/httpStatus.js` — Added `413`, `422`, and `503`.
- `backend/src/constants/messages.js` — Added `BAD_REQUEST` and `TOO_MANY_REQUESTS`.
- `backend/src/utils/ApiError.js` — Added `isOperational` flag.
- `backend/src/utils/apiResponse.js` — Added `paginated(res, message, items, pagination, statusCode)`.
- `backend/src/utils/queryFeatures.js` — Added `parsePagination`, `buildPaginationMeta`, `parseSort`, `escapeRegex`, `isValidObjectId`.
- `backend/src/middleware/requestId.middleware.js` — Generates or validates `X-Request-Id` and echoes it on responses.
- `backend/src/middleware/requestLogger.middleware.js` — Logs structured JSON without query strings, bodies, or auth cookies.
- `backend/src/middleware/validate.middleware.js` — Formats `express-validator` errors into `[{ field, message }]`.
- `backend/src/middleware/rateLimit.middleware.js` — Configures `apiRateLimiter` and `authRateLimiter`.
- `backend/src/middleware/error.middleware.js` — Normalizes Express/Mongoose/Multer/CORS errors and hides stack traces in responses.
- `backend/src/controllers/health.controller.js` — Reports live Mongoose `readyState` on `/api/health` and `503` readiness on `/api/health/ready`.
- `backend/src/routes/health.routes.js` — Added `GET /ready`.
- `backend/src/app.js` — Configured `requestId`, `helmet`, allowlisted `cors` with `credentials: true`, `express.json` limit, `cookieParser`, `requestLogger`, and rate limiting.
- `backend/src/server.js` — Validates env on boot and adds graceful `SIGINT`/`SIGTERM` shutdown.
- `backend/.env.example` — Populated full template of Backend Foundation environment variable names.
- `backend/eslint.config.js`, `backend/.prettierrc`, `backend/jest.config.js`, `backend/package.json` — Added lint, format, and Jest test tooling.
- `backend/tests/setupEnv.js`, `backend/tests/unit/standards.test.js`, `backend/tests/integration/standards.test.js` — Unit and HTTP tests for Backend Standards.

## 4. Important Code Sections and Why They Exist
- **CORS Origin Check (`app.js`):** Allows requests with no `Origin` header (Postman, curl) and checks browser `Origin` against `env.corsOrigins` with `credentials: true` so HttpOnly cookies work from the React apps.
- **Query Safety (`utils/queryFeatures.js`):** `parsePagination` caps `limit` at `100` to prevent memory exhaustion, and `parseSort` resolves sort strings only through an explicit map.

## 5. Request Flow
`Request` -> `requestIdMiddleware` -> `helmet` -> `cors` -> `express.json(limit)` -> `cookieParser` -> `requestLogger` -> `apiRateLimiter` -> `/api` routes -> `notFoundMiddleware` -> `errorMiddleware`.

## 6. Database Fields, Indexes, and Relationships
No database collections are introduced in Backend Standards.

## 7. Design Decisions and Trade-offs
- **Unit vs Integration Env Isolation:** `env.js` skips reading `.env` when `NODE_ENV=test` and `validateEnv()` runs in `server.js` rather than at module import time, so unit tests run cleanly without Atlas credentials.
- **Separate Liveness and Readiness:** `GET /api/health` always returns `200` with actual `database` status while `GET /api/health/ready` returns `503` when MongoDB is disconnected (and `200` when connected).

## 8. Security Rules and Edge Cases
- Never log `req.body`, `Cookie`, `Set-Cookie`, `Authorization`, or query parameters (tokens in query strings are stripped from logs).
- `errorMiddleware` suppresses non-operational error details in `production` and never emits `err.stack` in HTTP responses.

## 9. Exact Setup and Run Commands
```powershell
cd d:\3Jata\backend
npm install
npm run lint
npm run format:check
npm test
```

## 10. API and Postman Instructions Relevant to Backend Standards
- `GET http://localhost:5000/api/health` -> `200 OK` with `database` state (`"connected"` when DB is up) and `X-Request-Id` response header.
- `GET http://localhost:5000/api/health/ready` -> `200 OK` when connected, `503 Service Unavailable` if DB is disconnected.
- `GET http://localhost:5000/api/unknown-route` -> `404 Not Found` JSON error envelope.

## 11. Automated Tests and Actual Results
- `npm run lint` -> Passed (0 errors).
- `npm run format:check` -> Passed.
- `tests/unit/standards.test.js`: **5/5 passed**.
- `tests/integration/standards.test.js`: **5/5 passed**.

## 12. Manual Testing Status
**Not run by user.**

## 13. Common Errors and Fixes
- **`CORS origin not allowed` (403):** Add your frontend URL (e.g. `http://localhost:5173`) to `CORS_ORIGINS` in `backend/.env`.
- **`PayloadTooLargeError` (413):** JSON bodies over `JSON_BODY_LIMIT` (`100kb` default) are rejected intentionally.

## 14. Short, Accurate Interview Explanation
"I hardened the Express 5 foundation with startup environment validation, structured logging with `X-Request-Id` correlation, strict CORS with credentials, body size limits, rate limiters, normalized error handling that translates Mongoose errors without leaking stacks, and safe pagination/sort utilities."

## 15. Remaining Work and Next Step
- **Next Step:** See [Authentication](authentication.md).
