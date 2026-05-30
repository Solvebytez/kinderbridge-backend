/* eslint-disable no-console */
/**
 * Backfill enrollment_form_queue from existing enrollmentsubmissions.payload.
 *
 * Usage (from backend folder):
 *   node scripts/backfillEnrollmentFormQueue.js
 *   node scripts/backfillEnrollmentFormQueue.js --email user@example.com
 *   node scripts/backfillEnrollmentFormQueue.js --dry-run
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

const EnrollmentSubmission = require("../src/schemas/EnrollmentSubmissionSchema");
const User = require("../src/schemas/UserSchema");
const {
  syncEnrollmentToFormQueue,
} = require("../src/utils/enrollmentFormQueueSync");

function parseArgs() {
  const args = process.argv.slice(2);
  let email = "";
  let dryRun = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--email" && args[i + 1]) {
      email = args[i + 1].trim().toLowerCase();
      i += 1;
    } else if (!args[i].startsWith("-")) {
      email = args[i].trim().toLowerCase();
    }
  }
  return { email, dryRun };
}

async function main() {
  const { email, dryRun } = parseArgs();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in backend/.env");
    process.exit(1);
  }

  const dbName = process.env.DB_NAME || "daycare_concierge";
  await mongoose.connect(uri.replace(/[<>]/g, ""), { dbName });
  console.log("Connected:", dbName, dryRun ? "(dry-run)" : "");

  const filter = {};
  if (email) {
    const user = await User.findOne({ email }).lean();
    if (!user?._id) {
      console.error("User not found:", email);
      await mongoose.disconnect();
      process.exit(2);
    }
    filter.userId = String(user._id);
    console.log("Filtering userId:", filter.userId);
  }

  const submissions = await EnrollmentSubmission.find(filter)
    .sort({ updatedAt: -1 })
    .lean();

  console.log("Submissions to process:", submissions.length);

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const sub of submissions) {
    const label = `${sub._id} app=${sub.applicationId}`;
    try {
      if (dryRun) {
        console.log("[dry-run] would sync", label);
        synced += 1;
        continue;
      }
      const queueId = await syncEnrollmentToFormQueue(sub);
      if (queueId) {
        console.log("synced", label, "→ queue", queueId);
        synced += 1;
      } else {
        console.warn("skipped", label);
        skipped += 1;
      }
    } catch (err) {
      console.error("failed", label, err.message);
      failed += 1;
    }
  }

  console.log("\nSummary:", { synced, skipped, failed, total: submissions.length });
  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error("backfillEnrollmentFormQueue failed:", e);
  process.exit(1);
});
