/* eslint-disable no-console */
/**
 * Invokes the same logic as POST /api/applications/auto-apply (ApplicationController.submitAutoApplyApplications).
 *
 * Default: duplicate-daycare probe — picks one daycare the user already has pending/accepted for,
 * submits again; expect HTTP-style 400 + success false (no DB spend of credits).
 *
 * Usage (from backend folder):
 *   node scripts/testAutoApplySubmit.js sahinh013@gmail.com
 *
 * Optional — actually spend 1 credit on a daycare the user has NOT applied to yet:
 *   node scripts/testAutoApplySubmit.js sahinh013@gmail.com --consume-new
 *
 * Requires MONGODB_URI in backend/.env
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

const User = require("../src/schemas/UserSchema");
const Application = require("../src/schemas/ApplicationSchema");
const Daycare = require("../src/schemas/DaycareSchema");
const AutoApplyCredit = require("../src/schemas/AutoApplyCreditSchema");
const ApplicationController = require("../src/controllers/applicationController");

function isoDate(d) {
  if (!d) return "2026-12-03";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "2026-12-03";
  return x.toISOString().slice(0, 10);
}

async function main() {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();
  const consumeNew = process.argv.includes("--consume-new");

  if (!email) {
    console.error("Usage: node scripts/testAutoApplySubmit.js <email> [--consume-new]");
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
    console.error("User not found:", email);
    process.exit(2);
  }

  const userId = String(user._id);
  const walletBefore = await AutoApplyCredit.findOne({ userId }).lean();

  const latestApp = await Application.findOne({ userId, source: "auto_apply" })
    .sort({ createdAt: -1 })
    .lean();

  if (!latestApp) {
    console.error("No auto_apply applications found for user; cannot build payload.");
    process.exit(3);
  }

  const payloadBase = {
    parentName: latestApp.parentName || "Test Parent",
    parentEmail: latestApp.parentEmail || email,
    parentPhone: latestApp.parentPhone || "0000000000",
    childName: latestApp.childName || "Child",
    childDob: isoDate(latestApp.childDob),
    preferredStartDate: isoDate(latestApp.preferredStartDate),
    specialNotes: latestApp.specialNotes || "",
  };

  const controller = new ApplicationController({});

  if (!consumeNew) {
    console.log("\n--- Test: duplicate daycare (same as latest auto_apply app) ---\n");
    const payload = {
      ...payloadBase,
      daycareIds: [String(latestApp.daycareId)],
    };
    const result = await controller.submitAutoApplyApplications(userId, payload);
    console.log("statusCode:", result.statusCode, "(expect 400)");
    console.log("body:", JSON.stringify(result.body, null, 2));
    if (result.statusCode !== 400 || result.body?.success !== false) {
      console.error("Unexpected: duplicate-only submit should be 400 with success false.");
      process.exitCode = 5;
    }
  } else {
    const existing = await Application.find({
      userId,
      status: { $in: ["pending", "accepted"] },
    })
      .select("daycareId")
      .lean();
    const taken = new Set(existing.map((a) => String(a.daycareId)));
    const takenOids = [...taken]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    const fresh = await Daycare.findOne({
      _id: { $nin: takenOids },
    })
      .select("_id")
      .lean();

    if (!fresh?._id) {
      console.error("No unused daycare found (or daycare ids are not ObjectIds). Abort.");
      process.exit(4);
    }

    const freshId = String(fresh._id);
    console.log("\n--- Test: NEW daycare (will consume 1 credit if successful) ---\n");
    console.log("daycareId:", freshId);
    const payload = {
      ...payloadBase,
      daycareIds: [freshId],
    };
    const result = await controller.submitAutoApplyApplications(userId, payload);
    console.log("statusCode:", result.statusCode);
    console.log("body:", JSON.stringify(result.body, null, 2));
  }

  const walletAfter = await AutoApplyCredit.findOne({ userId }).lean();
  console.log("\n--- Wallet before / after ---");
  console.log(
    JSON.stringify(
      {
        before: walletBefore
          ? {
              remainingCredits: walletBefore.remainingCredits,
              usedCredits: walletBefore.usedCredits,
            }
          : null,
        after: walletAfter
          ? {
              remainingCredits: walletAfter.remainingCredits,
              usedCredits: walletAfter.usedCredits,
            }
          : null,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error("testAutoApplySubmit failed:", e);
  process.exit(1);
});
