/* eslint-disable no-console */
/**
 * Resets ALL auto-apply related state for a user email:
 * - Deletes Purchase docs for paymentType=auto_apply_credits (and optionally any Purchase with daycareIds)
 * - Deletes AutoApplyCredit wallet
 * - Deletes Application docs where source=auto_apply
 *
 * Usage (from backend folder):
 *   node scripts/resetUserAutoApplyState.js sahinh013@gmail.com
 *   node scripts/resetUserAutoApplyState.js sahinh013@gmail.com --keep-applications
 *
 * Reads DB connection from backend/.env (MONGODB_URI, optional DB_NAME).
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

function hasFlag(flag) {
  return process.argv.slice(3).includes(flag);
}

async function main() {
  const emailArg = process.argv[2];
  const email = String(emailArg || "").trim().toLowerCase();
  if (!email) {
    console.error(
      "Email is required. Example: node scripts/resetUserAutoApplyState.js user@example.com"
    );
    process.exit(1);
  }

  const keepApplications = hasFlag("--keep-applications");

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in backend/.env");
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

  const purchasesFilter = {
    userId,
    $or: [{ paymentType: "auto_apply_credits" }, { daycareIds: { $exists: true, $ne: [] } }],
  };

  const beforePurchases = await Purchase.countDocuments(purchasesFilter);
  const beforeWallet = await AutoApplyCredit.countDocuments({ userId });
  const beforeApps = keepApplications
    ? 0
    : await Application.countDocuments({ userId, source: "auto_apply" });

  const purchaseDelete = await Purchase.deleteMany(purchasesFilter);
  const walletDelete = await AutoApplyCredit.deleteOne({ userId });
  const appsDelete = keepApplications
    ? { deletedCount: 0 }
    : await Application.deleteMany({ userId, source: "auto_apply" });

  console.log("Deleted purchases:", {
    filter: purchasesFilter,
    before: beforePurchases,
    deletedCount: purchaseDelete.deletedCount,
  });
  console.log("Deleted auto-apply wallet:", {
    before: beforeWallet,
    deletedCount: walletDelete.deletedCount,
  });
  console.log(
    keepApplications
      ? "Kept auto-apply applications (--keep-applications)."
      : "Deleted auto-apply applications (source=auto_apply)."
  );
  if (!keepApplications) {
    console.log("Deleted applications:", {
      before: beforeApps,
      deletedCount: appsDelete.deletedCount,
    });
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error("resetUserAutoApplyState failed:", e);
  process.exit(1);
});

