const express = require("express");
const router = express.Router();

const { isAuth } = require("../../middlewares/auth.middleware");
const {
  submitRequest,
  getMyRequestStatus,
} = require("../../controllers/user/deleteAccountRequest.controller");

// ========================================
// USER DELETE ACCOUNT REQUEST ROUTES
// ========================================
router.post("/", isAuth, submitRequest);
router.get("/status", isAuth, getMyRequestStatus);

module.exports = router;
