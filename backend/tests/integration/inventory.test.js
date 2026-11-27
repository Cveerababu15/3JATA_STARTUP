const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../src/app");
const ROLES = require("../../src/constants/roles");
const Role = require("../../src/models/Role.model");
const User = require("../../src/models/User.model");
const Inventory = require("../../src/models/Inventory.model");
const InventoryTransaction = require("../../src/models/InventoryTransaction.model");
const { seedRolesAndPermissions } = require("../../src/utils/seedRoles");
const {
  startTestDatabase,
  clearTestDatabase,
  stopTestDatabase,
} = require("../helpers/mongoMemory");

async function createAndLogin({ name, email, password, userType, roleSlug }) {
  const role = await Role.findOne({ slug: roleSlug });
  const passwordHash = await bcrypt.hash(password, 4);
  await User.create({
    name,
    email,
    passwordHash,
    userType,
    role: role._id,
    status: "active",
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
  });

  const agent = request.agent(app);
  const loginRes = await agent.post("/api/auth/login").send({ email, password });
  return { agent, csrfToken: loginRes.body.data.csrfToken };
}

async function seedCatalogItem(pm) {
  const catRes = await pm.agent
    .post("/api/categories")
    .set("X-CSRF-Token", pm.csrfToken)
    .send({ name: "Vegetable Powders" });

  const prodRes = await pm.agent
    .post("/api/products")
    .set("X-CSRF-Token", pm.csrfToken)
    .send({
      name: "Beetroot Powder",
      description: "Organic spray-dried beetroot powder",
      category: catRes.body.data.category.id,
      status: "active",
      variants: [{ sku: "3J-BEET-250G", weightValue: 250, weightUnit: "g", pricePaise: 24900 }],
    });

  return prodRes.body.data.product.variants[0].id;
}

