const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const healthRoutes = require("../../src/routes/health.routes");
const authRoutes = require("../../src/routes/auth.routes");
const adminRoutes = require("../../src/routes/admin.routes");
const categoryRoutes = require("../../src/routes/category.routes");
const productRoutes = require("../../src/routes/product.routes");
const variantRoutes = require("../../src/routes/variant.routes");
const inventoryRoutes = require("../../src/routes/inventory.routes");

function extractMountedRoutes() {
  const mounts = [
    ["/api/health", healthRoutes],
    ["/api/auth", authRoutes],
    ["/api/admin", adminRoutes],
    ["/api/categories", categoryRoutes],
    ["/api/products", productRoutes],
    ["/api/variants", variantRoutes],
    ["/api/inventory", inventoryRoutes],
  ];

  const endpoints = [];
  for (const [prefix, router] of mounts) {
    for (const layer of router.stack) {
      if (layer.route) {
        const subPath = layer.route.path === "/" ? "" : layer.route.path;
        const fullPath = `${prefix}${subPath}`;
        for (const method of Object.keys(layer.route.methods)) {
          if (layer.route.methods[method]) {
            endpoints.push(`${method.toUpperCase()} ${fullPath}`);
          }
        }
      }
    }
  }
  return endpoints.sort();
}

function normalizePostmanRoute(rawUrl) {
  const withoutBase = rawUrl.replace("{{baseUrl}}", "/api").split("?")[0];
  return withoutBase
    .replace(/\{\{staffId\}\}/g, ":id")
    .replace(/\{\{categoryId\}\}/g, ":id")
    .replace(/\{\{subcategoryId\}\}/g, ":id")
    .replace(/\{\{productId\}\}/g, ":id")
    .replace(/\{\{variantId\}\}/g, ":variantId")
    .replace(/\{\{imageId\}\}/g, ":imageId");
}

function normalizeOpenApiPath(openApiPath) {
  return `/api${openApiPath.replace(/\{([^}]+)\}/g, ":$1")}`;
}

function normalizeToTemplate(routeStr) {
  // Canonicalize parameter names so :id vs :variantId vs :slug in concrete Postman paths match cleanly
  const [method, rawPath] = routeStr.split(" ");
  const normalizedPath = rawPath
    .replace(/^\/api\/(categories|products)\/[a-z0-9-]+$/, "/api/$1/:slug")
    .replace(/:[a-zA-Z0-9_]+/g, ":param");
  return `${method} ${normalizedPath}`;
}

describe("Backend Foundation Documentation, OpenAPI, and Postman Contract Verification", () => {
  const mountedRoutes = extractMountedRoutes();

  it("extracts all 45 mounted Express routes", () => {
    expect(mountedRoutes).toHaveLength(45);
  });

  it("validates Postman v2.1 collection JSON and confirms 100% endpoint coverage", () => {
    const collectionPath = path.resolve(
      __dirname,
      "../../postman/3JATA-Backend-Foundation.postman_collection.json"
    );
    const collection = JSON.parse(fs.readFileSync(collectionPath, "utf8"));

    expect(collection.info.schema).toBe(
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    );

    const collected = [];
    function walk(items) {
      for (const item of items) {
        if (item.item) {
          walk(item.item);
        } else if (item.request) {
          const method = item.request.method.toUpperCase();
          let route = normalizePostmanRoute(item.request.url.raw);
          // Map concrete variant PATCH/DELETE {{variantId}} back to /api/variants/:id
          if (route.startsWith("/api/variants/:variantId")) {
            route = route.replace("/api/variants/:variantId", "/api/variants/:id");
          }
          collected.push(normalizeToTemplate(`${method} ${route}`));
        }
      }
    }
    walk(collection.item);

    const collectedSet = new Set(collected);
    const missing = mountedRoutes.filter((r) => !collectedSet.has(normalizeToTemplate(r)));
    expect(missing).toEqual([]);
  });

  it("validates OpenAPI 3.0 YAML and confirms 100% endpoint coverage", () => {
    const openApiPath = path.resolve(__dirname, "../../docs/api/openapi.yaml");
    const doc = yaml.load(fs.readFileSync(openApiPath, "utf8"));

    expect(doc.openapi).toMatch(/^3\.0\./);
    expect(doc.paths).toBeDefined();

    const specEndpoints = new Set();
    for (const [p, methodsObj] of Object.entries(doc.paths)) {
      for (const method of Object.keys(methodsObj)) {
        if (["get", "post", "put", "patch", "delete"].includes(method.toLowerCase())) {
          specEndpoints.add(
            normalizeToTemplate(`${method.toUpperCase()} ${normalizeOpenApiPath(p)}`)
          );
        }
      }
    }

    const missing = mountedRoutes.filter((r) => !specEndpoints.has(normalizeToTemplate(r)));
    expect(missing).toEqual([]);
  });

  it("confirms api-endpoint-index.md covers 100% of mounted routes", () => {
    const indexPath = path.resolve(
      __dirname,
      "../../docs/backend-foundation/api-endpoint-index.md"
    );
    const content = fs.readFileSync(indexPath, "utf8");

    const missing = mountedRoutes.filter((r) => {
      const [method, routePath] = r.split(" ");
      return !content.includes(`\`${method}\` | \`${routePath}\``);
    });
    expect(missing).toEqual([]);
  });

  it("validates Postman local environment JSON without embedded secrets", () => {
    const envPath = path.resolve(__dirname, "../../postman/3JATA-local.postman_environment.json");
    const envJson = JSON.parse(fs.readFileSync(envPath, "utf8"));
    const keys = new Set(envJson.values.map((v) => v.key));

    expect(keys.has("baseUrl")).toBe(true);
    expect(keys.has("csrfToken")).toBe(true);
    expect(keys.has("customerId")).toBe(true);
    expect(keys.has("staffId")).toBe(true);
    expect(keys.has("roleId")).toBe(true);
    expect(keys.has("categoryId")).toBe(true);
    expect(keys.has("productId")).toBe(true);
    expect(keys.has("variantId")).toBe(true);

    // Ensure no live secrets were exported
    for (const entry of envJson.values) {
      if (entry.key !== "baseUrl") {
        expect(entry.value).toBe("");
      }
    }
  });
});
