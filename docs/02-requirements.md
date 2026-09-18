# Organic Powder — Requirements

## 1. Purpose

This document explains what the Organic Powder platform needs to do.

It covers the main features for customers, admins and staff members. It also defines important business rules, security requirements and future improvements.

The purpose is to have a clear understanding of the product before development starts.

---

## 2. Functional Requirements

### 2.1 Authentication

The system shall allow users to:

* Create an account.
* Log in securely.
* Log out securely.
* Access protected features only after authentication.
* Update their account information.
* Change their password.
* Reset their password when required.

Passwords must never be stored as plain text.

---

### 2.2 Customer

Customers shall be able to:

* View and update their profile.
* Add and manage delivery addresses.
* Browse available products.
* Search for products.
* Filter and sort products.
* View product details.
* Select product variants such as 100g, 250g, 500g or 1kg.
* Add products to the cart.
* Update cart quantities.
* Remove products from the cart.
* Add products to a wishlist.
* Apply eligible coupons.
* Place orders.
* Make payments.
* View previous orders.
* Track order status.
* Cancel orders when cancellation is allowed.
* Request support for order-related issues.
* Submit product reviews when eligible.
* Receive important notifications.

---

### 2.3 Products

The system shall support:

* Product categories and subcategories.
* Product names and descriptions.
* Product images.
* Product variants.
* Individual SKUs for variants.
* Variant-specific prices.
* Variant-specific stock.
* Product availability status.
* Ingredients and product information.
* Product origin and processing information.
* Nutrition information where applicable.
* Storage information.
* Shelf-life information.
* Product tags.
* Product ratings and review counts.
* Featured and bestseller products.
* Product search, filtering and sorting.
* SEO information for products.

Only active and available products should normally be shown for purchase.

---

### 2.4 Cart and Wishlist

Customers shall be able to:

* Add a product variant to the cart.
* Change the quantity of a cart item.
* Remove a cart item.
* View the current cart.
* See the calculated cart total.
* Add and remove wishlist items.
* Move a wishlist item to the cart.

The system must check current product and stock information before an order is placed.

---

### 2.5 Checkout and Payments

The checkout process shall allow customers to:

* Select a delivery address.
* Review their order.
* Apply an eligible coupon.
* See applicable charges.
* See the final payable amount.
* Start the payment process.
* Receive a clear result after payment.

The system must verify the payment on the server before treating an order as successfully paid.

Payment failures must not incorrectly mark an order as paid.

---

### 2.6 Orders and Shipping

The system shall maintain the order lifecycle.

A normal order may move through stages such as:

```text
Pending
    ↓
Confirmed
    ↓
Processing
    ↓
Packed
    ↓
Shipped
    ↓
Out for Delivery
    ↓
Delivered
```

The system shall support appropriate handling of:

* Order cancellation.
* Payment failure.
* Refunds.
* Failed delivery.
* Returns where supported.
* Order tracking.
* Order history.

Customers shall only be allowed to perform actions that are valid for the current order status.

---

### 2.7 Reviews

Customers shall be able to:

* Submit product ratings
