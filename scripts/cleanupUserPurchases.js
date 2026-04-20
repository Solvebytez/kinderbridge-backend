/* eslint-disable no-console */
/**
 * Deletes all purchase records for a user email and resets their auto-apply credits wallet.
 *
 * Usage (from backend folder):
 *   node scripts/cleanupUserPurchases.js sahinh013@gmail.com
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

async function main() {
  const emailArg = process.argv[2];
  const email = String(emailArg || "").trim().toLowerCase();
  if (!email) {
    console.error("Email is required. Example: node scripts/cleanupUserPurchases.js user@example.com");
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

  const purchaseDelete = await Purchase.deleteMany({ userId });
  const walletDelete = await AutoApplyCredit.deleteOne({ userId });

  console.log("Purchases deleted:", {
    before: beforePurchases,
    deletedCount: purchaseDelete.deletedCount,
  });
  console.log("AutoApplyCredit wallet removed:", {
    existed: !!beforeWallet,
    deletedCount: walletDelete.deletedCount,
  });

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("cleanupUserPurchases failed:", e);
  process.exit(1);
});

