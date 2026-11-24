const DeleteAccountRequest = require("../../models/deleteAccountRequest.model");
const User = require("../../models/user.model");

// ========================================
// SUBMIT DELETE ACCOUNT REQUEST (MOBILE / WEB USER)
// ========================================
exports.submitRequest = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User identification missing",
      });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    // Check if user already has an active pending request
    const existingPending = await DeleteAccountRequest.findOne({
      user: userId,
      status: "Pending",
    }).lean();

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending account deletion request under review.",
        data: existingPending,
      });
    }

    const { reason, comments } = req.body;

    const newRequest = await DeleteAccountRequest.create({
      user: userId,
      userName: user.name || "User",
      userEmail: user.email || "",
      userPhone: user.phone || "",
      reason: reason || "Other",
      comments: comments || "",
      status: "Pending",
    });

    return res.status(201).json({
      success: true,
      message: "Your account deletion request has been submitted successfully. Our team will process it shortly.",
      data: newRequest,
    });
  } catch (error) {
    console.error("Submit Delete Account Request Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while submitting delete account request",
      error: error.message,
    });
  }
};

// ========================================
// GET CURRENT USER'S DELETION REQUEST STATUS
// ========================================
exports.getMyRequestStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    const latestRequest = await DeleteAccountRequest.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: latestRequest || null,
    });
  } catch (error) {
    console.error("Get My Deletion Request Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while checking request status",
    });
  }
};
