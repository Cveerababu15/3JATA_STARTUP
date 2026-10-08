const PERMISSIONS = {
    // Products
    PRODUCTS_READ: "products.read",
    PRODUCTS_CREATE: "products.create",
    PRODUCTS_UPDATE: "products.update",
    PRODUCTS_DELETE: "products.delete",
  
    // Inventory
    INVENTORY_READ: "inventory.read",
    INVENTORY_ADJUST: "inventory.adjust",
  
    // Orders
    ORDERS_READ: "orders.read",
    ORDERS_UPDATE: "orders.update",
  
    // Coupons
    COUPONS_READ: "coupons.read",
    COUPONS_CREATE: "coupons.create",
    COUPONS_UPDATE: "coupons.update",
    COUPONS_DELETE: "coupons.delete",
  
    // Payments
    PAYMENTS_READ: "payments.read",
  
    // Refunds
    REFUNDS_READ: "refunds.read",
    REFUNDS_CREATE: "refunds.create",
  
    // Analytics
    ANALYTICS_READ: "analytics.read",
  
    // Audit Logs
    AUDIT_LOGS_READ: "audit_logs.read",
  
    // Roles
    ROLES_READ: "roles.read",
    ROLES_CREATE: "roles.create",
    ROLES_UPDATE: "roles.update",
    ROLES_MANAGE: "roles.manage",
  };
  
  module.exports = PERMISSIONS;