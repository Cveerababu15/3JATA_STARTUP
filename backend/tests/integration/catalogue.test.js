const bcrypt = require("bcryptjs");
const request = require("supertest");
const app = require("../../src/app");
const ROLES = require("../../src/constants/roles");
const Role = require("../../src/models/Role.model");
const User = require("../../src/models/User.model");
const Product = require("../../src/models/Product.model");
const ProductVariant = require("../../src/models/ProductVariant.model");
const cloudinaryService = require("../../src/services/cloudinary.service");
const { seedRolesAndPermissions } = require("../../src/utils/seedRoles");
const {
  startTestDatabase,
  clearTestDatabase,
  stopTestDatabase,
} = require("../helpers/mongoMemory");

async function createAndLoginUser({ name, email, password, userType, roleSlug }) {
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

describe("B1.5 Product Catalogue (Integration)", () => {
  beforeAll(async () => {
    await startTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    await seedRolesAndPermissions();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  it("enforces category uniqueness, parent-child structure, cycle prevention, and archival rules", async () => {
    const pm = await createAndLoginUser({
      name: "Priya Product",
      email: "pm@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.PRODUCT_MANAGER,
    });

    const catRes = await pm.agent
      .post("/api/categories")
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ name: "Vegetable Powders", description: "Sun-dried vegetable powders" });
    expect(catRes.status).toBe(201);
    const parentId = catRes.body.data.category.id;

    // Duplicate slug -> 409
    const dupCat = await pm.agent
      .post("/api/categories")
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ name: "Vegetable Powders" });
    expect(dupCat.status).toBe(409);

    // Create subcategory
    const subRes = await pm.agent
      .post("/api/categories")
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ name: "Root Powders", parent: parentId });
    expect(subRes.status).toBe(201);
    const subId = subRes.body.data.category.id;

    // Cycle check: setting parent's parent to its child -> 400
    const cycleRes = await pm.agent
      .patch(`/api/categories/${parentId}`)
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ parent: subId });
    expect(cycleRes.status).toBe(400);

    // Archiving parent while child is active -> 400
    const archiveParentFail = await pm.agent
      .delete(`/api/categories/${parentId}`)
      .set("X-CSRF-Token", pm.csrfToken);
    expect(archiveParentFail.status).toBe(400);

    // Public list and slug detail return hierarchy
    const publicCats = await request(app).get("/api/categories");
    expect(publicCats.status).toBe(200);
    expect(publicCats.body.data.items).toHaveLength(2);

    const catBySlug = await request(app).get("/api/categories/vegetable-powders");
    expect(catBySlug.status).toBe(200);
    expect(catBySlug.body.data.category.subcategories).toHaveLength(1);

    // Normal category update + archival of empty subcategory then parent
    const updSub = await pm.agent
      .patch(`/api/categories/${subId}`)
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ description: "Updated root powders" });
    expect(updSub.status).toBe(200);
    expect(updSub.body.data.category.description).toBe("Updated root powders");

    const archiveSub = await pm.agent
      .delete(`/api/categories/${subId}`)
      .set("X-CSRF-Token", pm.csrfToken);
    expect(archiveSub.status).toBe(200);

    const archiveParentOk = await pm.agent
      .delete(`/api/categories/${parentId}`)
      .set("X-CSRF-Token", pm.csrfToken);
    expect(archiveParentOk.status).toBe(200);

    // Archived categories hidden from public slug/list, visible in /manage
    const pubAfterCatArchive = await request(app).get("/api/categories/vegetable-powders");
    expect(pubAfterCatArchive.status).toBe(404);

    const manageCats = await pm.agent.get("/api/categories/manage?includeArchived=true");
    expect(manageCats.status).toBe(200);
    expect(manageCats.body.data.items).toHaveLength(2);
  });

  it("controls public visibility, variant SKUs, integer paise prices, filtering/sorting, and archival", async () => {
    const pm = await createAndLoginUser({
      name: "Priya Product",
      email: "pm@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.PRODUCT_MANAGER,
    });

    const customer = await createAndLoginUser({
      name: "Buyer",
      email: "buyer@example.com",
      password: "Password123",
      userType: "customer",
      roleSlug: ROLES.CUSTOMER,
    });

    const catRes = await pm.agent
      .post("/api/categories")
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ name: "Fruit Powders" });
    const categoryId = catRes.body.data.category.id;

    // Customer cannot create products
    const custCreate = await customer.agent
      .post("/api/products")
      .set("X-CSRF-Token", customer.csrfToken)
      .send({
        name: "Unauthorized Powder",
        description: "Test",
        category: categoryId,
      });
    expect(custCreate.status).toBe(403);

    // Reject float prices and stock field on product creation
    const floatPriceRes = await pm.agent
      .post("/api/products")
      .set("X-CSRF-Token", pm.csrfToken)
      .send({
        name: "Mango Powder",
        description: "Pure Alphonso mango powder",
        category: categoryId,
        variants: [{ sku: "3J-MANGO-100", weightValue: 100, pricePaise: 149.5 }],
      });
    expect(floatPriceRes.status).toBe(400);

    const stockRejectRes = await pm.agent
      .post("/api/products")
      .set("X-CSRF-Token", pm.csrfToken)
      .send({
        name: "Mango Powder",
        description: "Pure Alphonso mango powder",
        category: categoryId,
        stock: 50,
      });
    expect(stockRejectRes.status).toBe(400);

    // Create draft product first
    const draftRes = await pm.agent
      .post("/api/products")
      .set("X-CSRF-Token", pm.csrfToken)
      .send({
        name: "Raw Banana Powder",
        description: "Traditional Kerala Nendran banana powder",
        category: categoryId,
        tags: ["baby-food", "smoothie"],
        ingredients: ["100% Organic Raw Banana"],
        origin: "Palakkad, Kerala",
        processingMethod: "Shade-dried and stone-milled",
        storageInstructions: "Store in airtight jar",
        shelfLife: "12 months",
        status: "draft",
        internalNotes: "Awaiting lab report before publish",
        variants: [
          {
            sku: "3J-BAN-100G",
            weightValue: 100,
            weightUnit: "g",
            pricePaise: 19900,
            mrpPaise: 24900,
          },
          { sku: "3J-BAN-250G", weightValue: 250, weightUnit: "g", pricePaise: 39900 },
        ],
      });
    expect(draftRes.status).toBe(201);
    const bananaId = draftRes.body.data.product.id;

    // Draft is hidden from public listing & slug detail
    const pubListDraft = await request(app).get("/api/products");
    expect(pubListDraft.body.data.items).toHaveLength(0);

    const pubSlugDraft = await request(app).get("/api/products/raw-banana-powder");
    expect(pubSlugDraft.status).toBe(404);

    // Publish banana powder
    await pm.agent
      .patch(`/api/products/${bananaId}`)
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ status: "active", isBestseller: true });

    // Create active cheaper product for sorting/filtering
    await pm.agent
      .post("/api/products")
      .set("X-CSRF-Token", pm.csrfToken)
      .send({
        name: "Amla Powder",
        description: "Vitamin C rich organic Indian gooseberry powder",
        category: categoryId,
        tags: ["immunity"],
        status: "active",
        isFeatured: true,
        variants: [{ sku: "3J-AMLA-100G", weightValue: 100, weightUnit: "g", pricePaise: 12900 }],
      });

    // Duplicate SKU across products -> 409
    const dupSkuRes = await pm.agent
      .post(`/api/products/${bananaId}/variants`)
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ sku: "3J-AMLA-100G", weightValue: 500, weightUnit: "g", pricePaise: 49900 });
    expect(dupSkuRes.status).toBe(409);

    // Add valid new variant, update variant price, and archive one variant
    const addVarRes = await pm.agent
      .post(`/api/products/${bananaId}/variants`)
      .set("X-CSRF-Token", pm.csrfToken)
      .send({
        sku: "3J-BAN-500G",
        label: "500g Family Pack",
        weightValue: 500,
        weightUnit: "g",
        pricePaise: 69900,
      });
    expect(addVarRes.status).toBe(201);
    const addedVarId = addVarRes.body.data.variant.id;

    const patchVarRes = await pm.agent
      .patch(`/api/variants/${addedVarId}`)
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ pricePaise: 64900, mrpPaise: 74900 });
    expect(patchVarRes.status).toBe(200);
    expect(patchVarRes.body.data.variant.pricePaise).toBe(64900);

    const invalidVarPatch = await pm.agent
      .patch(`/api/variants/${addedVarId}`)
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ mrpPaise: 10000 });
    expect(invalidVarPatch.status).toBe(400);

    const delVarRes = await pm.agent
      .delete(`/api/variants/${addedVarId}`)
      .set("X-CSRF-Token", pm.csrfToken);
    expect(delVarRes.status).toBe(200);

    // Management list and detail expose internalNotes; customer gets 403
    const custManage = await customer.agent.get("/api/products/manage");
    expect(custManage.status).toBe(403);

    const pmManageList = await pm.agent.get("/api/products/manage");
    expect(pmManageList.status).toBe(200);
    expect(pmManageList.body.data.items).toHaveLength(2);

    const pmManageOne = await pm.agent.get(`/api/products/manage/${bananaId}`);
    expect(pmManageOne.status).toBe(200);
    expect(pmManageOne.body.data.product.internalNotes).toBe("Awaiting lab report before publish");

    // Public detail by slug works for active product, excludes archived variant & internalNotes
    const pubDetail = await request(app).get("/api/products/raw-banana-powder");
    expect(pubDetail.status).toBe(200);
    expect(pubDetail.body.data.product.internalNotes).toBeUndefined();
    expect(pubDetail.body.data.product.variants).toHaveLength(2);

    // Public listing excludes internalNotes and supports sorting/filtering
    const sortedRes = await request(app).get("/api/products?sort=price_asc");
    expect(sortedRes.status).toBe(200);
    expect(sortedRes.body.data.items.map((p) => p.slug)).toEqual([
      "amla-powder",
      "raw-banana-powder",
    ]);
    expect(sortedRes.body.data.items[0].internalNotes).toBeUndefined();

    const filteredRes = await request(app).get("/api/products?bestseller=true&tag=smoothie");
    expect(filteredRes.body.data.items).toHaveLength(1);
    expect(filteredRes.body.data.items[0].slug).toBe("raw-banana-powder");

    // Archive preserves documents in DB while removing from public view
    const archiveRes = await pm.agent
      .delete(`/api/products/${bananaId}`)
      .set("X-CSRF-Token", pm.csrfToken);
    expect(archiveRes.status).toBe(200);

    const pubAfterArchive = await request(app).get("/api/products/raw-banana-powder");
    expect(pubAfterArchive.status).toBe(404);

    const dbProduct = await Product.findById(bananaId).lean();
    const dbVariants = await ProductVariant.find({ product: bananaId }).lean();
    expect(dbProduct.status).toBe("archived");
    expect(dbVariants).toHaveLength(3);
  });

  it("restricts product image upload and ownership-verified deletion", async () => {
    const uploadSpy = jest.spyOn(cloudinaryService, "uploadProductImageBuffer").mockResolvedValue({
      url: "https://res.cloudinary.com/demo/image/upload/v1/3jata/img1.png",
      publicId: "3jata/products/prod/img1",
    });
    const deleteSpy = jest
      .spyOn(cloudinaryService, "deleteCloudinaryImage")
      .mockResolvedValue({ result: "ok" });

    const pm = await createAndLoginUser({
      name: "Priya Product",
      email: "pm@example.com",
      password: "Password123",
      userType: "staff",
      roleSlug: ROLES.PRODUCT_MANAGER,
    });

    const catRes = await pm.agent
      .post("/api/categories")
      .set("X-CSRF-Token", pm.csrfToken)
      .send({ name: "Herbal Powders" });

    const p1 = await pm.agent.post("/api/products").set("X-CSRF-Token", pm.csrfToken).send({
      name: "Moringa Powder",
      description: "Shade-dried moringa leaf powder",
      category: catRes.body.data.category.id,
      status: "active",
    });
    const p2 = await pm.agent.post("/api/products").set("X-CSRF-Token", pm.csrfToken).send({
      name: "Spinach Powder",
      description: "Dehydrated spinach leaf powder",
      category: catRes.body.data.category.id,
      status: "active",
    });
    const prod1Id = p1.body.data.product.id;
    const prod2Id = p2.body.data.product.id;

    // Unsupported MIME type rejected
    const badMimeRes = await pm.agent
      .post(`/api/products/${prod1Id}/images`)
      .set("X-CSRF-Token", pm.csrfToken)
      .attach("image", Buffer.from("<svg></svg>"), {
        filename: "vector.svg",
        contentType: "image/svg+xml",
      });
    expect(badMimeRes.status).toBe(400);

    // Oversized image (>2MB) rejected with 413
    const oversizedBuf = Buffer.alloc(2 * 1024 * 1024 + 64, 0);
    const bigFileRes = await pm.agent
      .post(`/api/products/${prod1Id}/images`)
      .set("X-CSRF-Token", pm.csrfToken)
      .attach("image", oversizedBuf, {
        filename: "huge.png",
        contentType: "image/png",
      });
    expect(bigFileRes.status).toBe(413);

    // Spoofed PNG signature is rejected
    const badFileRes = await pm.agent
      .post(`/api/products/${prod1Id}/images`)
      .set("X-CSRF-Token", pm.csrfToken)
      .attach("image", Buffer.from("not-a-real-png-binary"), {
        filename: "fake.png",
        contentType: "image/png",
      });
    expect(badFileRes.status).toBe(400);

    // Valid PNG magic bytes upload succeeds
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const uploadRes = await pm.agent
      .post(`/api/products/${prod1Id}/images`)
      .set("X-CSRF-Token", pm.csrfToken)
      .field("alt", "Moringa pouch")
      .attach("image", validPng, { filename: "moringa.png", contentType: "image/png" });
    expect(uploadRes.status).toBe(201);
    const imageId = uploadRes.body.data.image.id;

    // Ownership check: cannot delete prod1's image via prod2's URL
    const wrongOwnerDel = await pm.agent
      .delete(`/api/products/${prod2Id}/images/${imageId}`)
      .set("X-CSRF-Token", pm.csrfToken);
    expect(wrongOwnerDel.status).toBe(404);

    // Delete via owning product succeeds
    const delRes = await pm.agent
      .delete(`/api/products/${prod1Id}/images/${imageId}`)
      .set("X-CSRF-Token", pm.csrfToken);
    expect(delRes.status).toBe(200);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});
