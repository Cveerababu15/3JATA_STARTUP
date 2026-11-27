const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const env = require("./config/env");
const apiRoutes = require("./routes");
const requestIdMiddleware = require("./middleware/requestId.middleware");
const requestLogger = require("./middleware/requestLogger.middleware");
const notFoundMiddleware = require("./middleware/notFound.middleware");
const errorMiddleware = require("./middleware/error.middleware");
const apiRateLimiter = require("./middleware/rateLimit.middleware");

const app = express();

if (env.trustProxy) {
  app.set("trust proxy", 1);
}

// Correlation ID & security headers
app.use(requestIdMiddleware);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser tools (Postman, curl, server-to-server) do not send an Origin header
      if (!origin) {
        return callback(null, true);
      }
      if (env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Request-Id"],
  })
);

// Request parsing with explicit size limits and cookies
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: env.jsonBodyLimit }));
app.use(cookieParser());

// Safe structured request logging
app.use(requestLogger);

// Global API rate limiting
app.use("/api", apiRateLimiter);

// API routes
app.use("/api", apiRoutes);

// Unknown route handler
app.use(notFoundMiddleware);

// Global error handler
app.use(errorMiddleware);

module.exports = app;
