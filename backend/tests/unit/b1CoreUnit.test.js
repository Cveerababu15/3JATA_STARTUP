const { toSlug } = require("../../src/utils/slug");
const { sanitizeUser } = require("../../src/services/auth.service");
const {
  requireStaff,
  requirePermission,
  requireAnyPermission,
} = require("../../src/middleware/permission.middleware");
const { PASSWORD_REGEX } = require("../../src/validators/auth.validator");

describe("B1 Core Unit Checks (Slugs, Sanitization, Password Policy, RBAC Middleware)", () => {
  it("normalizes slugs safely across unicode and punctuation", () => {
    expect(toSlug("  Organic Beetroot Powder (250g)! ")).toBe("organic-beetroot-powder-250g");
    expect(toSlug("Crème Brûlée Mango")).toBe("creme-brulee-mango");
  });

  it("enforces strong password complexity and excludes sensitive fields in sanitizeUser", () => {
    expect(PASSWORD_REGEX.test("weak")).toBe(false);
    expect(PASSWORD_REGEX.test("alllowercase1")).toBe(false);
    expect(PASSWORD_REGEX.test("NoNumbersHere")).toBe(false);
    expect(PASSWORD_REGEX.test("StrongPass123")).toBe(true);

    const sanitized = sanitizeUser({
      _id: "507f1f77bcf86cd799439011",
      name: "Test User",
      email: "test@example.com",
      passwordHash: "$2b$12$secret_hash_must_never_leak",
      suspendedReason: "Private internal reason",
      userType: "customer",
      status: "active",
      isEmailVerified: true,
      role: {
        _id: "507f1f77bcf86cd799439012",
        name: "Customer",
        slug: "customer",
        permissions: [{ code: "products.create" }], // customer must still get []
      },
    });

    expect(sanitized.passwordHash).toBeUndefined();
    expect(sanitized.suspendedReason).toBeUndefined();
    expect(sanitized.permissions).toEqual([]);
  });

  it("enforces requireStaff, requirePermission, and requireAnyPermission", () => {
    const nextUnauth = jest.fn();
    requireStaff({}, {}, nextUnauth);
    expect(nextUnauth.mock.calls[0][0].statusCode).toBe(401);

    const nextCust = jest.fn();
    requirePermission("products.read")(
      { user: { userType: "customer" }, permissions: new Set(["products.read"]) },
      {},
      nextCust
    );
    expect(nextCust.mock.calls[0][0].statusCode).toBe(403);

    const nextMissing = jest.fn();
    requireAnyPermission(["inventory.read", "inventory.adjust"])(
      { user: { userType: "staff" }, permissions: new Set(["products.read"]) },
      {},
      nextMissing
    );
    expect(nextMissing.mock.calls[0][0].statusCode).toBe(403);

    const nextAllowed = jest.fn();
    requireAnyPermission(["inventory.read", "inventory.adjust"])(
      { user: { userType: "staff" }, permissions: new Set(["inventory.read"]) },
      {},
      nextAllowed
    );
    expect(nextAllowed).toHaveBeenCalledWith();
  });
});
