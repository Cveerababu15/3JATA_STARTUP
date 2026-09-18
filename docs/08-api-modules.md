# Organic Powder — API Modules

## 1. Purpose

This document defines the main API modules of the Organic Powder platform.

The API will act as the connection between the frontend, database and external services.

The exact endpoints will be defined and updated during implementation.

---

## 2. API Base Structure

The backend API will use a common base path:

```text
/api
```

Modules will then be organised according to their business responsibility.

---

## 3. Authentication

```text
/api/auth
```

Responsible for:

* Registration
* Login
* Logout
* Authentication checks
* Password changes
* Password reset
* Other account authentication operations

Example endpoints:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

---

## 4. Users

```text
/api/users
```

Responsible for:

* Customer profile
* Account information
* Addresses
* User-related operations

---

## 5. Products

```text
/api/products
```

Responsible for:

* Product listing
* Product details
* Product creation
* Product updates
* Product activation/deactivation
* Product variants
* Product search
* Product filtering

Example:

```text
GET  /api/products
GET  /api/products/:slug
POST /api/products
PATCH /api/products/:id
```

Access to management operations will depend on permissions.

---

## 6. Categories

```text
/api/categories
```

Responsible for:

* Product categories
* Subcategories
* Category management

---

## 7. Cart

```text
/api/cart
```

Responsible for:

* Viewing cart
* Adding items
* Updating quantities
* Removing items
* Cart validation

---

## 8. Wishlist

```text
/api/wishlist
```

Responsible for:

* Viewing wishlist
* Adding products
* Removing products
* Moving items towards purchase

---

## 9. Orders

```text
/api/orders
```

Responsible for:

* Creating orders
* Viewing orders
* Customer order history
* Order status
* Cancellation where allowed
* Order management by authorised staff

---

## 10. Payments

```text
/api/payments
```

Responsible for:

* Payment creation
* Payment verification
* Payment status
* Payment records
* Payment provider communication

Payment verification must be performed securely on the backend.

---

## 11. Refunds

```text
/api/refunds
```

Responsible for:

* Refund requests
* Refund processing
* Refund status
* Refund records

Financial permissions will control access to refund operations.

---

## 12. Coupons

```text
/api/coupons
```

Responsible for:

* Coupon validation
* Coupon creation
* Coupon updates
* Coupon activation/deactivation
* Coupon usage rules

---

## 13. Reviews

```text
/api/reviews
```

Responsible for:

* Creating reviews
* Updating reviews where allowed
* Viewing reviews
* Review moderation

---

## 14. Inventory

```text
/api/inventory
```

Responsible for:

* Current stock
* Stock adjustments
* Stock history
* Low-stock information
* Inventory transactions

Inventory changes must be permission-controlled and traceable.

---

## 15. Shipping

```text
/api/shipments
```

Responsible for:

* Shipment creation
* Tracking information
* Shipment status
* Delivery updates
* Delivery exceptions

---

## 16. Support

```text
/api/support
```

Responsible for:

* Creating support tickets
* Viewing tickets
* Updating ticket status
* Assigning tickets
* Internal support information

---

## 17. Notifications

```text
/api/notifications
```

Responsible for:

* Customer notifications
* Staff notifications
* Notification status
* Important system events

---

## 18. Content

```text
/api/content
```

Responsible for:

* Homepage content
* Banners
* FAQs
* Blog content
* Landing pages
* SEO-related content

---

## 19. Analytics

```text
/api/analytics
```

Responsible for:

* Sales information
* Order analytics
* Product performance
* Customer information
* Inventory analytics
* Business reports

Access will depend on the user's permissions.

---

## 20. AI

```text
/api/ai
```

Responsible for:

* AI assistant requests
* Product assistance
* AI recommendations
* AI-generated content
* AI knowledge retrieval

The AI module must use authoritative application data when answering questions about dynamic business information.

---

## 21. Procurement

```text
/api/procurement
```

Responsible for:

* Suppliers
* Purchase records
* Procurement operations
* Restocking-related information

---

## 22. Admin

```text
/api/admin
```

Responsible for platform-level administration such as:

* Roles
* Permissions
* Staff accounts
* System settings
* Audit logs

Only appropriately authorised staff should access these operations.

---

## 23. Common Request Flow

A typical protected API request will follow:

```text
Frontend
   ↓
API Request
   ↓
Authentication
   ↓
Permission Check
   ↓
Validation
   ↓
Controller
   ↓
Service / Business Logic
   ↓
Database or External Service
   ↓
Response
```

---

## 24. API Design Principles

The API should follow these principles:

* Use clear resource names.
* Use appropriate HTTP methods.
* Validate incoming data.
* Authenticate protected requests.
* Authorise sensitive operations.
* Return consistent responses.
* Handle errors centrally.
* Avoid exposing sensitive information.
* Keep business logic out of route definitions where possible.
* Keep external service integrations isolated.

---

## 25. Future API Improvements

The API may later support:

* Advanced search
* More detailed analytics
* Subscription products
* Loyalty features
* Additional payment providers
* External logistics integrations
* Advanced AI capabilities

These will be introduced only when required.
