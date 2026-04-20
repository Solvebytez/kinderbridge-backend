/* eslint-disable no-console */
/**
 * Inspect a user's auto-apply/payment DB state by email.
 *
 * Usage (from backend folder):
 *   node scripts/inspectUserAutoApply.js sahinh013@gmail.com
 *   node scripts/inspectUserAutoApply.js sahinh013@gmail.com pi_3TOLFE4OULzMobO20iycGvpS
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

function pick(obj, keys) {
  if (!obj) return obj;
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

async function main() {
  const emailArg = process.argv[2];
  const email = String(emailArg || "").trim().toLowerCase();
  const paymentIntentFilter = String(process.argv[3] || "").trim() || null;

  if (!email) {
    console.error(
      "Email is required. Example: node scripts/inspectUserAutoApply.js user@example.com"
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
  console.log("\n=== USER ===");
  console.log(
    JSON.stringify(
      {
        email,
        userId,
        userType: user.userType,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      null,
      2
    )
  );

  const wallet = await AutoApplyCredit.findOne({ userId }).lean();
  console.log("\n=== AUTO-APPLY WALLET (AutoApplyCredit) ===");
  if (!wallet) {
    console.log("(none)");
  } else {
    const grants = Array.isArray(wallet.grants) ? wallet.grants : [];
    const lastGrants = grants.slice(-5).map((g) =>
      pick(g, ["credits", "paymentReference", "note", "grantedAt"])
    );

    const hasPaymentRef = paymentIntentFilter
      ? grants.some((g) => g?.paymentReference === paymentIntentFilter)
      : null;

    console.log(
      JSON.stringify(
        {
          userId: wallet.userId,
          totalCredits: wallet.totalCredits,
          usedCredits: wallet.usedCredits,
          remainingCredits: wallet.remainingCredits,
          grantsCount: grants.length,
          lastCreditGrantAt: wallet.lastCreditGrantAt,
          lastCreditUsageAt: wallet.lastCreditUsageAt,
          ...(paymentIntentFilter
            ? { paymentIntentFilter, walletHasThatPaymentReference: hasPaymentRef }
            : {}),
          lastGrants,
        },
        null,
        2
      )
    );
  }

  const purchaseFilter = { userId };
  if (paymentIntentFilter) {
    purchaseFilter.$or = [
      { stripePaymentId: paymentIntentFilter },
      { paymentIntentId: paymentIntentFilter },
    ];
  }

  const purchases = await Purchase.find(purchaseFilter)
    .sort({ createdAt: -1 })
    .limit(paymentIntentFilter ? 50 : 20)
    .lean();

  console.log("\n=== PURCHASES (Purchase) ===");
  console.log(
    JSON.stringify(
      purchases.map((p) =>
        pick(p, [
          "_id",
          "paymentType",
          "status",
          "amount",
          "currency",
          "stripePaymentId",
          "paymentIntentId",
          "creditsGranted",
          "processedAt",
          "webhookEventId",
          "daycareId",
          "daycareIds",
          "description",
          "createdAt",
          "updatedAt",
        ])
      ),
      null,
      2
    )
  );

  const purchaseStats = purchases.reduce(
    (acc, p) => {
      acc.total += 1;
      acc.byStatus[p.status || "unknown"] = (acc.byStatus[p.status || "unknown"] || 0) + 1;
      acc.byType[p.paymentType || "unknown"] =
        (acc.byType[p.paymentType || "unknown"] || 0) + 1;
      return acc;
    },
    { total: 0, byStatus: {}, byType: {} }
  );
  console.log("\n=== PURCHASE STATS (from listed rows) ===");
  console.log(JSON.stringify(purchaseStats, null, 2));

  const apps = await Application.find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  console.log("\n=== APPLICATIONS (Application) last 50 ===");
  console.log(
    JSON.stringify(
      apps.map((a) =>
        pick(a, [
          "_id",
          "source",
          "status",
          "daycareId",
          "parentName",
          "parentEmail",
          "childName",
          "childDob",
          "preferredStartDate",
          "createdAt",
          "updatedAt",
        ])
      ),
      null,
      2
    )
  );

  const appCounts = apps.reduce(
    (acc, a) => {
      const source = a.source || "unknown";
      acc.total += 1;
      acc.bySource[source] = (acc.bySource[source] || 0) + 1;
      acc.byStatus[a.status || "unknown"] = (acc.byStatus[a.status || "unknown"] || 0) + 1;
      return acc;
    },
    { total: 0, bySource: {}, byStatus: {} }
  );
  console.log("\n=== APPLICATION STATS (from listed rows) ===");
  console.log(JSON.stringify(appCounts, null, 2));

  await mongoose.disconnect();
  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error("inspectUserAutoApply failed:", e);
  process.exit(1);
});

