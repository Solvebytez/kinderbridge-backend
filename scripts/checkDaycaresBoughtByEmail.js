/* eslint-disable no-console */
/**
 * Check how many daycares a user "bought" (applied to) by email.
 *
 * In this codebase, users purchase AUTO-APPLY CREDITS packs (Purchase),
 * then spend 1 credit per daycare application (Application, source=auto_apply).
 *
 * This script reports:
 * - total applications + unique daycareIds (all sources)
 * - auto-apply applications + unique daycareIds (source=auto_apply)
 * - purchases that mention daycareIds (usually credit pack checkout metadata)
 *
 * Usage (from backend folder):
 *   node scripts/checkDaycaresBoughtByEmail.js sahinh013@gmail.com
 *
 * Required env:
 * - MONGODB_URI (backend/.env)
 * Optional env:
 * - DB_NAME (default: daycare_concierge)
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

const User = require("../src/schemas/UserSchema");
const Application = require("../src/schemas/ApplicationSchema");
const Purchase = require("../src/schemas/PurchaseSchema");

function printSection(title, body) {
  console.log(`\n=== ${title} ===`);
  if (body === undefined) return;
  if (body === null) return console.log("(null)");
  if (typeof body === "string") return console.log(body);
  console.log(JSON.stringify(body, null, 2));
}

function uniq(arr) {
  return [...new Set((Array.isArray(arr) ? arr : []).filter(Boolean))];
}

async function main() {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();

  if (!email) {
    console.error(
      "Email is required. Example: node scripts/checkDaycaresBoughtByEmail.js user@example.com"
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
  printSection("USER", {
    userId,
    email: user.email,
    userType: user.userType,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });

  const applications = await Application.find({ userId })
    .select("daycareId source status createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const allDaycareIds = uniq(applications.map((a) => String(a.daycareId || "").trim()).filter(Boolean));
  const autoApplyApps = applications.filter((a) => a.source === "auto_apply");
  const autoApplyDaycareIds = uniq(autoApplyApps.map((a) => String(a.daycareId || "").trim()).filter(Boolean));

  const byStatus = applications.reduce((acc, a) => {
    const k = String(a.status || "unknown");
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  printSection("APPLICATIONS (what was actually submitted)", {
    totalApplications: applications.length,
    uniqueDaycaresAppliedTo: allDaycareIds.length,
    autoApplyApplications: autoApplyApps.length,
    uniqueDaycaresAutoAppliedTo: autoApplyDaycareIds.length,
    applicationsByStatus: byStatus,
    last10Applications: applications.slice(0, 10),
  });

  const purchases = await Purchase.find({ userId, status: "completed" })
    .select("paymentType status amount currency stripePaymentId paymentIntentId daycareIds creditsGranted createdAt processedAt")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const purchaseDaycareIds = uniq(
    purchases.flatMap((p) =>
      Array.isArray(p.daycareIds) ? p.daycareIds.map((id) => String(id).trim()) : []
    )
  );

  printSection("PURCHASES (completed) that mention daycareIds", {
    completedPurchases: purchases.length,
    uniqueDaycareIdsMentionedInPurchases: purchaseDaycareIds.length,
    last10Purchases: purchases.slice(0, 10),
  });

  await mongoose.disconnect();
  console.log("\nDone.\n");
}

main().catch(async (e) => {
  console.error("\ncheckDaycaresBoughtByEmail failed:", e?.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});

