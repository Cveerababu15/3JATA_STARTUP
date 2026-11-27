# Manual Postman Testing Guide — 3JATA Backend Foundation

This guide walks you step by step through testing every endpoint in Postman using:
- Collection: [3JATA-Backend-Foundation.postman_collection.json](../../postman/3JATA-Backend-Foundation.postman_collection.json)
- Environment: [3JATA-local.postman_environment.json](../../postman/3JATA-local.postman_environment.json)

---

## How Sessions, Cookies, and CSRF Work in Postman
1. **No Bearer Tokens:** 3JATA uses **HttpOnly cookie sessions** (`3jata_sid`) plus a **CSRF cookie** (`3jata_csrf`), NOT `Authorization: Bearer` headers.
2. **Postman Cookie Jar:** When you run `POST {{baseUrl}}/auth/login`, Postman automatically saves `3jata_sid` and `3jata_csrf` in its Cookie Jar for `localhost`. Every later request to `{{baseUrl}}/...` sends those cookies automatically.
3. **Automatic `{{csrfToken}}` Script:** Every login request in the collection runs a tiny **Tests** script:
   ```js
   if (pm.response.code === 200) {
     const json = pm.response.json();
     if (json.data && json.data.csrfToken) {
       pm.environment.set("csrfToken", json.data.csrfToken);
     }
   }
   ```
   Authenticated write requests (`POST`, `PATCH`, `DELETE`) send header `X-CSRF-Token: {{csrfToken}}`.
