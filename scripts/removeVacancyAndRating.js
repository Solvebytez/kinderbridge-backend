/* eslint-disable no-console */
const dotenv = require("dotenv");
const path = require("path");
const Daycare = require("../src/schemas/DaycareSchema");
const { connectToMongoDB } = require("../src/config/database");

// Load backend env
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

async function main() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await connectToMongoDB();
    console.log("✅ Connected to MongoDB\n");
    
    console.log("🗑️  Removing vacancy and qualityRating fields from age groups...\n");
    
    // Remove vacancy and qualityRating from all age groups
    const result = await Daycare.updateMany(
      {},
      {
        $unset: {
          "ageGroups.infant.vacancy": "",
          "ageGroups.infant.qualityRating": "",
          "ageGroups.toddler.vacancy": "",
          "ageGroups.toddler.qualityRating": "",
          "ageGroups.preschool.vacancy": "",
          "ageGroups.preschool.qualityRating": "",
          "ageGroups.kindergarten.vacancy": "",
          "ageGroups.kindergarten.qualityRating": "",
          "ageGroups.schoolAge.vacancy": "",
          "ageGroups.schoolAge.qualityRating": "",
        }
      }
    );
    
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("✅ REMOVAL COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`   Matched: ${result.matchedCount} daycares`);
    console.log(`   Modified: ${result.modifiedCount} daycares`);
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    console.log("✅ Removed vacancy and qualityRating fields from all age groups");
    console.log("   Only capacity field remains in each age group object\n");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();

