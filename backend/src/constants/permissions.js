const PERMISSIONS = {
  // Categories
  CATEGORIES_READ: "categories.read",
  CATEGORIES_CREATE: "categories.create",
  CATEGORIES_UPDATE: "categories.update",
  CATEGORIES_DELETE: "categories.delete",

  // Products
  PRODUCTS_READ: "products.read",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_UPDATE: "products.update",
  PRODUCTS_DELETE: "products.delete",

  // Inventory
  INVENTORY_READ: "inventory.read",
  INVENTORY_ADJUST: "inventory.adjust",

  // Orders & Shipping
  ORDERS_READ: "orders.read",
  ORDERS_UPDATE: "orders.update",
  ORDERS_CANCEL: "orders.cancel",
  SHIPPING_READ: "shipping.read",
  SHIPPING_UPDATE: "shipping.update",

  // Coupons
  COUPONS_READ: "coupons.read",
  COUPONS_CREATE: "coupons.create",
  COUPONS_UPDATE: "coupons.update",
  COUPONS_DELETE: "coupons.delete",

  // Payments & Refunds
  PAYMENTS_READ: "payments.read",
  REFUNDS_READ: "refunds.read",
  REFUNDS_CREATE: "refunds.create",

  // Customers & Support
  CUSTOMERS_READ: "customers.read",
  TICKETS_READ: "tickets.read",
  TICKETS_UPDATE: "tickets.update",

  // Content & AI
  CONTENT_READ: "content.read",
  CONTENT_CREATE: "content.create",
  CONTENT_UPDATE: "content.update",
  CONTENT_PUBLISH: "content.publish",
  AI_READ: "ai.read",
  AI_GENERATE: "ai.generate",
  AI_UPDATE: "ai.update",

  // Analytics & Procurement
  ANALYTICS_READ: "analytics.read",
  SUPPLIERS_READ: "suppliers.read",
  SUPPLIERS_CREATE: "suppliers.create",
  SUPPLIERS_UPDATE: "suppliers.update",

  // Administration, Staff, Roles, Settings, Audit Logs
  STAFF_READ: "staff.read",
  STAFF_CREATE: "staff.create",
  STAFF_UPDATE: "staff.update",
  ROLES_READ: "roles.read",
  ROLES_CREATE: "roles.create",
  ROLES_UPDATE: "roles.update",
  ROLES_MANAGE: "roles.manage",
  SETTINGS_READ: "settings.read",
  SETTINGS_UPDATE: "settings.update",
  AUDIT_LOGS_READ: "audit_logs.read",
};

module.exports = PERMISSIONS;
