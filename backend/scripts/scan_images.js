/**
 * Scan database for non-webp images (PNG, JPG, JPEG)
 * Run: node backend/scripts/scan_images.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI?.trim();
if (!MONGO_URI) {
  console.error("❌ MONGO_URI missing in backend/.env");
  process.exit(1);
}

const isNonWebp = (url) => {
  if (!url || typeof url !== "string") return false;
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".png") || clean.endsWith(".jpg") || clean.endsWith(".jpeg");
};

async function scan() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const results = [];

  // 1. Movies
  const movies = await mongoose.connection.collection("movies").find({}).toArray();
  for (const m of movies) {
    if (isNonWebp(m.poster)) {
      results.push({ collection: "movies", id: m._id, title: m.title, field: "poster", url: m.poster });
    }
    if (isNonWebp(m.banner)) {
      results.push({ collection: "movies", id: m._id, title: m.title, field: "banner", url: m.banner });
    }
  }

  // 2. Series
  const series = await mongoose.connection.collection("series").find({}).toArray();
  for (const s of series) {
    if (isNonWebp(s.poster)) {
      results.push({ collection: "series", id: s._id, title: s.title, field: "poster", url: s.poster });
    }
    if (isNonWebp(s.banner)) {
      results.push({ collection: "series", id: s._id, title: s.title, field: "banner", url: s.banner });
    }
  }

  // 3. Microdramas
  const microdramas = await mongoose.connection.collection("microdramas").find({}).toArray();
  for (const md of microdramas) {
    if (isNonWebp(md.poster)) {
      results.push({ collection: "microdramas", id: md._id, title: md.title, field: "poster", url: md.poster });
    }
    if (isNonWebp(md.banner)) {
      results.push({ collection: "microdramas", id: md._id, title: md.title, field: "banner", url: md.banner });
    }
  }

  // 4. Intro Screens
  const introScreens = await mongoose.connection.collection("introscreens").find({}).toArray();
  for (const intro of introScreens) {
    if (isNonWebp(intro.image)) {
      results.push({ collection: "introscreens", id: intro._id, title: intro.title, field: "image", url: intro.image });
    }
  }

  // 5. Audio Stories
  const audioStories = await mongoose.connection.collection("audiostories").find({}).toArray();
  for (const as of audioStories) {
    if (isNonWebp(as.poster)) {
      results.push({ collection: "audiostories", id: as._id, title: as.title, field: "poster", url: as.poster });
    }
    if (isNonWebp(as.banner)) {
      results.push({ collection: "audiostories", id: as._id, title: as.title, field: "banner", url: as.banner });
    }
  }

  console.log(`\n📊 Scan Results: Found ${results.length} non-WebP image(s):\n`);
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.collection}] "${r.title || r.id}" (${r.field}):`);
    console.log(`   URL: ${r.url}`);
  });

  await mongoose.disconnect();
  return results;
}

scan().catch((err) => {
  console.error("❌ Scan failed:", err);
  process.exit(1);
});
