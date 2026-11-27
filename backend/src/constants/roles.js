const ROLES = {
  CUSTOMER: "customer",
  SUPER_ADMIN: "super_admin",
  PRODUCT_MANAGER: "product_manager",
  INVENTORY_MANAGER: "inventory_manager",
  ORDER_MANAGER: "order_manager",
  SHIPPING_FULFILMENT_MANAGER: "shipping_fulfilment_manager",
  MARKETING_MANAGER: "marketing_manager",
  FINANCE_MANAGER: "finance_manager",
  CUSTOMER_SUPPORT: "customer_support",
  CONTENT_SEO_MANAGER: "content_seo_manager",
  AI_MANAGER: "ai_manager",
  ANALYST: "analyst",
  PROCUREMENT_SUPPLIER_MANAGER: "procurement_supplier_manager",
};

const STAFF_ROLE_SLUGS = Object.values(ROLES).filter((slug) => slug !== ROLES.CUSTOMER);

module.exports = ROLES;
module.exports.ROLES = ROLES;
module.exports.STAFF_ROLE_SLUGS = STAFF_ROLE_SLUGS;
