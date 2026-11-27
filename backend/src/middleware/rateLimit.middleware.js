const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const httpStatus = require("../constants/httpStatus");
const messages = require("../constants/messages");

function createRateLimiter({ windowMs, limit, message = messages.TOO_MANY_REQUESTS }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest && process.env.ENABLE_RATE_LIMIT_IN_TEST !== "true",
    handler: (req, res) => {
      return res.status(httpStatus.TOO_MANY_REQUESTS).json({
        success: false,
        message,
        errors: [],
      });
    },
  });
}

const apiRateLimiter = createRateLimiter({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMax,
});

// Tighter limiter for sensitive auth endpoints (login, register, password reset, resend verification)
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many authentication attempts. Please try again later.",
});

module.exports = apiRateLimiter;
module.exports.apiRateLimiter = apiRateLimiter;
module.exports.authRateLimiter = authRateLimiter;
module.exports.createRateLimiter = createRateLimiter;
