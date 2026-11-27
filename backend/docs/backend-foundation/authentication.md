# Authentication

## 1. Purpose and Business Problem
Customers and staff need secure accounts so shoppers can browse/manage their own accounts and staff can administer 3JATA safely. Weak password storage, exposed tokens, missing session revocation, or CSRF vulnerabilities would let attackers hijack accounts or escalate privileges.

## 2. Concepts Explained for a Beginner
- **Password Hashing (`bcryptjs`):** Instead of storing passwords in plaintext, we run a slow one-way cryptographic hash with a per-password salt. Even if the database leaks, attackers cannot read the passwords.
- **HttpOnly Session Cookie:** A cookie (`3jata_sid`) marked `HttpOnly` cannot be read by JavaScript in the browser (`document.cookie`), protecting sessions against XSS attacks.
- **CSRF Protection (`X-CSRF-Token`):** Because browsers send cookies automatically on cross-site requests, write requests (`POST`, `PATCH`, `DELETE`) also require a matching `X-CSRF-Token` header that an attacker's website cannot read.
- **Single-Use Hashed Tokens:** Verification and password-reset tokens are stored as SHA-256 hashes with an expiry timestamp and `usedAt` lock so each link works only once.

## 3. Files Created or Changed and Their Responsibilities
- `backend/src/models/User.model.js` — User schema (`name`, `email`, `passwordHash` with `select: false`, `userType`, `role`, `status`, `isEmailVerified`, timestamps, indexes).
- `backend/src/models/Session.model.js` — Server-side session schema storing SHA-256 `tokenHash`, per-session `csrfToken`, `expiresAt` TTL index, and `revokedAt`/`revokedReason`.
- `backend/src/models/AuthToken.model.js` — Single-use `email_verification` and `password_reset` token schema with SHA-256 `tokenHash` and TTL index.
- `backend/src/utils/crypto.js` — CSPRNG token generator, SHA-256 hashing, and constant-time comparison (`crypto.timingSafeEqual`).
- `backend/src/services/email.service.js` — Configurable `nodemailer` SMTP sender (`EMAIL_MODE=smtp`), `verifySmtpConnection()`, and clearly labeled **local development adapter** (`EMAIL_MODE=local`) saving email previews to `backend/tmp/local-emails/`.
- `backend/src/services/auth.service.js` — Business rules for customer registration, verification, resend, login, logout, password change, and password reset.
- `backend/src/middleware/auth.middleware.js` — `authenticate` (validates cookie session, active user status, attaches `req.user` & `req.permissions`) and `requireCsrf` (validates `X-CSRF-Token` against cookie and session).
- `backend/src/validators/auth.validator.js` — Request validation + rejection of privileged fields on public registration.
- `backend/src/controllers/auth.controller.js` — Thin HTTP controller setting/clearing cookies and returning standard envelopes.
- `backend/src/routes/auth.routes.js` — Auth routes wired with `authRateLimiter`, `authenticate`, `requireCsrf`, and validators.
- `backend/src/routes/index.js` — Mounted `/auth` routes under `/api`.
- `backend/tests/integration/auth.test.js` & `backend/tests/providers/email.test.js` — Integration and email provider tests.

## 4. Important Code Sections and Why They Exist
- **Public Registration Field Protection (`validators/auth.validator.js` & `services/auth.service.js`):** Explicitly rejects `role`, `userType`, `status`, `isEmailVerified`, `permissions`, and `createdBy` in public registration AND hardcodes `userType: "customer"`, `status: "active"`, `isEmailVerified: false`.
- **Atomic Token Consumption (`auth.service.js`):** Uses `AuthToken.findOneAndUpdate({ tokenHash, purpose, usedAt: null, expiresAt: { $gt: now } }, { $set: { usedAt: now } })` so concurrent requests cannot reuse the same verification or reset token.

## 5. Request Flow
1. `POST /api/auth/register` -> `authRateLimiter` -> `registerValidator` -> `validate` -> `authController.register` -> `authService.registerCustomer` -> creates `User` + `AuthToken` -> sends email via `emailService`.
2. `POST /api/auth/login` -> `authRateLimiter` -> `loginValidator` -> `authService.login` -> verifies password + `status === "active"` + `isEmailVerified` -> creates `Session` -> sets `3jata_sid` (`HttpOnly`) & `3jata_csrf` cookies -> returns `{ user, csrfToken }`.
3. `PATCH /api/auth/change-password` -> `authenticate` -> `requireCsrf` -> `changePasswordValidator` -> updates hash & revokes all user sessions -> clears cookies.

