/* eslint-disable no-console */
const dotenv = require("dotenv");
const path = require("path");
const Daycare = require("../src/schemas/DaycareSchema");
const { connectToMongoDB } = require("../src/config/database");

// Load backend env
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

async function main() {
  await connectToMongoDB();

  // Get sample daycares with different price ranges
  const samples = await Daycare.find({})
    .select("name address price priceString")
    .limit(30)
    .lean();

  console.log("📋 Sample daycares from database:\n");
  
  const priceGroups = new Map();
  
  samples.forEach((d, i) => {
    const key = d.priceString || "NO";
    const count = priceGroups.get(key) || 0;
    priceGroups.set(key, count + 1);
    
    if (i < 15) {
      console.log(`${i + 1}. ${d.name}`);
      console.log(`   Address: ${d.address}`);
      console.log(`   price: ${d.price} (${typeof d.price})`);
      console.log(`   priceString: "${d.priceString}"`);
      console.log();
    }
  });

  console.log("\n📊 Price distribution in sample:");
  Array.from(priceGroups.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([priceString, count]) => {
      console.log(`   "${priceString}": ${count} daycares`);
    });

  // Check for daycares with "1400$ - 1800$" range
  const highPriceDaycares = await Daycare.find({ 
    priceString: { $regex: /1400.*1800|1800.*1400/i } 
  })
    .select("name priceString")
    .limit(10)
    .lean();

  console.log(`\n💰 Daycares with "1400$ - 1800$" range (showing first 10):`);
  highPriceDaycares.forEach((d, i) => {
    console.log(`   ${i + 1}. ${d.name}: "${d.priceString}"`);
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});


