4. **Switching Between Customer, Staff, and Owner Sessions:**
   - Because Postman shares one Cookie Jar for `localhost`, **always run `02 -> Logout` (or open Postman's Cookies modal and delete `localhost` cookies)** before logging in as a different user! Otherwise you can accidentally confuse which account is active.
   - To verify who is currently logged in at any time, run `GET {{baseUrl}}/auth/me`.

---

## Environment Variables (`3JATA-local.postman_environment.json`)
- `baseUrl`: `http://localhost:5000/api` (already includes the `/api` prefix!)
- `csrfToken`, `customerId`, `staffId`, `roleId`, `categoryId`, `subcategoryId`, `productId`, `variantId`, `imageId`: populated automatically by collection scripts.
- `verificationToken`, `resetToken`: copy from `backend/tmp/local-emails/*.json` (when `EMAIL_MODE=local`) or from your email inbox (when `EMAIL_MODE=smtp`) during email verification and password reset steps.

---

## Beginner-Friendly 12-Step Execution Order

### Step 1: Configure Local Environment and Database
1. Copy `backend/.env.example` to `backend/.env` if needed, and verify `PORT=5000`, `NODE_ENV=development`, `EMAIL_MODE=local` (or `smtp`), and a valid `MONGODB_URI`.
2. Never use your production database for testing.
3. Import `3JATA-Backend-Foundation.postman_collection.json` and `3JATA-local.postman_environment.json` into Postman, and select the **3JATA Local (Backend Foundation)** environment in the top-right dropdown.

### Step 2: Run Seeds and Owner Bootstrap
From `d:\3Jata\backend`:
```powershell
npm run seed
npm run bootstrap:owner -- --name="Founder Owner" --email="owner@3jata.local" --password="<YourStrongPassword123>"
npm run dev
```
*(Choose your own strong password containing uppercase, lowercase, and a number. Remember it for Step 6.)*

### Step 3: Check Health
1. Run `01. Health -> Health Check` (`GET {{baseUrl}}/health`).
   - Expect `200 OK`, `data.database: "connected"`.
2. Run `01. Health -> Readiness Check` (`GET {{baseUrl}}/health/ready`).
   - Expect `200 OK`, `data.status: "ready"`.

### Step 4: Register and Verify a Customer
1. Run `02. Customer Authentication -> Register Customer` (`POST {{baseUrl}}/auth/register`).
   - Expect `201 Created` (`user.userType: "customer"`, `isEmailVerified: false`, NO token in response).
   - Script saves `{{customerId}}`.
2. If using `EMAIL_MODE=local`, open `backend/tmp/local-emails/` and open the newest `.json` file for `asha.customer@example.com`, then copy `meta.token` into `verificationToken`. (If using `EMAIL_MODE=smtp`, register with a real inbox you control and copy the token from the received email.)
3. Run `Verify Email` (`POST {{baseUrl}}/auth/verify-email` with `{ "token": "{{verificationToken}}" }`).
   - Expect `200 OK`, `isEmailVerified: true`.
   - DB side effect: `User.isEmailVerified = true`, `AuthToken.usedAt` set (single-use!).
   - *(Optional negative check)* Run `Verify Email` a second time -> expect `400 Bad Request`.

### Step 5: Test Customer Login and Account Flows
1. Run `Login (Customer)` (`POST {{baseUrl}}/auth/login`).
   - Expect `200 OK`, cookies set, `{{csrfToken}}` captured.
2. Run `Get Current Authenticated User` (`GET {{baseUrl}}/auth/me`).
   - Expect `200 OK` showing `asha.customer@example.com` and `permissions: []`.
3. Run `Change Password` (`PATCH {{baseUrl}}/auth/change-password`, `X-CSRF-Token: {{csrfToken}}`).
   - Expect `200 OK`. Verify old session is revoked by running `GET /auth/me` -> expect `401 Unauthorized`!
4. Run `Forgot Password` (`POST {{baseUrl}}/auth/forgot-password`), grab the new `meta.token` from `backend/tmp/local-emails/` (or your email) into `{{resetToken}}`, and run `Reset Password` (`POST {{baseUrl}}/auth/reset-password`) to set password back to `Password123`.
5. Log in again as customer, then run `Logout` (`POST {{baseUrl}}/auth/logout`, `X-CSRF-Token: {{csrfToken}}`).

### Step 6: Log In as Owner
1. In `03. Owner & Staff Administration -> Login (Owner / Super Admin)`, replace `REPLACE_WITH_LOCAL_OWNER_PASSWORD` with the password you chose in Step 2 (do NOT commit this password!).
2. Send request -> Expect `200 OK` with `user.role.slug: "super_admin"` and full `permissions`.

### Step 7: Provision Staff and Test Restricted Access
1. Run `List Roles` (`GET {{baseUrl}}/admin/roles`) -> `200 OK`, captures `{{roleId}}`.
2. Run `List Permissions` (`GET {{baseUrl}}/admin/permissions`) -> `200 OK`.
3. Run `Provision Staff Account` (`POST {{baseUrl}}/admin/staff`) -> `201 Created`, captures `{{staffId}}`.
4. Run `List Staff Accounts` (`GET {{baseUrl}}/admin/staff`) & `Get Staff Account by ID` (`GET {{baseUrl}}/admin/staff/{{staffId}}`) -> `200 OK`.
5. Run `Update Staff Profile` (`PATCH {{baseUrl}}/admin/staff/{{staffId}}`) -> `200 OK`.
6. Run `Assign Staff Role` (`PATCH {{baseUrl}}/admin/staff/{{staffId}}/role`) -> `200 OK` (changes to `inventory_manager`).
7. Run `List Audit Logs` (`GET {{baseUrl}}/admin/audit-logs`) -> `200 OK` showing `staff.created`, `staff.updated`, `staff.role_updated`.

### Step 8: Create Categories, Products, and Variants
*(Keep owner logged in, or log in as a `product_manager` staff user.)*
1. Run `04 -> Create Root Category` (`POST {{baseUrl}}/categories`) -> `201`, captures `{{categoryId}}`.
2. Run `04 -> Create Subcategory` (`POST {{baseUrl}}/categories`) -> `201`, captures `{{subcategoryId}}`.
3. Run `04 -> List Categories (Management)` & `Update Category`.
4. Run `04 -> Create Product with Variants` (`POST {{baseUrl}}/products`) -> `201`, captures `{{productId}}` and `{{variantId}}`.
5. Run `04 -> List Products (Management)`, `Get Product by ID (Management)`, `Update Product`, `Add Variant to Product`, `Update Variant Price`.

### Step 9: Test Image Operations
*(Requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in `backend/.env`.)*
1. Open `04 -> Upload Product Image (Cloudinary)` (`POST {{baseUrl}}/products/{{productId}}/images`).
2. In **Body -> form-data**, click the `image` file field and select a small `.png` or `.jpg` (< 2 MB).
3. Send -> Expect `201 Created`, captures `{{imageId}}`.
4. Run `Delete Product Image` (`DELETE {{baseUrl}}/products/{{productId}}/images/{{imageId}}`) -> `200 OK`.

### Step 10: Adjust Stock and Inspect History
1. Run `05 -> Get Variant Inventory` (`GET {{baseUrl}}/inventory/{{variantId}}`) -> `200`, `quantity: 0`.
2. Run `05 -> Adjust Stock (Initial Stock with Idempotency-Key)` -> `200`, `quantity: 25`, `idempotentReplay: false`.
3. Re-run the exact same request -> `200`, `quantity: 25` (NOT 50!), `idempotentReplay: true`.
4. Run `05 -> Adjust Stock (Damaged Deduction)` -> `200`, `quantity: 22`.
5. Run `05 -> Update Low-Stock Threshold` (`25`) -> `200`, `isLowStock: true`.
6. Run `05 -> List All Inventory`, `List Low-Stock Variants`, and `List Stock Movement History`.

### Step 11: Confirm Public Catalogue Behavior
1. Log out (or clear cookies):
2. Run `06 -> List Public Categories`, `Get Public Category by Slug`, `List Public Products`, `Get Public Product by Slug`.
   - Confirm `internalNotes` is absent and `variants[0].stock.availableQuantity` matches `22`.

### Step 12: Run Negative, Archival, and Session-Revocation Cases
Run the requests in folders `07. Archival & Cleanup` and `08. Negative & Security Tests`:
1. `NEG: Public Registration with Privileged Role` -> `400`.
2. `NEG: Customer Accessing /admin/roles` (while logged in as customer) -> `403`.
3. `NEG: Product Update Attempting Stock Modification` (while logged in as owner) -> `400`.
4. `NEG: Inventory Adjustment Resulting in Negative Stock` -> `400`.
5. `NEG: Idempotency-Key Mismatch` -> `409`.
6. Suspension/session revocation test: Log in as `priya.pm@3jata.local` in Postman, note `GET /auth/me` returns `200`; then suspend `{{staffId}}` as owner (`PATCH /admin/staff/{{staffId}}/status` `{ "status": "suspended" }`), verify Priya's login -> `403`. Reactivate via `Reactivate Staff Account` when done!
7. **Cleanup / Restore:** Run folder `07` in order (`Archive Variant` -> `Archive Product` -> `Archive Subcategory` -> `Archive Root Category`), or drop only your local test database if you want a clean slate.
