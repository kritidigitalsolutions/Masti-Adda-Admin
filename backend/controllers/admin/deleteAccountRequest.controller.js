const mongoose = require("mongoose");
const DeleteAccountRequest = require("../../models/deleteAccountRequest.model");
const User = require("../../models/user.model");
const Subscription = require("../../models/subscription.model");
const Watchlist = require("../../models/watchlist.model");
const SupportTicket = require("../../models/supportTicket.model");
const SupportMessage = require("../../models/supportMessage.model");
const Rating = require("../../models/rating.model");
const Interaction = require("../../models/interaction.model");
const Notification = require("../../models/notification.model");
const Voucher = require("../../models/voucher.model");
const OTP = require("../../models/user.otp.model");
const WatchProgress = require("../../models/watchProgress.model");
const AudioProgress = require("../../models/audioProgress.model");
const Comment = require("../../models/comment.model");
const AIReelWatch = require("../../models/aiReelWatch.model");
const AIReelUserState = require("../../models/aiReelUserState.model");
const AIReelFeedSession = require("../../models/aiReelFeedSession.model");

// ========================================
// GET ALL DELETE ACCOUNT REQUESTS (WITH STATS & FILTERS)
// ========================================
exports.getAllRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const { status, search, reason, dateFilter } = req.query;

    let dbQuery = {};

    // Status filter
    if (status && status !== "All") {
      dbQuery.status = status;
    }

    // Reason filter
    if (reason && reason !== "All" && reason !== "All Reasons") {
      dbQuery.reason = reason;
    }

    // Search filter across name, email, phone, and userId
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      dbQuery.$or = [
        { userName: regex },
        { userEmail: regex },
        { userPhone: regex },
      ];

      if (mongoose.Types.ObjectId.isValid(search.trim())) {
        dbQuery.$or.push({ user: new mongoose.Types.ObjectId(search.trim()) });
      }
    }

    // Date filter
    if (dateFilter && dateFilter !== "All" && dateFilter !== "All Dates") {
      const now = new Date();
      if (dateFilter === "today" || dateFilter === "Today") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dbQuery.createdAt = { $gte: start };
      } else if (dateFilter === "7days" || dateFilter === "Last 7 Days") {
        const start = new Date();
        start.setDate(start.getDate() - 7);
        dbQuery.createdAt = { $gte: start };
      } else if (dateFilter === "30days" || dateFilter === "Last 30 Days") {
        const start = new Date();
        start.setDate(start.getDate() - 30);
        dbQuery.createdAt = { $gte: start };
      }
    }

    // Concurrent execution of counts and data fetch
    const [
      requests,
      totalFiltered,
      totalCount,
      pendingCount,
      approvedCount,
      rejectedCount,
    ] = await Promise.all([
      DeleteAccountRequest.find(dbQuery)
        .populate("user", "name email phone status avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DeleteAccountRequest.countDocuments(dbQuery),
      DeleteAccountRequest.countDocuments({}),
      DeleteAccountRequest.countDocuments({ status: "Pending" }),
      DeleteAccountRequest.countDocuments({ status: "Approved" }),
      DeleteAccountRequest.countDocuments({ status: "Rejected" }),
    ]);

    return res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / limit) || 1,
      },
      stats: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    console.error("Get Delete Account Requests Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching delete account requests",
      error: error.message,
    });
  }
};

// ========================================
// APPROVE REQUEST & CASCADE ERASE USER DATA
// ========================================
exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await DeleteAccountRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Delete account request not found",
      });
    }

    if (request.status === "Approved") {
      return res.status(400).json({
        success: false,
        message: "This request has already been approved and processed.",
      });
    }

    const userId = request.user;

    // Check if user exists in User collection
    const user = await User.findById(userId);

    if (user) {
      // 1. Delete main user document
      await User.findByIdAndDelete(userId);

      // 2. Cascade delete all related platform data across 12 collections
      await Promise.all([
        Subscription.deleteMany({ user: userId }),
        Watchlist.deleteMany({ user: userId }),
        Rating.deleteMany({ user: userId }),
        Interaction.deleteMany({ user: userId }),
        Notification.deleteMany({ targetUser: userId }),
        WatchProgress.deleteMany({ user: userId }),
        AudioProgress.deleteMany({ user: userId }),
        Comment.deleteMany({ user: userId }),
        AIReelWatch.deleteMany({ user: userId }),
        AIReelUserState.deleteMany({ user: userId }),
        AIReelFeedSession.deleteMany({ user: userId }),
      ]);

      // Support messages & tickets
      const supportTickets = await SupportTicket.find({ user: userId }).select("_id").lean();
      const ticketIds = supportTickets.map((t) => t._id);
      if (ticketIds.length > 0) {
        await SupportMessage.deleteMany({ ticket: { $in: ticketIds } });
      }
      await SupportTicket.deleteMany({ user: userId });

      // Clean readBy/deletedBy from global notifications
      await Notification.updateMany(
        {},
        {
          $pull: {
            readBy: { user: userId },
            deletedBy: { user: userId },
          },
        }
      );

      // Phone OTP clean
      if (user.phone) {
        await OTP.deleteMany({ phone: user.phone });
      }

      // Unlink vouchers
      await Voucher.updateMany(
        { usedBy: userId },
        { $set: { usedBy: null, isUsed: false } }
      );
    }

    // Mark request as Approved
    request.status = "Approved";
    request.processedAt = new Date();
    request.processedBy = req.admin?._id || null;
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Request approved and user data permanently erased successfully.",
      data: request,
    });
  } catch (error) {
    console.error("Approve Delete Request Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during account approval & data erasure",
      error: error.message,
    });
  }
};

// ========================================
// REJECT REQUEST
// ========================================
exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminRemark } = req.body;

    const request = await DeleteAccountRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Delete account request not found",
      });
    }

    request.status = "Rejected";
    request.adminRemark = adminRemark || "Request declined by administrator.";
    request.processedAt = new Date();
    request.processedBy = req.admin?._id || null;
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Delete account request rejected.",
      data: request,
    });
  } catch (error) {
    console.error("Reject Delete Request Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while rejecting delete request",
      error: error.message,
    });
  }
};

// ========================================
// DELETE REQUEST LOG
// ========================================
exports.deleteRequestLog = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await DeleteAccountRequest.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Request record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Request log deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Request Log Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting request log",
      error: error.message,
    });
  }
};
