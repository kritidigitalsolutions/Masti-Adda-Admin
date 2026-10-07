const mongoose = require("mongoose");

let connectionPromise = null;

mongoose.set("strictQuery", true);

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return;
    }

    if (connectionPromise) {
      return await connectionPromise;
    }

    const uri = process.env.MONGO_URI?.trim();

    if (!uri) {
      throw new Error("MONGO_URI is missing in .env");
    }

    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 100,
    });

    await connectionPromise;
    console.log("✅ MongoDB Connected");
  } catch (error) {
    connectionPromise = null;
    console.error("❌ MongoDB Connection Error:", error.message);
    if (process.env.VERCEL) {
      throw error;
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;