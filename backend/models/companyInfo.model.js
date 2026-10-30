const mongoose = require("mongoose");

const companyInfoSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      trim: true,
      default: "Masti Adda OTT",
    },
    tagline: {
      type: String,
      trim: true,
      default: "The ultimate destination for premium entertainment. Watch the latest web series, movies, and originals anytime, anywhere.",
    },
    supportEmail: {
      type: String,
      trim: true,
      default: "support@mastiadda.in",
    },
    supportPhone: {
      type: String,
      trim: true,
      default: "",
    },

    // Physical Address
    address: {
      type: String,
      trim: true,
      default: "16-A/802, Near Mother Dairy Vasundhara",
    },
    addressLine1: {
      type: String,
      trim: true,
      default: "16-A/802, Near Mother Dairy Vasundhara",
    },
    addressLine2: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "Ghaziabad",
    },
    state: {
      type: String,
      trim: true,
      default: "Uttar Pradesh",
    },
    country: {
      type: String,
      trim: true,
      default: "India",
    },
    postalCode: {
      type: String,
      trim: true,
      default: "201012",
    },

    // Geo-Location & Maps
    latitude: {
      type: Number,
      default:19.186,
    },
    longitude: {
      type: Number,
      default:72.855,
    },
    googleMapUrl: {
      type: String,
      trim: true,
      default: "https://maps.google.com/?q=16-A%2F802+Near+Mother+Dairy+Vasundhara+Ghaziabad+Uttar+Pradesh+201012",
    },

    // Branding & Legal
    copyrightText: {
      type: String,
      trim: true,
      default: "© 2026 Masti Adda OTT All Rights Reserved",
    },
    poweredBy: {
      type: String,
      trim: true,
      default: "POWERED BY Prism Media Networks Private Limited",
    },

    // Social Links
    socialLinks: {
      facebook: { type: String, trim: true, default: "" },
      instagram: { type: String, trim: true, default: "" },
      twitter: { type: String, trim: true, default: "" },
      youtube: { type: String, trim: true, default: "" },
      linkedin: { type: String, trim: true, default: "" },
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual property for concatenated formatted address
companyInfoSchema.virtual("formattedAddress").get(function () {
  const streetAddr = this.address || [this.addressLine1, this.addressLine2].filter(Boolean).join(", ");
  const parts = [
    streetAddr,
    this.city,
    this.state,
    this.country && this.postalCode ? `${this.country} - ${this.postalCode}` : (this.country || this.postalCode),
  ].filter(Boolean);
  return parts.join(", ");
});

module.exports = mongoose.model(
  "CompanyInfo",
  companyInfoSchema
);