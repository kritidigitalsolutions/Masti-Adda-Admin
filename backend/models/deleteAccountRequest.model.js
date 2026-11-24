const mongoose = require("mongoose");

const deleteAccountRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userName: {
      type: String,
      trim: true,
      default: "",
    },
    userEmail: {
      type: String,
      trim: true,
      default: "",
    },
    userPhone: {
      type: String,
      trim: true,
      default: "",
    },
    reason: {
      type: String,
      trim: true,
      default: "Other",
      enum: [
        "Privacy Concerns",
        "Security Concerns",
        "Too Many Ads",
        "Found an Alternative",
        "Not Using App",
        "Technical Issues",
        "Other",
      ],
    },
    comments: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    adminRemark: {
      type: String,
      trim: true,
      default: "",
    },
    processedAt: {
      type: Date,
      default: null,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

deleteAccountRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model(
  "DeleteAccountRequest",
  deleteAccountRequestSchema
);
