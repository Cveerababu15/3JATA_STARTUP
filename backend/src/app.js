const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const env = require("./config/env");

const apiRoutes = require("./routes");
const requestLogger = require("./middleware/requestLogger.middleware");
const notFoundMiddleware = require("./middleware/notFound.middleware");
const errorMiddleware = require("./middleware/error.middleware");
const apiRateLimiter = require("./middleware/rateLimit.middleware");

const app = express();

// Security
app.use(helmet());
app.use(cors());

// Request parsing
app.use(express.json());

// Development request logging
app.use(requestLogger);

// Rate limiting
app.use("/api", apiRateLimiter);

// API routes
app.use("/api", apiRoutes);

// Unknown route handler
app.use(notFoundMiddleware);

// Global error handler
app.use(errorMiddleware);
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Organic Powder API is Running"
    });
});

module.exports = app;