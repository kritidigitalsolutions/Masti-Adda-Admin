const express = require("express");
const router = express.Router();
const { isAdmin, hasPermission } = require("../../middlewares/admin.middleware");
const {
  getWebpageLayout,
  updateWebpageLayout,
} = require("../../controllers/admin/webpageLayout.controller");

// GET  /api/admin/webpage-layout  — fetch current layout (populated)
router.get("/", isAdmin, hasPermission("content"), getWebpageLayout);

// POST /api/admin/webpage-layout  — full overwrite / publish
router.post("/", isAdmin, hasPermission("content"), updateWebpageLayout);

module.exports = router;

