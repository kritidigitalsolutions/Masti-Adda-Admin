const express = require("express");
const router = express.Router();
const {
  getWebpageLayout,
  getWebpageHeroBanners,
  getWebpageSections,
  getWebpageSectionBySlug,
} = require("../../controllers/user/webpageLayout.controller");

// GET /api/webpage-layout               — full layout
router.get("/", getWebpageLayout);

// GET /api/webpage-layout/banners       — hero banners only
router.get("/banners", getWebpageHeroBanners);

// GET /api/webpage-layout/sections      — all carousel sections
router.get("/sections", getWebpageSections);

// GET /api/webpage-layout/sections/:slug — single section by slug
router.get("/sections/:slug", getWebpageSectionBySlug);

module.exports = router;

