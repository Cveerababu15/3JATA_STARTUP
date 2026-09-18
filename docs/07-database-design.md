# Organic Powder — Database Design

## 1. Purpose

This document defines the main data entities required by the Organic Powder platform and explains how they are related.

The purpose is to understand the data structure before creating database models.

The actual database schemas may be refined during implementation when specific technical requirements become clearer.

---

## 2. Database

The project will use MongoDB Atlas with Mongoose.

MongoDB will store the application's main business data.

---

## 3. Main Entities

The initial system will contain the following main entities:

```text
User
Role
Permission

Product
ProductVariant
Category

Cart
Wishlist
Address

Order
OrderItem

Payment
Refund

Coupon
Campaign

Review

Inventory
InventoryTransaction

Shipment

SupportTicket

Notification

AuditLog

Supplier
PurchaseRecord

AIConversation
AIMessage
KnowledgeDocument
```

---

## 4. User and Access Entities

### User

A User represents a person who uses the platform.

A user may be:

* Customer
* Staff member
* Administrator

Important information may include:

* Name
* Email
* Password information
* Account status
* Role information
* Profile information
* Timestamps

Sensitive information must be handled securely.

---

### Role

A Role represents a business responsibility.

Examples:

* Super Admin
* Product Manager
* Inventory Manager
* Order Manager
* Finance Manager
* Customer Support
* Analyst

---

### Permission

A Permission represents a specific action that a user may perform.

Examples:

```text
products.read
products.create
products.update
inventory.read
inventory.adjust
orders.read
orders.update
refunds.create
analytics.read
```

Roles can contain multiple permissions.

---

## 5. Product Entities

### Product

Represents the main product.

Example:

```text
Beetroot Powder
```

A product may contain:

* Name
* Slug
* Description
* Category
* Images
* Ingredients
* Origin
* Processing information
* Nutrition information
* Storage information
* Shelf life
* Tags
* SEO information
* Status
* Rating information

---

### ProductVariant

Represents a purchasable version of a product.

Example:

```text
Beetroot Powder
 ├── 100g
 ├── 250g
 ├── 500g
 └── 1kg
```

Each variant should contain information such as:

* SKU
* Weight
* Price
* Stock
* Availability

A variant belongs to a product.

---

### Category

Represents a product category.

Examples:

```text
Fruit Powders
Vegetable Powders
Greens
Herbal Powders
Smoothie Blends
Combo Packs
```

---

## 6. Customer Shopping Entities

### Cart

Represents a customer's current shopping cart.

A cart may contain multiple product variants and quantities.

---

### Wishlist

Stores products or variants saved by a customer for later.

---

### Address

Stores customer delivery addresses.

A customer may have multiple addresses.

---

## 7. Order Entities

### Order

Represents a completed order process.

Important information may include:

* Customer
* Order items
* Delivery address
* Total amount
* Payment status
* Order status
* Coupon information
* Timestamps

---

### OrderItem

Represents a specific product variant purchased as part of an order.

An order can contain multiple order items.

For example:

```text
Order
 ├── Beetroot Powder 250g × 2
 ├── Moringa Powder 100g × 1
 └── Banana Powder 500g × 1
```

The order item should retain the relevant purchase information so that historical orders remain understandable even if the product changes later.

---

## 8. Payment Entities

### Payment

Stores information about a payment attempt or transaction.

Possible information includes:

* Order reference
* Payment provider
* Provider transaction/reference ID
* Amount
* Payment status
* Timestamps

Payment information must be protected carefully.

---

### Refund

Represents a refund operation associated with an eligible payment/order.

It may contain:

* Order reference
* Payment reference
* Refund amount
* Refund status
* Reason
* Processing information
* Timestamps

---

## 9. Marketing Entities

### Coupon

Represents a discount code.

It may contain:

* Coupon code
* Discount type
* Discount value
* Minimum order amount
* Expiry
* Usage limits
* Applicable products/categories
* Active status

---

### Campaign

Represents a marketing campaign.

It may be used to organise promotional content, offers or featured products.

---

## 10. Review

A Review represents customer feedback about a product.

It may contain:

* Customer
* Product
* Rating
* Review text
* Status
* Timestamps

Review rules will be defined during implementation.

---

## 11. Inventory Entities

### Inventory

Represents current stock information for a product variant.

Important information may include:

* Product variant
* Current quantity
* Reserved quantity where required
* Low-stock threshold
* Status

---

### InventoryTransaction

Records changes made to inventory.

Examples:

```text
Stock Received
Stock Sold
Manual Adjustment
Damaged Stock
Expired Stock
Return
```

This provides a history of how inventory changed.

---

## 12. Shipment

Represents the shipping information for an order.

It may contain:

* Order reference
* Courier information
* Tracking number
* Shipment status
* Dispatch information
* Delivery information
* Exception information

---

## 13. SupportTicket

Represents a customer support request.

It may contain:

* Customer
* Related order where applicable
* Subject
* Description
* Priority
* Status
* Internal notes
* Assigned staff member
* Timestamps

---

## 14. Notification

Stores important system notifications.

A notification may be related to:

* Orders
* Payments
* Shipping
* Refunds
* Support
* Account activity
* Inventory alerts

---

## 15. AuditLog

Records important administrative actions.

For example:

```text
User: Product Manager
Action: Product price updated
Resource: Beetroot Powder 250g
Previous Value: ₹299
New Value: ₹349
Time: Recorded by system
```

Audit logs help understand who performed an important action and what changed.

---

## 16. Procurement Entities

### Supplier

Stores supplier information.

---

### PurchaseRecord

Represents procurement or stock purchase information.

It may connect supplier information with received materials or inventory operations.

---

## 17. AI Entities

### AIConversation

Represents a customer's or user's AI conversation.

---

### AIMessage

Represents individual messages within an AI conversation.

---

### KnowledgeDocument

Represents approved information that can be used by the AI knowledge system.

Possible sources may include:

* Product information
* FAQs
* Policies
* Approved business documentation

---

## 18. Main Relationships

A simplified relationship view is:

```text
User
 ├── Address
 ├── Cart
 ├── Wishlist
 ├── Order
 ├── Review
 ├── SupportTicket
 └── AIConversation

Product
 ├── Category
 ├── ProductVariant
 └── Review

ProductVariant
 ├── Cart Item
 ├── Wishlist Item
 ├── OrderItem
 └── Inventory

Order
 ├── OrderItem
 ├── Payment
 ├── Refund
 └── Shipment
```

---

## 19. Important Data Principles

The database should follow these principles:

* Use unique identifiers for important entities.
* Keep product variants separate from the main product concept.
* Keep historical order information reliable.
* Avoid storing unnecessary duplicate information.
* Add indexes where they improve important queries.
* Protect sensitive information.
* Keep financial records traceable.
* Keep inventory changes traceable.
* Keep important administrative actions auditable.

---

## 20. Future Database Improvements

The data model may later be expanded for:

* Subscriptions
* Loyalty programmes
* Advanced recommendations
* International currencies
* Multiple warehouses
* Advanced supplier management
* Mobile application data
* Advanced analytics

These changes should only be introduced when there is a real requirement for them.
