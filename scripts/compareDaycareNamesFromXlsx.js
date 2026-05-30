/* eslint-disable no-console */
/**
 * Read-only check: compare Excel daycare rows against MongoDB daycares_master.
 *
 * Usage:
 *   node scripts/compareDaycareNamesFromXlsx.js "path/to/file.xlsx"
 *   node scripts/compareDaycareNamesFromXlsx.js "path/to/file.xlsx" --match=name,city,region
 *   node scripts/compareDaycareNamesFromXlsx.js "path/to/file.xlsx" --show-unmatched
 *   node scripts/compareDaycareNamesFromXlsx.js "path/to/file.xlsx" --export report.csv
 */
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const dotenv = require("dotenv");
const Daycare = require("../src/schemas/DaycareSchema");
const { connectToMongoDB } = require("../src/config/database");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

const EXCEL_FIELD_MAP = {
  name: "Daycare Name",
  address: "Address",
  city: "City",
  region: "Region",
};

const DB_FIELDS = {
  name: "name",
  address: "address",
  city: "city",
  region: "region",
};

function toStringSafe(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function normalizePart(value) {
  return toStringSafe(value).toLowerCase();
}

function buildKey(record, fields) {
  return fields.map((field) => normalizePart(record[field])).join("|");
}

function escapeCsv(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToRecord(row) {
  return {
    name: toStringSafe(row[EXCEL_FIELD_MAP.name]),
    address: toStringSafe(row[EXCEL_FIELD_MAP.address]),
    city: toStringSafe(row[EXCEL_FIELD_MAP.city]),
    region: toStringSafe(row[EXCEL_FIELD_MAP.region]),
  };
}

function dbToRecord(daycare) {
  return {
    name: toStringSafe(daycare.name),
    address: toStringSafe(daycare.address),
    city: toStringSafe(daycare.city),
    region: toStringSafe(daycare.region),
  };
}

function parseMatchFields(args) {
  const matchArg = args.find((a) => a.startsWith("--match="));
  const raw = matchArg ? matchArg.split("=")[1] : "name,address";
  const fields = raw
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const allowed = Object.keys(EXCEL_FIELD_MAP);
  for (const field of fields) {
    if (!allowed.includes(field)) {
      throw new Error(
        `Unknown match field "${field}". Allowed: ${allowed.join(", ")}`
      );
    }
  }

  return fields.length > 0 ? fields : ["name", "address"];
}

async function main() {
  const args = process.argv.slice(2);
  const filePath =
    args.find((a) => !a.startsWith("--")) ||
    path.resolve(__dirname, "..", "daycare data.xlsx");
  const matchFields = parseMatchFields(args);
  const showUnmatched = args.includes("--show-unmatched");
  const exportArg = args.find((a) => a.startsWith("--export="));
  const exportPath = exportArg ? exportArg.split("=")[1] : null;

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Excel file not found: ${filePath}`);
    console.error(
      '   Pass the full path, e.g. node scripts/compareDaycareNamesFromXlsx.js "D:\\data\\daycare.xlsx"'
    );
    process.exit(1);
  }

  console.log(`📄 Reading Excel: ${filePath}`);
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });

  console.log(`📄 Sheet: ${sheetName}`);
  console.log(`📦 Excel rows: ${rows.length}`);
  console.log(`🔑 Match fields: ${matchFields.join(" + ")}\n`);

  await connectToMongoDB();

  const dbDaycares = await Daycare.find({})
    .select("name address city region")
    .lean();

  console.log(`🗄️  DB collection: daycares_master`);
  console.log(`🗄️  DB daycares: ${dbDaycares.length}\n`);

  const dbByExact = new Map();
  const dbByName = new Map();

  for (const daycare of dbDaycares) {
    const record = dbToRecord(daycare);
    const exactKey = buildKey(record, matchFields);
    if (!dbByExact.has(exactKey)) {
      dbByExact.set(exactKey, []);
    }
    dbByExact.get(exactKey).push(daycare);

    const nameKey = normalizePart(record.name);
    if (!dbByName.has(nameKey)) {
      dbByName.set(nameKey, []);
    }
    dbByName.get(nameKey).push(daycare);
  }

  let exactMatch = 0;
  let partialMatch = 0;
  let noMatch = 0;
  let skipped = 0;

  const unmatchedRows = [];
  const partialRows = [];
  const exportLines = [
    [
      "status",
      "excel_name",
      "excel_city",
      "excel_region",
      "excel_address",
      "db_name",
      "db_city",
      "db_region",
      "db_address",
    ].join(","),
  ];

  for (let i = 0; i < rows.length; i += 1) {
    const record = rowToRecord(rows[i]);

    const missingFields = matchFields.filter((field) => !record[field]);
    if (missingFields.length > 0) {
      skipped += 1;
      continue;
    }

    const exactKey = buildKey(record, matchFields);
    const exactHits = dbByExact.get(exactKey) || [];

    if (exactHits.length > 0) {
      exactMatch += 1;
      const hit = dbToRecord(exactHits[0]);
      exportLines.push(
        [
          "exact_match",
          record.name,
          record.city,
          record.region,
          record.address,
          hit.name,
          hit.city,
          hit.region,
          hit.address,
        ]
          .map(escapeCsv)
          .join(",")
      );
      continue;
    }

    const nameHits = dbByName.get(normalizePart(record.name)) || [];
    if (nameHits.length > 0) {
      partialMatch += 1;
      partialRows.push({ record, dbMatches: nameHits.map(dbToRecord) });
      for (const hit of nameHits.map(dbToRecord)) {
        exportLines.push(
          [
            "partial_match",
            record.name,
            record.city,
            record.region,
            record.address,
            hit.name,
            hit.city,
            hit.region,
            hit.address,
          ]
            .map(escapeCsv)
            .join(",")
        );
      }
      continue;
    }

    noMatch += 1;
    unmatchedRows.push(record);
    exportLines.push(
      [
        "no_match",
        record.name,
        record.city,
        record.region,
        record.address,
        "",
        "",
        "",
        "",
      ]
        .map(escapeCsv)
        .join(",")
    );
  }

  const excelKeys = new Set(
    rows
      .map(rowToRecord)
      .filter((record) => matchFields.every((field) => record[field]))
      .map((record) => buildKey(record, matchFields))
  );

  const dbNotInExcel = dbDaycares.filter((daycare) => {
    const record = dbToRecord(daycare);
    if (!matchFields.every((field) => record[field])) {
      return false;
    }
    return !excelKeys.has(buildKey(record, matchFields));
  });

  const matchLabel = matchFields.join(" + ");

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("📊 COMPARISON SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`   ✅ Exact match (${matchLabel}): ${exactMatch}`);
  console.log(`   ⚠️  Same name, other fields differ: ${partialMatch}`);
  console.log(`   ❌ Not found in DB at all:         ${noMatch}`);
  console.log(
    `   ⏭️  Skipped (missing ${matchFields.join("/")}): ${skipped}`
  );
  console.log(`   📤 In DB but not in Excel:        ${dbNotInExcel.length}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (partialRows.length > 0) {
    console.log("⚠️  Same name in DB but match fields differ (first 20):");
    partialRows.slice(0, 20).forEach((row, idx) => {
      const { record } = row;
      console.log(
        `\n   ${idx + 1}. Excel: "${record.name}" | city=${record.city} | region=${record.region}`
      );
      row.dbMatches.slice(0, 3).forEach((hit) => {
        console.log(
          `      DB:    "${hit.name}" | city=${hit.city} | region=${hit.region}`
        );
      });
      if (row.dbMatches.length > 3) {
        console.log(`      ... and ${row.dbMatches.length - 3} more DB row(s) with same name`);
      }
    });
    if (partialRows.length > 20) {
      console.log(`\n   ... and ${partialRows.length - 20} more partial mismatches`);
    }
    console.log();
  }

  if (showUnmatched && unmatchedRows.length > 0) {
    console.log("❌ Excel rows not found in DB (first 30):");
    unmatchedRows.slice(0, 30).forEach((record, idx) => {
      console.log(
        `   ${idx + 1}. "${record.name}" | city=${record.city} | region=${record.region}`
      );
    });
    if (unmatchedRows.length > 30) {
      console.log(`   ... and ${unmatchedRows.length - 30} more`);
    }
    console.log();
  } else if (unmatchedRows.length > 0) {
    console.log(
      `❌ ${unmatchedRows.length} Excel row(s) not in DB. Re-run with --show-unmatched to list them.\n`
    );
  }

  if (dbNotInExcel.length > 0) {
    console.log("📤 DB daycares missing from Excel (first 15):");
    dbNotInExcel.slice(0, 15).forEach((daycare, idx) => {
      const record = dbToRecord(daycare);
      console.log(
        `   ${idx + 1}. "${record.name}" | city=${record.city} | region=${record.region}`
      );
    });
    if (dbNotInExcel.length > 15) {
      console.log(`   ... and ${dbNotInExcel.length - 15} more`);
    }
    console.log();
  }

  if (exportPath) {
    fs.writeFileSync(exportPath, exportLines.join("\n"), "utf8");
    console.log(`💾 Full report saved to: ${exportPath}\n`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Compare failed:", err);
  process.exit(1);
});