describe("B1.6 Inventory Foundation (Integration with ReplicaSet Transactions)", () => {
  beforeAll(async () => {
    await startTestDatabase({ replicaSet: true });
  });

  beforeEach(async () => {
    await clearTestDatabase();
    await seedRolesAndPermissions();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it("enforces inventory permissions, initializes zero stock on variant creation, and tracks adjustments + low stock", async () => {
    const pm = await createAndLogin({
      name: "PM",
      email: "pm@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.PRODUCT_MANAGER,
    });
    const invMgr = await createAndLogin({
      name: "InvMgr",
      email: "invmgr@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.INVENTORY_MANAGER,
    });
    const analyst = await createAndLogin({
      name: "Analyst",
      email: "analyst@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.ANALYST,
    });
    const customer = await createAndLogin({
      name: "Cust",
      email: "cust@example.com",
      password: "Password123",
      userType: "customer",
      roleSlug: ROLES.CUSTOMER,
    });

    const variantId = await seedCatalogItem(pm);

    // Starting stock initialized at 0
    const initialRead = await invMgr.agent.get(`/api/inventory/${variantId}`);
    expect(initialRead.status).toBe(200);
    expect(initialRead.body.data.inventory.quantity).toBe(0);
    expect(initialRead.body.data.inventory.isOutOfStock).toBe(true);

    // Customer & Product Manager blocked from adjusting stock; Analyst read-only
    const custRead = await customer.agent.get("/api/inventory");
    expect(custRead.status).toBe(403);

    const pmAdjust = await pm.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ type: "initial_stock", quantityDelta: 50, reason: "Opening stock" });
    expect(pmAdjust.status).toBe(403);

    const analystRead = await analyst.agent.get("/api/inventory");
    expect(analystRead.status).toBe(200);

    const analystAdjust = await analyst.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", analyst.csrfToken)
      .send({ type: "initial_stock", quantityDelta: 50, reason: "Opening stock" });
    expect(analystAdjust.status).toBe(403);

    // Missing reason rejected
    const missingReason = await invMgr.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", invMgr.csrfToken)
      .send({ type: "initial_stock", quantityDelta: 50 });
    expect(missingReason.status).toBe(400);

    // Negative stock rejected
    const negativeRes = await invMgr.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", invMgr.csrfToken)
      .send({ type: "damaged", quantityDelta: -5, reason: "Water damage" });
    expect(negativeRes.status).toBe(400);

    // Receive initial stock of 15
    const addRes = await invMgr.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", invMgr.csrfToken)
      .send({ type: "initial_stock", quantityDelta: 15, reason: "Initial warehouse count" });
    expect(addRes.status).toBe(200);
    expect(addRes.body.data.inventory.quantity).toBe(15);
    expect(addRes.body.data.transaction.previousQuantity).toBe(0);
    expect(addRes.body.data.transaction.newQuantity).toBe(15);

    // Damaged reduction drops available to 8 (<= default threshold 10 -> low stock)
    const dmgRes = await invMgr.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", invMgr.csrfToken)
      .send({ type: "damaged", quantityDelta: -7, reason: "7 pouches torn during packing" });
    expect(dmgRes.status).toBe(200);
    expect(dmgRes.body.data.inventory.quantity).toBe(8);
    expect(dmgRes.body.data.inventory.isLowStock).toBe(true);

    // Low-stock endpoint lists it
    const lowStockRes = await invMgr.agent.get("/api/inventory/low-stock");
    expect(lowStockRes.status).toBe(200);
    expect(lowStockRes.body.data.items).toHaveLength(1);

    // Public product reflects live inventory availability
    const pubProducts = await request(app).get("/api/products?inStock=true");
    expect(pubProducts.status).toBe(200);
    expect(pubProducts.body.data.items).toHaveLength(1);
    expect(pubProducts.body.data.items[0].variants[0].stock.availableQuantity).toBe(8);

    // History records actor and timestamps
    const txRes = await invMgr.agent.get(`/api/inventory/transactions?variantId=${variantId}`);
    expect(txRes.status).toBe(200);
    expect(txRes.body.data.items).toHaveLength(2);
    expect(txRes.body.data.items[0].performedBy.email).toBe("invmgr@example.com");

    // Threshold endpoint updates alert threshold and respects permissions
    const pmThresh = await pm.agent
      .patch(`/api/inventory/${variantId}/threshold`)
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ lowStockThreshold: 5 });
    expect(pmThresh.status).toBe(403);

    const threshRes = await invMgr.agent
      .patch(`/api/inventory/${variantId}/threshold`)
      .set("X-CSRF-Token", invMgr.csrfToken)
      .send({ lowStockThreshold: 5 });
    expect(threshRes.status).toBe(200);
    expect(threshRes.body.data.inventory.lowStockThreshold).toBe(5);
    expect(threshRes.body.data.inventory.isLowStock).toBe(false);
  });

  it("handles idempotency retries safely and rejects conflicting key reuse", async () => {
    const pm = await createAndLogin({
      name: "PM",
      email: "pm@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.PRODUCT_MANAGER,
    });
    const invMgr = await createAndLogin({
      name: "InvMgr",
      email: "invmgr@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.INVENTORY_MANAGER,
    });

    const variantId = await seedCatalogItem(pm);
    const idempotencyKey = "restock-batch-2026-001";

    const first = await invMgr.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", invMgr.csrfToken)
      .set("Idempotency-Key", idempotencyKey)
      .send({ type: "stock_received", quantityDelta: 40, reason: "Supplier batch 1" });
    expect(first.status).toBe(200);
    expect(first.body.data.inventory.quantity).toBe(40);
    expect(first.body.data.idempotentReplay).toBe(false);

    // Exact retry does NOT double-credit stock
    const replay = await invMgr.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", invMgr.csrfToken)
      .set("Idempotency-Key", idempotencyKey)
      .send({ type: "stock_received", quantityDelta: 40, reason: "Supplier batch 1" });
    expect(replay.status).toBe(200);
    expect(replay.body.data.inventory.quantity).toBe(40);
    expect(replay.body.data.idempotentReplay).toBe(true);

    // Reusing key with different payload -> 409 Conflict
    const conflict = await invMgr.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", invMgr.csrfToken)
      .set("Idempotency-Key", idempotencyKey)
      .send({ type: "stock_received", quantityDelta: 99, reason: "Supplier batch 1" });
    expect(conflict.status).toBe(409);

    const txCount = await InventoryTransaction.countDocuments({ variant: variantId });
    expect(txCount).toBe(1);
  });

  it("maintains exact balance under concurrent adjustments and rolls back on transaction write failure", async () => {
    const pm = await createAndLogin({
      name: "PM",
      email: "pm@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.PRODUCT_MANAGER,
    });
    const invMgr = await createAndLogin({
      name: "InvMgr",
      email: "invmgr@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.INVENTORY_MANAGER,
    });

    const variantId = await seedCatalogItem(pm);

    await invMgr.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", invMgr.csrfToken)
      .send({ type: "initial_stock", quantityDelta: 100, reason: "Opening stock" });

    // 5 concurrent adjustments (-5 each => expected final quantity = 75)
    const concurrentCalls = Array.from({ length: 5 }, (_, idx) =>
      invMgr.agent
        .patch(`/api/inventory/${variantId}/adjust`)
        .set("X-CSRF-Token", invMgr.csrfToken)
        .send({
          type: "manual_adjustment",
          quantityDelta: -5,
          reason: `Concurrent audit #${idx + 1}`,
        })
    );
    const results = await Promise.all(concurrentCalls);
    for (const res of results) {
      expect(res.status).toBe(200);
    }

    const invAfterConcurrent = await Inventory.findOne({ variant: variantId }).lean();
    expect(invAfterConcurrent.quantity).toBe(75);

    const txCountBeforeFail = await InventoryTransaction.countDocuments({ variant: variantId });
    expect(txCountBeforeFail).toBe(6);

    // Simulate failed write when recording InventoryTransaction -> transaction must roll back Inventory.quantity!
    const createSpy = jest
      .spyOn(InventoryTransaction, "create")
      .mockRejectedValueOnce(new Error("Simulated disk write failure"));

    const failedRes = await invMgr.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", invMgr.csrfToken)
      .send({ type: "stock_received", quantityDelta: 25, reason: "Should rollback" });
    expect(failedRes.status).toBe(500);

    createSpy.mockRestore();

    const invAfterRollback = await Inventory.findOne({ variant: variantId }).lean();
    expect(invAfterRollback.quantity).toBe(75);
    const txCountAfterRollback = await InventoryTransaction.countDocuments({ variant: variantId });
    expect(txCountAfterRollback).toBe(6);

    // Unsupported standalone MongoDB deployment fails clearly with 503 rather than falling back unsafely
    const sessionSpy = jest.spyOn(mongoose, "startSession").mockResolvedValueOnce({
      withTransaction: jest
        .fn()
        .mockRejectedValueOnce(
          Object.assign(
            new Error("Transaction numbers are only allowed on a replica set member or mongos"),
            { code: 20, codeName: "IllegalOperation" }
          )
        ),
      endSession: jest.fn().mockResolvedValue(undefined),
    });

    const standaloneFail = await invMgr.agent
      .patch(`/api/inventory/${variantId}/adjust`)
      .set("X-CSRF-Token", invMgr.csrfToken)
      .send({ type: "stock_received", quantityDelta: 10, reason: "Standalone check" });
    expect(standaloneFail.status).toBe(503);
    expect(standaloneFail.body.message).toMatch(/replica set/i);

    sessionSpy.mockRestore();

    const invAfterStandalone = await Inventory.findOne({ variant: variantId }).lean();
    expect(invAfterStandalone.quantity).toBe(75);
    const txCountAfterStandalone = await InventoryTransaction.countDocuments({
      variant: variantId,
    });
    expect(txCountAfterStandalone).toBe(6);
  });
});
