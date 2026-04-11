/* eslint-disable no-console */
const https = require("https");
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const dotenv = require("dotenv");
const Daycare = require("../src/schemas/DaycareSchema");
const { connectToMongoDB } = require("../src/config/database");

// Load backend env
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

// Google Sheets URL
const SPREADSHEET_ID = "1ys73ItO4pAnt87MxCKMckcDudwAn_dbAWCuzKQ81xZ8";
const SHEET_GID = "171390432";
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx&gid=${SHEET_GID}`;

const TEMP_FILE = path.resolve(__dirname, "..", "temp_age_groups.xlsx");

function toStringSafe(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function isYes(value) {
  const s = toStringSafe(value).toUpperCase();
  return s === "YES" || s === "Y" || s === "TRUE" || s === "1";
}

function downloadFile(url, outputPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects === 0) {
      reject(new Error("Too many redirects"));
      return;
    }

    const file = fs.createWriteStream(outputPath);
    
    https.get(url, { followRedirect: false }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        console.log(`   Following redirect (${response.statusCode})...`);
        downloadFile(response.headers.location, outputPath, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      } else if (response.statusCode === 200) {
        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0) {
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            process.stdout.write(`\r   Downloading: ${percent}%`);
          }
        });
        
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log("\n✅ Download completed!");
          resolve();
        });
      } else {
        file.close();
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }
    }).on("error", (err) => {
      file.close();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(err);
    });
  });
}

async function main() {
  try {
    console.log("📥 Downloading Google Sheet...");
    console.log(`   URL: ${EXPORT_URL}\n`);
    
    await downloadFile(EXPORT_URL, TEMP_FILE);
    
    console.log(`\n📄 Reading Excel file...`);
    const workbook = xlsx.readFile(TEMP_FILE, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const rows = xlsx.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });
    
    console.log(`📄 Sheet: ${sheetName}`);
    console.log(`📦 Total rows: ${rows.length}\n`);
    
    // Connect to database
    console.log("🔌 Connecting to MongoDB...");
    await connectToMongoDB();
    console.log("✅ Connected to MongoDB\n");
    
    let updated = 0;
    let notFound = 0;
    let skipped = 0;
    
    console.log("🔄 Processing age group updates...\n");
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const daycareName = toStringSafe(row["Daycare Name"]);
      const address = toStringSafe(row["Address"]);
      
      // Log progress every 100 records
      if ((i + 1) % 100 === 0) {
        console.log(
          `📊 Progress: ${i + 1}/${rows.length} | updated=${updated} notFound=${notFound} skipped=${skipped}`
        );
      }
      
      // Skip if missing name or address
      if (!daycareName || !address) {
        skipped += 1;
        continue;
      }
      
      // Get YES/NO values for each age group
      const infantYesNo = toStringSafe(row["Infants (birth-18 months)"]);
      const toddlerYesNo = toStringSafe(row["Toddlers (18-30 months)"]);
      const preschoolYesNo = toStringSafe(row["Preschoolers (30 months-4/5 years)"]);
      const schoolAgeYesNo = toStringSafe(row["School-Age (around 5-12 years)"]);
      
      // Find the daycare by name and address
      const daycare = await Daycare.findOne({
        name: { $regex: new RegExp(`^${daycareName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        address: { $regex: new RegExp(`^${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      
      if (!daycare) {
        notFound += 1;
        if ((i + 1) % 50 === 0) {
          console.log(`   ⚠️  Not found: ${daycareName} - ${address}`);
        }
        continue;
      }
      
      // Prepare age group updates - only update capacity field
      const ageGroupsUpdate = {};
      
      // Update infant capacity only
      if (infantYesNo) {
        ageGroupsUpdate["ageGroups.infant.capacity"] = isYes(infantYesNo) ? 1 : 0;
      }
      
      // Update toddler capacity only
      if (toddlerYesNo) {
        ageGroupsUpdate["ageGroups.toddler.capacity"] = isYes(toddlerYesNo) ? 1 : 0;
      }
      
      // Update preschool capacity only
      if (preschoolYesNo) {
        ageGroupsUpdate["ageGroups.preschool.capacity"] = isYes(preschoolYesNo) ? 1 : 0;
      }
      
      // Update schoolAge capacity only
      if (schoolAgeYesNo) {
        ageGroupsUpdate["ageGroups.schoolAge.capacity"] = isYes(schoolAgeYesNo) ? 1 : 0;
      }
      
      // Only update if we have at least one age group value
      if (Object.keys(ageGroupsUpdate).length > 0) {
        await Daycare.updateOne(
          { _id: daycare._id },
          { $set: ageGroupsUpdate }
        );
        updated += 1;
      } else {
        skipped += 1;
      }
    }
    
    // Clean up temp file
    if (fs.existsSync(TEMP_FILE)) {
      fs.unlinkSync(TEMP_FILE);
      console.log("\n🧹 Cleaned up temporary file");
    }
    
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("✅ UPDATE COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`   Updated: ${updated} daycares`);
    console.log(`   Not Found: ${notFound} daycares`);
    console.log(`   Skipped: ${skipped} daycares`);
    console.log(`   Total Processed: ${rows.length} rows`);
    console.log("═══════════════════════════════════════════════════════════════\n");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    
    // Clean up temp file on error
    if (fs.existsSync(TEMP_FILE)) {
      fs.unlinkSync(TEMP_FILE);
    }
    
    process.exit(1);
  }
}

main();