## 6. Database Fields, Indexes, and Relationships
- `User`: unique index on `{ email: 1 }`; compound index `{ userType: 1, status: 1 }`; `{ role: 1 }` referencing `Role`.
- `Session`: unique index on `{ tokenHash: 1 }`; TTL index `{ expiresAt: 1 }` (`expireAfterSeconds: 0`); `{ user: 1, revokedAt: 1 }`.
- `AuthToken`: unique index on `{ tokenHash: 1 }`; TTL index `{ expiresAt: 1 }`; `{ user: 1, purpose: 1, usedAt: 1 }`.

## 7. Design Decisions and Trade-offs
- **Cookie Settings (Development vs Production):**
  - Development: `httpOnly: true` (session), `secure: false` (allows `http://localhost`), `sameSite: "lax"`.
  - Production: `httpOnly: true` (session), `secure: true` (HTTPS required), `sameSite: "lax"` (or `"none"` if cross-site HTTPS).
- **Session Invalidation Policy:** Password change and password reset revoke **all** active sessions for the user so stolen sessions cannot survive a credential reset.
- **Anti-Enumeration:** `login` returns generic `401 Invalid email or password` for unknown email and wrong password; `forgot-password` and `resend-verification` always return `200` with a generic message.

## 8. Security Rules and Edge Cases
- No endpoint returns verification tokens, reset tokens, `passwordHash`, or `tokenHash`.
- Suspended users (`status: "suspended"`) are blocked at login and immediately rejected + session-revoked on any authenticated request.
- Cross-session CSRF misuse (pairing one session's cookie with another session's CSRF token) is rejected with `403`.
- Sensitive auth routes use `authRateLimiter` (20 attempts per 15 minutes).

## 9. Exact Setup and Run Commands
- Start server: `cd d:\3Jata\backend && npm run dev`
- Obtain local email links when using the local mail adapter (`EMAIL_MODE=local`):
  - After calling `/api/auth/register`, `/api/auth/resend-verification`, or `/api/auth/forgot-password`, open the newest `.json` file inside `backend/tmp/local-emails/` and copy `meta.token`.
- For live SMTP (`EMAIL_MODE=smtp`), configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM` in `backend/.env`.

## 10. API and Postman Instructions Relevant to Authentication
- Endpoints under `/api/auth`:
  - `POST /api/auth/register` (public)
  - `POST /api/auth/verify-email` (public)
  - `POST /api/auth/resend-verification` (public)
  - `POST /api/auth/login` (public — sets cookies; save `data.csrfToken` into `{{csrfToken}}`)
  - `GET /api/auth/me` (auth cookie)
  - `GET /api/auth/csrf-token` (auth cookie)
  - `POST /api/auth/logout` (auth cookie + `X-CSRF-Token`)
  - `PATCH /api/auth/change-password` (auth cookie + `X-CSRF-Token`)
  - `POST /api/auth/forgot-password` (public)
  - `POST /api/auth/reset-password` (public)

## 11. Automated Tests and Actual Results
- `tests/integration/auth.test.js`: **5/5 passed** (registration + privileged field rejection + duplicate email + single-use/expired verification, login/cookies/CSRF/cross-session CSRF/logout/expiry, suspended user blocking, password change/reset session revocation & expired reset token, anti-enumeration resend).
- `tests/providers/email.test.js`: **2/2 passed** (local adapter file creation + mocked `nodemailer` SMTP transport).
- Live SMTP check (`EMAIL_MODE=smtp`, port 587): `transporter.verify()` passed and one test email to the configured sender's own address was accepted by SMTP (`250 2.0.0 OK`). *Note: SMTP acceptance does not by itself prove inbox delivery.*

## 12. Manual Testing Status
**Not run by user.**

## 13. Common Errors and Fixes
- **`403 Invalid or missing CSRF token`:** Ensure `X-CSRF-Token` header matches `{{csrfToken}}` from the latest `POST /api/auth/login` response (and that Postman's cookie jar is sending `3jata_csrf`).
- **`403 Please verify your email address before logging in`:** Read the latest email (either in `backend/tmp/local-emails/` when `EMAIL_MODE=local` or your inbox when `EMAIL_MODE=smtp`) and call `POST /api/auth/verify-email` with `{ "token": "..." }`.

## 14. Short, Accurate Interview Explanation
"I implemented stateful opaque HttpOnly cookie sessions backed by a MongoDB `Session` collection storing SHA-256 token hashes and a TTL expiry index. Write requests are protected by a double-submit `X-CSRF-Token` header validated against the cookie and session record in constant time, and single-use hashed `AuthToken` records power email verification and password resets with both live SMTP and a local file email adapter."

## 15. Remaining Work and Next Step
- **Next Step:** See [Roles and Staff Access](roles-and-staff-access.md).
