# Organic Powder — Project Structure

## 1. Purpose

This document explains the planned folder structure of the Organic Powder project.

The structure is designed to keep frontend, backend and documentation responsibilities separate and easy to understand.

---

## 2. Root Structure

```text
organic-powder/
│
├── client/
├── server/
├── docs/
│
├── README.md
├── CHANGELOG.md
├── .env.example
├── .gitignore
└── package.json
```

---

## 3. Client Structure

The frontend will contain the customer application and the required admin interface.

```text
client/
└── src/
    ├── assets/
    ├── components/
    ├── pages/
    ├── layouts/
    ├── features/
    ├── hooks/
    ├── services/
    ├── store/
    ├── utils/
    ├── constants/
    ├── routes/
    ├── App.jsx
    └── main.jsx
```

---

## 4. Components

```text
components/
```

Contains reusable interface components.

Examples:

```text
Button
Modal
Input
ProductCard
Navbar
Footer
Loader
Pagination
```

A component should be reusable when it is genuinely shared.

---

## 5. Pages

```text
pages/
```

Contains page-level components.

Examples:

```text
Home
Products
ProductDetails
Cart
Checkout
Orders
Profile
Login
Register
```

---

## 6. Features

```text
features/
```

Contains larger feature-specific frontend functionality.

Possible areas include:

```text
auth/
products/
cart/
wishlist/
orders/
payments/
reviews/
admin/
ai/
```

This keeps larger features organised as the application grows.

---

## 7. Hooks

```text
hooks/
```

Contains reusable custom React hooks.

Examples may include:

```text
useAuth
useDebounce
useCart
usePermission
```

Only create a custom hook when it provides useful reusable behaviour.

---

## 8. Services

```text
services/
```

Contains communication with backend APIs and external application services.

Examples:

```text
authService
productService
orderService
paymentService
```

---

## 9. Store

```text
store/
```

Contains global client-side state managed using Zustand.

Only state that genuinely needs global access should be placed here.

---

## 10. Server Structure

```text
server/
└── src/
    ├── config/
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    ├── services/
    ├── validators/
    ├── utils/
    ├── constants/
    ├── jobs/
    ├── app.js
    └── server.js
```

---

## 11. Config

```text
config/
```

Contains application configuration such as:

* Database connection
* Cloudinary configuration
* Payment configuration
* AI configuration

Secrets should come from environment variables.

---

## 12. Controllers

```text
controllers/
```

Controllers handle HTTP-level responsibilities.

They should:

* Receive requests.
* Call the required business logic.
* Return responses.

Controllers should not become large files containing all business logic.

---

## 13. Services

```text
services/
```

Services contain reusable business logic.

Examples:

```text
authService
productService
orderService
paymentService
inventoryService
```

This keeps business logic easier to test and maintain.

---

## 14. Models

```text
models/
```

Contains Mongoose models.

Examples:

```text
User
Product
ProductVariant
Order
Payment
Inventory
Review
```

---

## 15. Routes

```text
routes/
```

Defines API routes and connects them to the appropriate controllers and middleware.

Routes should remain focused on routing rather than containing large business operations.

---

## 16. Middleware

```text
middleware/
```

Contains shared request processing such as:

* Authentication
* Permission checking
* Validation
* Error handling
* Rate limiting
* Other reusable request middleware

---

## 17. Validators

```text
validators/
```

Contains validation rules for incoming data.

Examples:

```text
Registration validation
Product validation
Order validation
Coupon validation
```

---

## 18. Utils

```text
utils/
```

Contains small reusable utilities that do not belong to a specific business module.

---

## 19. Jobs

```text
jobs/
```

May contain scheduled or background tasks when the application requires them.

Examples may include:

* Notification processing
* Cleanup tasks
* Scheduled business tasks

Background processing should only be introduced when there is a real requirement.

---

## 20. Documentation

```text
docs/
```

Contains project documentation covering:

* Requirements
* Architecture
* Database
* APIs
* Security
* Testing
* Deployment
* Decisions
* Troubleshooting

---

## 21. Structure Principle

The project structure should follow a simple rule:

> Put code where its responsibility is easiest to understand.

We should avoid creating folders simply because a particular architecture is popular.

The structure can evolve as the application grows.
