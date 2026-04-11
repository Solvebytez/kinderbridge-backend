/* eslint-disable no-console */
const path = require("path");
const dotenv = require("dotenv");
const { connectToMongoDB, disconnectFromMongoDB } = require("../src/config/database");

// Load backend env (supports local checking without exporting env vars manually)
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

async function checkDaycareMaster() {
  try {
    console.log("🔍 Checking for daycare_master collection in MongoDB...\n");

    // Connect to MongoDB
    const connection = await connectToMongoDB();
    const db = connection.db;

    // Get all collections in the database
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((col) => col.name);

    console.log(`📋 Total collections found: ${collectionNames.length}\n`);
    console.log("📦 All collections in database:");
    collectionNames.forEach((name, index) => {
      console.log(`   ${index + 1}. ${name}`);
    });

    console.log("\n" + "=".repeat(60) + "\n");

    // Check for daycare_master specifically
    const daycareMasterExists = collectionNames.includes("daycare_master");
    
    if (daycareMasterExists) {
      console.log("✅ FOUND: 'daycare_master' collection exists!");
      
      // Get document count
      const daycareMasterCollection = db.collection("daycare_master");
      const count = await daycareMasterCollection.countDocuments();
      console.log(`   📊 Document count: ${count}`);

      // Get a sample document structure
      if (count > 0) {
        const sample = await daycareMasterCollection.findOne({});
        console.log("\n   📄 Sample document structure:");
        console.log("   " + JSON.stringify(sample, null, 2).split("\n").join("\n   "));
      }
    } else {
      console.log("❌ NOT FOUND: 'daycare_master' collection does NOT exist.");
    }

    console.log("\n" + "=".repeat(60) + "\n");

    // Check for any collections with "master" in the name
    const masterCollections = collectionNames.filter((name) =>
      name.toLowerCase().includes("master")
    );

    if (masterCollections.length > 0) {
      console.log(`🔍 Collections containing "master" in name (${masterCollections.length}):`);
      masterCollections.forEach((name) => {
        console.log(`   - ${name}`);
      });
    } else {
      console.log("ℹ️  No collections found with 'master' in the name.");
    }

    console.log("\n" + "=".repeat(60) + "\n");

    // Check for daycare-related collections
    const daycareCollections = collectionNames.filter((name) =>
      name.toLowerCase().includes("daycare")
    );

    if (daycareCollections.length > 0) {
      console.log(`🏢 Daycare-related collections (${daycareCollections.length}):`);
      daycareCollections.forEach((name) => {
        console.log(`   - ${name}`);
      });
    }

    console.log("\n✅ Check completed!\n");
  } catch (error) {
    console.error("❌ Error checking for daycare_master:", error);
    throw error;
  } finally {
    // Disconnect from MongoDB
    await disconnectFromMongoDB();
  }
}

// Run the check
checkDaycareMaster()
  .then(() => {
    console.log("✨ Script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });

