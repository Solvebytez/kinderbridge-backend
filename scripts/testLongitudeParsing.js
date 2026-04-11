/* eslint-disable no-console */
const path = require("path");
const xlsx = require("xlsx");

// Copy the toNumberSafe function from seedDaycaresFromXlsx.js
function toNumberSafe(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  
  // Check if it's a negative number (starts with minus sign)
  const isNegative = s.startsWith("-");
  
  // If it's a range like "475-500" or "475$ - 500$" (but not a negative number)
  // A negative number like "-79.84" should NOT be treated as a range
  if (s.includes("-") && !isNegative) {
    const parts = s.split("-");
    if (parts.length >= 2) {
      const firstPart = parts[0].replace(/[^0-9.]/g, "");
      const n = parseFloat(firstPart);
      return Number.isFinite(n) ? n : 0;
    }
  }
  
  // For negative numbers or single values, preserve the minus sign
  // Replace everything except digits, decimal point, and leading minus sign
  const cleaned = s.replace(/[^0-9.\-]/g, "").replace(/(?!^)-/g, ""); // Keep only first minus sign
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const filePath = path.resolve(__dirname, "..", "daycare data.xlsx");
console.log(`📄 Reading Excel: ${filePath}`);

const workbook = xlsx.readFile(filePath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const rows = xlsx.utils.sheet_to_json(sheet, {
  defval: "",
  raw: false, // This is the same setting used in seedDaycaresFromXlsx.js
});

console.log(`\n🔍 Testing Longitude Parsing (first 5 rows):\n`);

for (let i = 0; i < Math.min(5, rows.length); i++) {
  const row = rows[i];
  const rawLongitude = row["Longitude"];
  const parsedLongitude = toNumberSafe(rawLongitude);
  
  console.log(`Row ${i + 1}:`);
  console.log(`   Raw value: "${rawLongitude}" (type: ${typeof rawLongitude})`);
  console.log(`   Parsed value: ${parsedLongitude}`);
  console.log(`   Is number: ${typeof rawLongitude === "number"}`);
  console.log(`   String representation: "${String(rawLongitude)}"`);
  console.log();
}























