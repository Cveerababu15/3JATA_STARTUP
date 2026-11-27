const ROLES = require("./roles");
const PERMISSIONS = require("./permissions");

const ALL_PERMISSION_CODES = Object.values(PERMISSIONS);

const PERMISSION_DEFINITIONS = ALL_PERMISSION_CODES.map((code) => {
  const [resource, action] = code.split(".");
  return {
    code,
    resource,
    action,
    description: `Allow ${action} on ${resource}`,
  };
});

const ROLE_DEFINITIONS = [
  {
    slug: ROLES.CUSTOMER,
    name: "Customer",
    description: "Storefront shopper with zero administrative permissions",
    isStaffRole: false,
    isSystem: true,
    permissions: [],
  },
  {
    slug: ROLES.SUPER_ADMIN,
    name: "Super Admin / Owner",
    description: "Complete platform administration including staff, roles, and audit logs",
    isStaffRole: true,
    isSystem: true,
    permissions: ALL_PERMISSION_CODES,
  },
  {
    slug: ROLES.PRODUCT_MANAGER,
    name: "Product Manager",
    description: "Manages categories, products, variants, images, and product SEO",
    isStaffRole: true,
    isSystem: true,
    permissions: [
      PERMISSIONS.CATEGORIES_READ,
      PERMISSIONS.CATEGORIES_CREATE,
      PERMISSIONS.CATEGORIES_UPDATE,
      PERMISSIONS.CATEGORIES_DELETE,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_CREATE,
      PERMISSIONS.PRODUCTS_UPDATE,
      PERMISSIONS.PRODUCTS_DELETE,
    ],
  },
  {
    slug: ROLES.INVENTORY_MANAGER,
    name: "Inventory Manager",
    description: "Manages stock levels, adjustments, low-stock thresholds, and stock history",
    isStaffRole: true,
    isSystem: true,
    permissions: [
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_ADJUST,
      PERMISSIONS.PRODUCTS_READ,
    ],
  },
  {
    slug: ROLES.ORDER_MANAGER,
    name: "Order Manager",
    description: "Processes orders, status transitions, and eligible cancellations",
    isStaffRole: true,
    isSystem: true,
    permissions: [
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ORDERS_UPDATE,
      PERMISSIONS.ORDERS_CANCEL,
      PERMISSIONS.CUSTOMERS_READ,
    ],
  },
  {
    slug: ROLES.SHIPPING_FULFILMENT_MANAGER,
    name: "Shipping / Fulfilment Manager",
    description: "Manages packing, courier tracking, and shipment updates",
    isStaffRole: true,
    isSystem: true,
    permissions: [PERMISSIONS.ORDERS_READ, PERMISSIONS.SHIPPING_READ, PERMISSIONS.SHIPPING_UPDATE],
  },
  {
    slug: ROLES.MARKETING_MANAGER,
    name: "Marketing Manager",
    description: "Manages coupons, campaigns, and promotional visibility",
    isStaffRole: true,
    isSystem: true,
    permissions: [
      PERMISSIONS.COUPONS_READ,
      PERMISSIONS.COUPONS_CREATE,
      PERMISSIONS.COUPONS_UPDATE,
      PERMISSIONS.COUPONS_DELETE,
      PERMISSIONS.PRODUCTS_READ,
    ],
  },
  {
    slug: ROLES.FINANCE_MANAGER,
    name: "Finance Manager",
    description: "Manages payments, refunds, settlements, and financial reporting",
    isStaffRole: true,
    isSystem: true,
    permissions: [
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.REFUNDS_READ,
      PERMISSIONS.REFUNDS_CREATE,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.ANALYTICS_READ,
    ],
  },
  {
    slug: ROLES.CUSTOMER_SUPPORT,
    name: "Customer Support",
    description: "Handles customer support tickets and order-related inquiries",
    isStaffRole: true,
    isSystem: true,
    permissions: [
      PERMISSIONS.TICKETS_READ,
      PERMISSIONS.TICKETS_UPDATE,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.CUSTOMERS_READ,
      PERMISSIONS.REFUNDS_READ,
    ],
  },
  {
    slug: ROLES.CONTENT_SEO_MANAGER,
    name: "Content / SEO Manager",
    description: "Manages storefront content, banners, blogs, FAQs, and SEO copy",
    isStaffRole: true,
    isSystem: true,
    permissions: [
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.CONTENT_CREATE,
      PERMISSIONS.CONTENT_UPDATE,
      PERMISSIONS.CONTENT_PUBLISH,
      PERMISSIONS.PRODUCTS_READ,
    ],
  },
  {
    slug: ROLES.AI_MANAGER,
    name: "AI Manager",
    description: "Configures AI prompts, knowledge sources, and content drafts",
    isStaffRole: true,
    isSystem: true,
    permissions: [
      PERMISSIONS.AI_READ,
      PERMISSIONS.AI_GENERATE,
      PERMISSIONS.AI_UPDATE,
      PERMISSIONS.PRODUCTS_READ,
    ],
  },
  {
    slug: ROLES.ANALYST,
    name: "Analyst",
    description: "Read-only access to business analytics and operational reports",
    isStaffRole: true,
    isSystem: true,
    permissions: [
      PERMISSIONS.ANALYTICS_READ,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.PAYMENTS_READ,
      PERMISSIONS.CUSTOMERS_READ,
    ],
  },
  {
    slug: ROLES.PROCUREMENT_SUPPLIER_MANAGER,
    name: "Procurement / Supplier Manager",
    description: "Manages suppliers, raw materials, and stock replenishment purchases",
    isStaffRole: true,
    isSystem: true,
    permissions: [
      PERMISSIONS.SUPPLIERS_READ,
      PERMISSIONS.SUPPLIERS_CREATE,
      PERMISSIONS.SUPPLIERS_UPDATE,
      PERMISSIONS.INVENTORY_READ,
    ],
  },
];

module.exports = {
  ALL_PERMISSION_CODES,
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
};
