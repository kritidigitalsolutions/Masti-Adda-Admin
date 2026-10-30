const mongoose = require("mongoose");
const { Schema } = mongoose;

// ── Item sub-schema (used in both heroBanners and sections.items) ──────────
const itemSchema = new Schema(
  {
    contentType: {
      type: String,
      enum: ["Movie", "Series", "Microdrama"],
      required: true,
    },
    // Dynamic ref: populates from Movie, Series, or Microdrama depending on contentType
    contentId: {
      type: Schema.Types.ObjectId,
      refPath: "heroBanners.contentType", // overridden per array via manual populate
      required: true,
    },
  },
  { _id: false }
);

// ── Section item sub-schema ────────────────────────────────────────────────
const sectionItemSchema = new Schema(
  {
    contentType: {
      type: String,
      enum: ["Movie", "Series", "Microdrama"],
      required: true,
    },
    contentId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: false }
);

// ── Section (carousel row) sub-schema ──────────────────────────────────────
const sectionSchema = new Schema(
  {
    categorySlug: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    items: [sectionItemSchema],
  },
  { _id: true }
);

// ── Main singleton schema ───────────────────────────────────────────────────
const webpageLayoutSchema = new Schema(
  {
    // Hero slider banners — order = array index
    heroBanners: [
      {
        contentType: {
          type: String,
          enum: ["Movie", "Series", "Microdrama"],
          required: true,
        },
        contentId: {
          type: Schema.Types.ObjectId,
          required: true,
        },
        _id: false,
      },
    ],

    // Carousel rows — order = array index
    sections: [sectionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("WebpageLayout", webpageLayoutSchema);

