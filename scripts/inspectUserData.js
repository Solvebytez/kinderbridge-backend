/* eslint-disable no-console */
/**
 * Print latest MongoDB data for a parent account (form submit, purchases, enrollments).
 *
 * Usage (from backend folder):
 *   node scripts/inspectUserData.js sahin013@gmail.com
 *   node scripts/inspectUserData.js sahin013@gmail.com --limit 5
 *
 * Reads MONGODB_URI and optional DB_NAME from backend/.env
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

const User = require("../src/schemas/UserSchema");
const Application = require("../src/schemas/ApplicationSchema");
const Purchase = require("../src/schemas/PurchaseSchema");
const EnrollmentSubmission = require("../src/schemas/EnrollmentSubmissionSchema");
const AutoApplyCredit = require("../src/schemas/AutoApplyCreditSchema");

function parseArgs() {
  const args = process.argv.slice(2);
  let email = "";
  let limit = 20;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = Math.max(1, parseInt(args[i + 1], 10) || 20);
      i += 1;
    } else if (!args[i].startsWith("-")) {
      email = args[i];
    }
  }
  return { email: email.trim().toLowerCase(), limit };
}

function hr(title) {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

function printJson(label, data) {
  console.log(`\n--- ${label} (${Array.isArray(data) ? data.length : data ? 1 : 0}) ---`);
  if (!data || (Array.isArray(data) && data.length === 0)) {
    console.log("(none)");
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const { email, limit } = parseArgs();
  if (!email) {
    console.error(
      "Email is required.\nExample: node scripts/inspectUserData.js sahin013@gmail.com"
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in backend/.env");
    process.exit(1);
  }

  const dbName = process.env.DB_NAME || "daycare_concierge";
  await mongoose.connect(uri.replace(/[<>]/g, ""), { dbName });
  console.log("Connected:", { dbName, email, limit });

  const user = await User.findOne({ email }).lean();
  if (!user?._id) {
    console.error("\nUser not found for email:", email);
    console.error("Tip: check spelling (e.g. sahinh013 vs sahin013).");
    await mongoose.disconnect();
    process.exit(2);
  }

  const userId = String(user._id);
  hr("USER");
  printJson("user", {
    _id: userId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });

  const wallet = await AutoApplyCredit.findOne({ userId }).lean();
  hr("AUTO-APPLY CREDITS (wallet)");
  printJson("autoApplyCredit", wallet);

  const purchases = await Purchase.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  hr(`PURCHASES (latest ${limit})`);
  printJson("purchases", purchases);

  const appsByUser = await Application.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const appsByEmail = await Application.find({ parentEmail: email })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const appMap = new Map();
  for (const a of [...appsByUser, ...appsByEmail]) {
    appMap.set(String(a._id), a);
  }
  const applications = [...appMap.values()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  hr(`APPLICATIONS (latest ${applications.length}, by userId + parentEmail)`);
  printJson("applications", applications);

  const applicationIds = applications.map((a) => String(a._id));

  const enrollmentsByUser = await EnrollmentSubmission.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const enrollmentsByApp =
    applicationIds.length > 0
      ? await EnrollmentSubmission.find({
          applicationId: { $in: applicationIds },
        })
          .sort({ updatedAt: -1 })
          .lean()
      : [];

  const enrollMap = new Map();
  for (const e of [...enrollmentsByUser, ...enrollmentsByApp]) {
    enrollMap.set(String(e._id), e);
  }
  const enrollments = [...enrollMap.values()].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  hr(`ENROLLMENT SUBMISSIONS (latest ${enrollments.length})`);
  printJson("enrollmentSubmissions", enrollments);

  if (applications[0]) {
    hr("LATEST APPLICATION (summary)");
    const latest = applications[0];
    printJson("latestApplication", {
      _id: latest._id,
      source: latest.source,
      status: latest.status,
      daycareId: latest.daycareId,
      parentName: latest.parentName,
      parentEmail: latest.parentEmail,
      parentPhone: latest.parentPhone,
      childName: latest.childName,
      childDob: latest.childDob,
      preferredStartDate: latest.preferredStartDate,
      specialNotes: latest.specialNotes,
      additionalNotes: latest.additionalNotes,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    });
  }

  if (enrollments[0]) {
    hr("LATEST ENROLLMENT PAYLOAD (n8n-shaped)");
    const latest = enrollments[0];
    printJson("latestEnrollmentMeta", {
      _id: latest._id,
      applicationId: latest.applicationId,
      daycareId: latest.daycareId,
      completionStatus: latest.completionStatus,
      automationStatus: latest.automationStatus,
      schemaVersion: latest.schemaVersion,
      n8n: latest.n8n,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    });
    printJson("latestEnrollmentPayload", latest.payload);
  }

  hr("COUNTS");
  const [purchaseCount, appCount, enrollCount] = await Promise.all([
    Purchase.countDocuments({ userId }),
    Application.countDocuments({
      $or: [{ userId }, { parentEmail: email }],
    }),
    EnrollmentSubmission.countDocuments({ userId }),
  ]);
  printJson("totals", {
    purchases: purchaseCount,
    applications: appCount,
    enrollmentSubmissions: enrollCount,
  });

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error("inspectUserData failed:", e);
  process.exit(1);
});
