/**
 * Script to check contact logs in the database
 * Run with: node src/scripts/checkContactLogs.js
 */

require("dotenv").config({
  path: require("path").join(__dirname, "../../../.env"),
});
const mongoose = require("mongoose");
const ContactLog = require("../schemas/ContactLogSchema");

async function checkContactLogs() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI?.replace(/[<>]/g, "");
    const dbName = process.env.DB_NAME || "daycare_concierge";

    if (!MONGODB_URI) {
      console.error("❌ MONGODB_URI not found in environment variables");
      process.exit(1);
    }

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI, {
      dbName: dbName,
      serverApi: {
        version: "1",
        strict: true,
        deprecationErrors: true,
      },
    });

    console.log("✅ Connected to MongoDB");
    console.log(`🗄️ Database: ${mongoose.connection.db.databaseName}\n`);

    // Get all contact logs
    const allContactLogs = await ContactLog.find({})
      .lean()
      .sort({ createdAt: -1 });

    console.log(`📊 Total Contact Logs: ${allContactLogs.length}\n`);

    if (allContactLogs.length === 0) {
      console.log("⚠️ No contact logs found in the database.");
    } else {
      console.log("📋 Contact Logs:\n");
      allContactLogs.forEach((log, index) => {
        console.log(`--- Contact Log ${index + 1} ---`);
        console.log(`ID: ${log._id}`);
        console.log(`User ID: ${log.userId}`);
        console.log(`Daycare ID: ${log.daycareId}`);
        console.log(`Contact Method: ${log.contactMethod}`);
        console.log(`Purpose: ${log.purpose}`);
        console.log(
          `Notes: ${log.notes.substring(0, 50)}${
            log.notes.length > 50 ? "..." : ""
          }`
        );
        console.log(`Outcome: ${log.outcome || "N/A"}`);
        console.log(`Follow-up Date: ${log.followUpDate || "N/A"}`);
        console.log(`Created At: ${log.createdAt}`);
        console.log(`Updated At: ${log.updatedAt}`);
        console.log("");
      });
    }

    // Get contact logs grouped by user
    const logsByUser = await ContactLog.aggregate([
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    if (logsByUser.length > 0) {
      console.log("👥 Contact Logs by User:\n");
      logsByUser.forEach((group) => {
        console.log(`User ID: ${group._id} - ${group.count} contact log(s)`);
      });
    }

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkContactLogs();


























