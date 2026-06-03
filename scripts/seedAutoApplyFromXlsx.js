/* eslint-disable no-console */
/**
 * Import Excel rows directly into MongoDB collection `auto_apply` (no matching).
 *
 * Usage (from backend folder):
 *   node scripts/seedAutoApplyFromXlsx.js "path/to/file.xlsx"
 *   node scripts/seedAutoApplyFromXlsx.js "path/to/file.xlsx" --drop
 *   node scripts/seedAutoApplyFromXlsx.js "path/to/file.xlsx" --dry-run
 */
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const dotenv = require("dotenv");
const AutoApplyRegistry = require("../src/schemas/AutoApplyRegistrySchema");
const { connectToMongoDB } = require("../src/config/database");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

function toStringSafe(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function rowToDoc(row, excelRow, sourceFile) {
  return {
    excelRow,
    sourceFile,
    name: toStringSafe(row["Daycare Name"]),
    region: toStringSafe(row.Region),
    city: toStringSafe(row.City),
    address: toStringSafe(row.Address),
    cwelcc: toStringSafe(row.CWELCC),
    subsidyAvailable: toStringSafe(row["Subsidy Available?"]),
    monthlyFee: toStringSafe(row["Monthly Fee"]),
    registrationFee: toStringSafe(row["One time Registration Fee"]),
    daycareType: toStringSafe(row["Daycare Type"]),
    hoursOfOperation: toStringSafe(row["Hours of Operation"]),
    programAge: toStringSafe(row["Program Age"]),
    infants: toStringSafe(row["Infants (birth-18 months)"]),
    toddlers: toStringSafe(row["Toddlers (18-30 months)"]),
    preschoolers: toStringSafe(row["Preschoolers (30 months-4/5 years)"]),
    schoolAge: toStringSafe(row["School-Age (around 5-12 years)"]),
    googleReviews: toStringSafe(row["Google Reviews"]),
    googleReviewCount: toStringSafe(row["Number of Google Reviews"]),
    googleReviewSummary: toStringSafe(row["Google Review Summary"]),
    website: toStringSafe(row.Website),
    email: toStringSafe(row.Email),
    phone: toStringSafe(row["Phone Number"]),
    registrationInfo: toStringSafe(row["Registration Info"]),
    formsLinkPrevious: toStringSafe(row["Forms Link Previous"]),
    contactUsPage: toStringSafe(row["Contact Us Page"]),
    latitude: toStringSafe(row.Latitude),
    longitude: toStringSafe(row.Longitude),
    slug: toStringSafe(row.slug),
    formLinkExtracted: toStringSafe(row["Form Link Extracted"]),
    ifByEmail: toStringSafe(row["If by email"]),
    ifByPhone: toStringSafe(row["If by phone"]),
    status: toStringSafe(row.Status),
    dataRequested: toStringSafe(row["Data Requested"]),
    endpoint: toStringSafe(row.endpoint),
    remark: toStringSafe(row.Remark),
    getEndpoint: toStringSafe(row.get_endpoint),
    postEndpoint: toStringSafe(row.post_endpoint),
    integrated: toStringSafe(row["Intregrated "] || row.Intregrated),
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const filePath =
    args.find((a) => !a.startsWith("--")) ||
    path.resolve(
      process.env.USERPROFILE || "",
      "Downloads",
      "Toronto_processed_final (1) (1).xlsx"
    );
  return {
    filePath,
    drop: args.includes("--drop"),
    dryRun: args.includes("--dry-run"),
  };
}

async function main() {
  const { filePath, drop, dryRun } = parseArgs();

  if (!fs.existsSync(filePath)) {
    console.error(`Excel file not found: ${filePath}`);
    process.exit(1);
  }

  const sourceFile = path.basename(filePath);
  console.log(`Reading Excel: ${filePath}`);

  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
  });

  console.log(`Sheet: ${sheetName}`);
  console.log(`Rows to import: ${rows.length}`);
  if (dryRun) console.log("DRY RUN — no writes\n");

  const docs = rows.map((row, i) => rowToDoc(row, i + 2, sourceFile));

  if (dryRun) {
    console.log("Sample document:");
    console.log(JSON.stringify(docs[0], null, 2));
    process.exit(0);
  }

  await connectToMongoDB();

  if (drop) {
    try {
      await AutoApplyRegistry.collection.drop();
      console.log("Dropped auto_apply collection (fresh import)");
    } catch (err) {
      if (err.code !== 26) throw err;
      console.log("auto_apply collection did not exist yet");
    }
  }

  const inserted = await AutoApplyRegistry.insertMany(docs, { ordered: true });
  const total = await AutoApplyRegistry.countDocuments({});

  const { invalidateAutoApplyDaycareCache } = require("../src/utils/autoApplyDaycareFilter");
  invalidateAutoApplyDaycareCache();

  console.log(`\nauto_apply collection:`);
  console.log(`  inserted: ${inserted.length}`);
  console.log(`  total documents: ${total}`);
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("seedAutoApplyFromXlsx failed:", err);
  process.exit(1);
});
