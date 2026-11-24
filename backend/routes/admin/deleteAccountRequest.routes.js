const express = require("express");
const router = express.Router();

const { isAdmin } = require("../../middlewares/admin.middleware");
const {
  getAllRequests,
  approveRequest,
  rejectRequest,
  deleteRequestLog,
} = require("../../controllers/admin/deleteAccountRequest.controller");

// ========================================
// ADMIN DELETE ACCOUNT REQUEST ROUTES
// ========================================
router.get("/", isAdmin, getAllRequests);
router.patch("/:id/approve", isAdmin, approveRequest);
router.patch("/:id/reject", isAdmin, rejectRequest);
router.delete("/:id", isAdmin, deleteRequestLog);

module.exports = router;
