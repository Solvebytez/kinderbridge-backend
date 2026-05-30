/* eslint-disable no-console */
/**
 * Deletes ALL Purchase rows for a user email and removes their AutoApplyCredit wallet.
 *
 * Optional: also delete auto-apply Application rows (recommended for a full "daycare pack" reset).
 *
 * Usage (from backend folder):
 *   node scripts/cleanupUserPurchases.js user@example.com
 *   node scripts/cleanupUserPurchases.js user@example.com --with-auto-apply-applications
 *     (also removes enrollment submissions for that user)
 *
 * Note: cleanupUserPurchasesOnly.js removes ONLY Purchase docs — wallet + applications remain.
 * For a broader reset (filtered purchases + apps), see resetUserAutoApplyState.js
 *
 * Requires backend/.env with MONGODB_URI.
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

const User = require("../src/schemas/UserSchema");
const Purchase = require("../src/schemas/PurchaseSchema");
const AutoApplyCredit = require("../src/schemas/AutoApplyCreditSchema");
const Application = require("../src/schemas/ApplicationSchema");
const EnrollmentSubmission = require("../src/schemas/EnrollmentSubmissionSchema");
const EnrollmentFormQueue = require("../src/schemas/EnrollmentFormQueueSchema");

function hasFlag(name) {
  return process.argv.slice(3).includes(name);
}

async function main() {
  const emailArg = process.argv[2];
  const email = String(emailArg || "").trim().toLowerCase();
  const withAutoApplyApps = hasFlag("--with-auto-apply-applications");
  if (!email) {
    console.error(
      "Email is required. Example: node scripts/cleanupUserPurchases.js user@example.com [--with-auto-apply-applications]"
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(uri.replace(/[<>]/g, ""), {
    dbName: process.env.DB_NAME || "daycare_concierge",
  });

  const user = await User.findOne({ email }).lean();
  if (!user?._id) {
    console.error("User not found for email:", email);
    process.exit(2);
  }

  const userId = String(user._id);
  console.log("Found user:", { email, userId });

  const beforePurchases = await Purchase.countDocuments({ userId });
  const beforeWallet = await AutoApplyCredit.findOne({ userId }).lean();
  const beforeAutoApplyApps = withAutoApplyApps
    ? await Application.countDocuments({ userId, source: "auto_apply" })
    : 0;
  const beforeEnrollments = withAutoApplyApps
    ? await EnrollmentSubmission.countDocuments({ userId })
    : 0;

  let queueIdsToDelete = [];
  if (withAutoApplyApps) {
    const subs = await EnrollmentSubmission.find({ userId })
      .select("enrollmentFormQueueId")
      .lean();
    queueIdsToDelete = subs
      .map((s) => String(s.enrollmentFormQueueId || "").trim())
      .filter(Boolean);
  }

  const purchaseDelete = await Purchase.deleteMany({ userId });
  const walletDelete = await AutoApplyCredit.deleteOne({ userId });
  const appsDelete = withAutoApplyApps
    ? await Application.deleteMany({ userId, source: "auto_apply" })
    : { deletedCount: 0 };
  const enrollmentsDelete = withAutoApplyApps
    ? await EnrollmentSubmission.deleteMany({ userId })
    : { deletedCount: 0 };
  const queueDelete =
    withAutoApplyApps && queueIdsToDelete.length > 0
      ? await EnrollmentFormQueue.deleteMany({
          _id: { $in: queueIdsToDelete },
        })
      : { deletedCount: 0 };

  console.log("Purchases deleted:", {
    before: beforePurchases,
    deletedCount: purchaseDelete.deletedCount,
  });
  console.log("AutoApplyCredit wallet removed:", {
    existed: !!beforeWallet,
    deletedCount: walletDelete.deletedCount,
  });
  if (withAutoApplyApps) {
    console.log("Auto-apply applications deleted:", {
      before: beforeAutoApplyApps,
      deletedCount: appsDelete.deletedCount,
    });
    console.log("Enrollment submissions deleted:", {
      before: beforeEnrollments,
      deletedCount: enrollmentsDelete.deletedCount,
    });
    console.log("Enrollment form queue deleted:", {
      linkedIds: queueIdsToDelete.length,
      deletedCount: queueDelete.deletedCount,
    });
  } else {
    console.log(
      "Auto-apply applications + enrollments: skipped (pass --with-auto-apply-applications)."
    );
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("cleanupUserPurchases failed:", e);
  process.exit(1);
});

