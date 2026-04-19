/* eslint-disable no-console */
/**
 * One-time: copy stripePaymentId into paymentIntentId when paymentIntentId is null.
 * Fixes E11000 duplicate key on unique index paymentIntentId_1 (multiple nulls).
 *
 * From backend folder: node scripts/backfillPurchasePaymentIntentId.js
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Purchase = require("../src/schemas/PurchaseSchema");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(uri.replace(/[<>]/g, ""));

  const res = await Purchase.updateMany(
    {
      stripePaymentId: { $exists: true, $nin: [null, ""] },
      $or: [{ paymentIntentId: null }, { paymentIntentId: { $exists: false } }],
    },
    [
      {
        $set: {
          paymentIntentId: "$stripePaymentId",
        },
      },
    ]
  );

  console.log("Updated documents (matched / modified):", res.matchedCount, res.modifiedCount);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
