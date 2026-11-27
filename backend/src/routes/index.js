const express = require("express");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const adminRoutes = require("./admin.routes");
const categoryRoutes = require("./category.routes");
const productRoutes = require("./product.routes");
const variantRoutes = require("./variant.routes");
const inventoryRoutes = require("./inventory.routes");

const router = express.Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/variants", variantRoutes);
router.use("/inventory", inventoryRoutes);

module.exports = router;
