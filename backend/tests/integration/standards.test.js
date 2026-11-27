const request = require("supertest");
const app = require("../../src/app");

describe("B1.2 Backend Standards (HTTP Integration)", () => {
  it("GET /api/health returns 200 with request correlation header and DB status", async () => {
    const res = await request(app).get("/api/health").set("X-Request-Id", "integ-req-001");

    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBe("integ-req-001");
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("database");
    expect(res.body.data).toHaveProperty("uptimeSeconds");
  });

  it("GET /api/health/ready returns 503 when database is not connected", async () => {
    const res = await request(app).get("/api/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe("not_ready");
  });

  it("GET /api/does-not-exist returns clean JSON 404 envelope", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: "Route not found: GET /api/does-not-exist",
      errors: [],
    });
  });

  it("rejects malformed JSON body with clean 400 envelope", async () => {
    const res = await request(app)
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send('{"brokenJson": ');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid JSON payload");
  });

  it("rejects disallowed CORS Origin and sets security headers", async () => {
    const res = await request(app).get("/api/health").set("Origin", "https://evil.example.com");

    expect(res.status).toBe(403);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
