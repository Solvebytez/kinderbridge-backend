/* eslint-disable no-console */
/**
 * Check a user's Stripe purchase + credit wallet state by email.
 *
 * Usage (from backend folder):
 *   node scripts/checkPurchaseAndCredits.js sahinh013@gmail.com
 *   node scripts/checkPurchaseAndCredits.js sahinh013@gmail.com pi_123
 *
 * Optional env:
 * - MONGODB_URI (required)
 * - DB_NAME (optional, default: daycare_concierge)
 * - STRIPE_SECRET_KEY (optional; if set, will verify PaymentIntent in Stripe)
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Stripe = require("stripe");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

const User = require("../src/schemas/UserSchema");
const Purchase = require("../src/schemas/PurchaseSchema");
const AutoApplyCredit = require("../src/schemas/AutoApplyCreditSchema");

function pick(obj, keys) {
  if (!obj) return obj;
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

function printSection(title, body) {
  console.log(`\n=== ${title} ===`);
  if (body === undefined) return;
  if (body === null) return console.log("(null)");
  if (typeof body === "string") return console.log(body);
  console.log(JSON.stringify(body, null, 2));
}

async function main() {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();
  const paymentIntentFilter = String(process.argv[3] || "").trim() || null;

  if (!email) {
    console.error(
      "Email is required. Example: node scripts/checkPurchaseAndCredits.js user@example.com"
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
    printSection("USER", { email, found: false });
    process.exit(2);
  }

  const userId = String(user._id);
  printSection(
    "USER",
    pick(user, ["_id", "email", "userType", "isActive", "createdAt", "updatedAt"])
  );

  const wallet = await AutoApplyCredit.findOne({ userId }).lean();
  const grants = Array.isArray(wallet?.grants) ? wallet.grants : [];
  const lastGrants = grants.slice(-10).map((g) =>
    pick(g, ["credits", "paymentReference", "note", "grantedAt"])
  );
  printSection(
    "AUTO-APPLY WALLET (AutoApplyCredit)",
    wallet
      ? {
          userId: wallet.userId,
          totalCredits: wallet.totalCredits,
          usedCredits: wallet.usedCredits,
          remainingCredits: wallet.remainingCredits,
          grantsCount: grants.length,
          lastCreditGrantAt: wallet.lastCreditGrantAt,
          lastCreditUsageAt: wallet.lastCreditUsageAt,
          lastGrants,
        }
      : null
  );

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

  printSection(
    "PURCHASES (Purchase)",
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
        "description",
        "createdAt",
        "updatedAt",
      ])
    )
  );

  const completedAutoApply = purchases.filter(
    (p) => p.paymentType === "auto_apply_credits" && p.status === "completed"
  );
  const lastCompleted = completedAutoApply[0] || null;

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripe = stripeKey ? new Stripe(stripeKey) : null;

  if (lastCompleted?.stripePaymentId && stripe) {
    const pi = await stripe.paymentIntents.retrieve(lastCompleted.stripePaymentId);
    printSection("STRIPE PAYMENTINTENT (live)", pick(pi, ["id", "status", "amount", "currency", "metadata", "created"]));
  } else if (!stripeKey) {
    printSection(
      "STRIPE PAYMENTINTENT (live)",
      "Skipped (STRIPE_SECRET_KEY not set)."
    );
  } else {
    printSection(
      "STRIPE PAYMENTINTENT (live)",
      "Skipped (no completed auto_apply_credits purchase found)."
    );
  }

  // Quick sanity checks
  const sanity = {
    email,
    userId,
    purchasesFound: purchases.length,
    completedAutoApplyPurchasesFound: completedAutoApply.length,
    walletExists: !!wallet,
    walletRemainingCredits: wallet ? Number(wallet.remainingCredits || 0) : null,
    walletHasAnyGrant: grants.length > 0,
    walletHasGrantForLastCompletedPayment:
      !!(lastCompleted?.stripePaymentId) &&
      grants.some((g) => g?.paymentReference === lastCompleted.stripePaymentId),
  };

  printSection("SANITY CHECK", sanity);

  await mongoose.disconnect();
  console.log("\nDone.\n");
}

main().catch(async (e) => {
  console.error("\ncheckPurchaseAndCredits failed:", e?.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});

