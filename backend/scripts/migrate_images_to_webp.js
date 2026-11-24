/**
 * Migration Script: Convert all existing PNG/JPG posters, banners, and intro screens to WebP
 * 
 * Features:
 * 1. Fetches images from BunnyCDN
 * 2. Compresses & converts to WebP (quality: 85) via sharp
 * 3. Uploads new .webp file to Bunny Storage
 * 4. Saves full rollback backup JSON
 * 5. Updates MongoDB document URLs
 * 
 * Run with: node backend/scripts/migrate_images_to_webp.js
 */

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const axios = require("axios");
const sharp = require("sharp");
const { uploadBufferToBunny, buildPublicUrl } = require("../cdn/bunnyCDN");

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

const getWebpRemotePath = (originalUrl) => {
  // originalUrl: https://golidoliott.b-cdn.net/series/posters/1789991125796-901990715.png
  try {
    const parsed = new URL(originalUrl);
    let pathname = parsed.pathname.replace(/^\/+/, ""); // series/posters/1789991125796-901990715.png
    pathname = pathname.replace(/\.(png|jpe?g)$/i, ".webp");
    return pathname;
  } catch {
    const clean = originalUrl.split("?")[0];
    const parts = clean.split("/");
    const filename = parts.pop().replace(/\.(png|jpe?g)$/i, ".webp");
    return filename;
  }
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

async function runMigration() {
  console.log("🚀 Starting Image Migration to WebP...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  const tasks = [];

  // 1. Movies
  const movies = await mongoose.connection.collection("movies").find({}).toArray();
  for (const m of movies) {
    if (isNonWebp(m.poster)) tasks.push({ col: "movies", id: m._id, title: m.title, field: "poster", url: m.poster });
    if (isNonWebp(m.banner)) tasks.push({ col: "movies", id: m._id, title: m.title, field: "banner", url: m.banner });
  }

  // 2. Series
  const series = await mongoose.connection.collection("series").find({}).toArray();
  for (const s of series) {
    if (isNonWebp(s.poster)) tasks.push({ col: "series", id: s._id, title: s.title, field: "poster", url: s.poster });
    if (isNonWebp(s.banner)) tasks.push({ col: "series", id: s._id, title: s.title, field: "banner", url: s.banner });
  }

  // 3. Microdramas
  const microdramas = await mongoose.connection.collection("microdramas").find({}).toArray();
  for (const md of microdramas) {
    if (isNonWebp(md.poster)) tasks.push({ col: "microdramas", id: md._id, title: md.title, field: "poster", url: md.poster });
    if (isNonWebp(md.banner)) tasks.push({ col: "microdramas", id: md._id, title: md.title, field: "banner", url: md.banner });
  }

  // 4. Intro Screens
  const introScreens = await mongoose.connection.collection("introscreens").find({}).toArray();
  for (const intro of introScreens) {
    if (isNonWebp(intro.image)) tasks.push({ col: "introscreens", id: intro._id, title: intro.title, field: "image", url: intro.image });
  }

  console.log(`📋 Total images to migrate: ${tasks.length}\n`);
  if (tasks.length === 0) {
    console.log("✨ No non-WebP images found! Everything is already optimized.");
    await mongoose.disconnect();
    return;
  }

  const backupLog = [];
  let totalOrigBytes = 0;
  let totalNewBytes = 0;
  let successCount = 0;

  for (let i = 0; i < tasks.length; i++) {
    const item = tasks[i];
    const prefix = `[${i + 1}/${tasks.length}]`;
    console.log(`${prefix} Processing: ${item.col} -> "${item.title || item.id}" (${item.field})`);

    try {
      // 1. Download original image
      const downloadRes = await axios.get(item.url, { responseType: "arraybuffer", timeout: 20000 });
      const origBuffer = Buffer.from(downloadRes.data);
      const origSize = origBuffer.length;
      totalOrigBytes += origSize;

      // 2. Convert to WebP via Sharp
      const webpBuffer = await sharp(origBuffer)
        .webp({ quality: 85, effort: 4 })
        .toBuffer();
      const newSize = webpBuffer.length;
      totalNewBytes += newSize;
      const reduction = (((origSize - newSize) / origSize) * 100).toFixed(1);

      // 3. Upload to BunnyCDN
      const remotePath = getWebpRemotePath(item.url);
      const uploadRes = await uploadBufferToBunny({
        buffer: webpBuffer,
        remotePath,
        contentType: "image/webp",
      });

      const newPublicUrl = uploadRes.url || buildPublicUrl(remotePath);

      // 4. Update MongoDB Document
      await mongoose.connection.collection(item.col).updateOne(
        { _id: item.id },
        { $set: { [item.field]: newPublicUrl } }
      );

      console.log(`   ✅ Converted: ${formatBytes(origSize)} ➔ ${formatBytes(newSize)} (-${reduction}%)`);
      console.log(`   🔗 New URL: ${newPublicUrl}\n`);

      backupLog.push({
        col: item.col,
        id: item.id,
        title: item.title,
        field: item.field,
        originalUrl: item.url,
        newUrl: newPublicUrl,
        origSize,
        newSize,
        convertedAt: new Date().toISOString(),
      });

      successCount++;
    } catch (err) {
      console.error(`   ❌ Failed for ${item.url}:`, err.message);
    }
  }

  // Save rollback backup file
  const backupPath = path.join(__dirname, `migration_backup_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backupLog, null, 2), "utf8");
  console.log(`💾 Saved rollback backup to: ${backupPath}\n`);

  const totalSaved = totalOrigBytes - totalNewBytes;
  const totalReduction = totalOrigBytes > 0 ? (((totalSaved) / totalOrigBytes) * 100).toFixed(1) : 0;

  console.log("==========================================");
  console.log(`🎉 MIGRATION COMPLETE: ${successCount}/${tasks.length} images updated successfully!`);
  console.log(`📦 Original Total Size: ${formatBytes(totalOrigBytes)}`);
  console.log(`⚡ New WebP Total Size: ${formatBytes(totalNewBytes)}`);
  console.log(`🔥 Total Bandwidth Saved: ${formatBytes(totalSaved)} (-${totalReduction}% reduction)`);
  console.log("==========================================\n");

  await mongoose.disconnect();
}

runMigration().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
