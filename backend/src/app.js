const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();

// Security headers
app.use(helmet());

// Allow frontend requests
app.use(cors());

// Parse JSON
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Organic Powder API is Running"
    });
});

module.exports = app;