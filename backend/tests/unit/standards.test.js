const httpStatus = require("../../src/constants/httpStatus");
const ApiError = require("../../src/utils/ApiError");
const errorMiddleware = require("../../src/middleware/error.middleware");
const requestIdMiddleware = require("../../src/middleware/requestId.middleware");
const {
  parsePagination,
  buildPaginationMeta,
  parseSort,
  escapeRegex,
  isValidObjectId,
} = require("../../src/utils/queryFeatures");

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    body: null,
    setHeader(name, val) {
      headers[name.toLowerCase()] = val;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("B1.2 Backend Standards (Unit)", () => {
  describe("queryFeatures", () => {
    it("clamps pagination parameters safely", () => {
      expect(parsePagination({ page: "-2", limit: "999" })).toEqual({
        page: 1,
        limit: 100,
        skip: 0,
      });
      expect(parsePagination({ page: "3", limit: "10" })).toEqual({
        page: 3,
        limit: 10,
        skip: 20,
      });
      expect(buildPaginationMeta({ page: 2, limit: 10, total: 25 })).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it("resolves sort only from an explicit allowlist", () => {
      const allowed = { newest: { createdAt: -1 }, name_asc: { name: 1 } };
      expect(parseSort("name_asc", allowed, { createdAt: -1 })).toEqual({ name: 1 });
      expect(parseSort("$where", allowed, { createdAt: -1 })).toEqual({ createdAt: -1 });
    });

    it("escapes regex special characters and validates ObjectIds", () => {
      expect(escapeRegex("a+b*(c)?")).toBe("a\\+b\\*\\(c\\)\\?");
      expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
      expect(isValidObjectId("not-an-id")).toBe(false);
    });
  });

  describe("requestIdMiddleware", () => {
    it("preserves a valid incoming X-Request-Id and generates one when missing/unsafe", () => {
      const next = jest.fn();
      const res1 = createMockRes();
      requestIdMiddleware({ get: () => "req-12345678" }, res1, next);
      expect(res1.getHeader("x-request-id")).toBe("req-12345678");

      const res2 = createMockRes();
      requestIdMiddleware({ get: () => "bad id with spaces!" }, res2, next);
      expect(res2.getHeader("x-request-id")).toMatch(/^[0-9a-f-]{36}$/i);
    });
  });

  describe("errorMiddleware", () => {
    it("normalizes Mongo duplicate key, CastError, and operational ApiError without stack leaks", () => {
      const req = { id: "test-req-1" };

      const resDup = createMockRes();
      errorMiddleware(
        { code: 11000, keyPattern: { email: 1 }, message: "E11000 raw mongo string" },
        req,
        resDup,
        jest.fn()
      );
      expect(resDup.statusCode).toBe(httpStatus.CONFLICT);
      expect(resDup.body.success).toBe(false);
      expect(resDup.body.message).toBe("email already exists");
      expect(resDup.body.stack).toBeUndefined();

      const resCast = createMockRes();
      errorMiddleware({ name: "CastError", path: "productId" }, req, resCast, jest.fn());
      expect(resCast.statusCode).toBe(httpStatus.BAD_REQUEST);

      const resApi = createMockRes();
      errorMiddleware(new ApiError(422, "Invalid state"), req, resApi, jest.fn());
      expect(resApi.statusCode).toBe(422);
      expect(resApi.body.message).toBe("Invalid state");

      const resUnexpected = createMockRes();
      errorMiddleware(new Error("Internal DB secret crash"), req, resUnexpected, jest.fn());
      expect(resUnexpected.statusCode).toBe(500);
      expect(resUnexpected.body.message).toBe("Internal server error");
      expect(resUnexpected.body.stack).toBeUndefined();
    });
  });
});
