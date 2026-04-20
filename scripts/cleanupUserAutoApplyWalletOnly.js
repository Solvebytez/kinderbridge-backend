/* eslint-disable no-console */
/**
 * Deletes ONLY the auto-apply credits wallet for a user email.
 *
 * Usage (from backend folder):
 *   node scripts/cleanupUserAutoApplyWalletOnly.js sahinh013@gmail.com
 *
 * Reads DB connection from backend/.env (MONGODB_URI, optional DB_NAME).
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

const User = require("../src/schemas/UserSchema");
const AutoApplyCredit = require("../src/schemas/AutoApplyCreditSchema");

async function main() {
  const emailArg = process.argv[2];
  const email = String(emailArg || "").trim().toLowerCase();
  if (!email) {
    console.error(
      "Email is required. Example: node scripts/cleanupUserAutoApplyWalletOnly.js user@example.com"
    );
    process.exit(1);
  }

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

  const before = await AutoApplyCredit.countDocuments({ userId });
  const del = await AutoApplyCredit.deleteOne({ userId });

  console.log("AutoApplyCredit wallet deleted:", {
    before,
    deletedCount: del.deletedCount,
  });

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("cleanupUserAutoApplyWalletOnly failed:", e);
  process.exit(1);
});

