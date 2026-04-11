/* eslint-disable no-console */
const path = require("path");
const xlsx = require("xlsx");

function toStringSafe(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

const filePath = path.resolve(__dirname, "..", "daycare data.xlsx");
console.log(`📄 Reading Excel: ${filePath}`);
const workbook = xlsx.readFile(filePath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows = xlsx.utils.sheet_to_json(sheet, {
  defval: "",
  raw: false,
});

console.log(`📄 Sheet: ${sheetName}`);
console.log(`📦 Rows: ${rows.length}\n`);

// Check for different price ranges
const priceCounts = new Map();
const sampleDaycares = [];

for (let i = 0; i < Math.min(rows.length, 50); i++) {
  const row = rows[i];
  const name = toStringSafe(row["Daycare Name"]);
  const address = toStringSafe(row["Address"]);
  const monthlyFee = toStringSafe(row["Monthly Fee"]);
  
  if (name && address && monthlyFee) {
    const count = priceCounts.get(monthlyFee) || 0;
    priceCounts.set(monthlyFee, count + 1);
    
    if (sampleDaycares.length < 20) {
      sampleDaycares.push({ name, address, monthlyFee });
    }
  }
}

console.log("📊 Price distribution (first 20 unique prices):");
const sortedPrices = Array.from(priceCounts.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);

sortedPrices.forEach(([price, count]) => {
  console.log(`   "${price}": ${count} daycares`);
});

console.log("\n📋 Sample daycares with their Monthly Fee:");
sampleDaycares.forEach((d, i) => {
  console.log(`${i + 1}. ${d.name}`);
  console.log(`   Address: ${d.address}`);
  console.log(`   Monthly Fee: "${d.monthlyFee}"`);
  console.log();
});

console.log(`\n✅ Total unique price values: ${priceCounts.size}`);
console.log(`✅ Total daycares with prices: ${Array.from(priceCounts.values()).reduce((a, b) => a + b, 0)}`);

process.exit(0);


























