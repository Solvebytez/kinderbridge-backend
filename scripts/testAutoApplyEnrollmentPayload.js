/* eslint-disable no-console */
/**
 * Test POST /api/applications/auto-apply logic WITH enrollmentPayload
 * (same as frontend checkout sends after the enrollmentPayload fix).
 *
 * Usage (from backend folder):
 *   node scripts/testAutoApplyEnrollmentPayload.js sahinh013@gmail.com
 *   node scripts/testAutoApplyEnrollmentPayload.js sahinh013@gmail.com --daycare-id 6977928e2e40cca8d4f82429
 *   node scripts/testAutoApplyEnrollmentPayload.js sahinh013@gmail.com --grant-credits
 *
 * Then verify DB:
 *   node scripts/inspectUserData.js sahinh013@gmail.com --limit 1
 *
 * Requires MONGODB_URI in backend/.env and at least 1 auto-apply credit
 * (or pass --grant-credits to add 30 test credits).
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
const EnrollmentSubmission = require("../src/schemas/EnrollmentSubmissionSchema");
const ApplicationController = require("../src/controllers/applicationController");

/** Sample payload matching frontend buildEnrollmentPayloadFromAutoApply shape */
function sampleEnrollmentPayload() {
  return {
    child: {
      first_name: "Child",
      middle_name: "",
      last_name: "1",
      date_of_birth: "2026-12-02",
      gender: "Male",
    },
    primary_parent: {
      first_name: "Parent",
      last_name: "name",
      relationship: "",
      email: "sahinh013@gmail.com",
      phone: "+918670695089",
      phone_type: "",
      address: {
        street: "n002",
        city: "BADURIA",
        province: "West Bengal",
        postal_code: "743401",
        country: "India",
      },
      employment: {
        employment_status: "",
        employer_name: "",
        job_title: "asfas",
        work_hours: "",
      },
    },
    enrollment: {
      program_type: "",
      start_date: "2026-12-02",
      schedule_type: "",
      days_required: ["Wednesday", "Tuesday"],
    },
    health_and_wellness: {
      dietary_restrictions: [],
      food_allergies: [],
      photo_consent: true,
      emergency_medical_treatment: true,
    },
    form_metadata: {
      preferred_language: "Mandarin",
    },
  };
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function getArg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function pickDaycareId(userId) {
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
    .select("_id name")
    .lean();

  if (!fresh?._id) return null;
  return { id: String(fresh._id), name: fresh.name };
}

async function main() {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();
  const grantCredits = hasFlag("--grant-credits");
  const daycareIdArg = getArg("--daycare-id");

  if (!email) {
    console.error(
      "Usage: node scripts/testAutoApplyEnrollmentPayload.js <email> [--daycare-id <id>] [--grant-credits]"
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
    console.error("User not found:", email);
    process.exit(2);
  }

  const userId = String(user._id);
  const controller = new ApplicationController({});

  if (grantCredits) {
    console.log("Granting 30 test credits...");
    const grantRes = await controller.grantAutoApplyCredits(userId, {
      credits: 30,
      paymentReference: "test-script-grant",
      note: "testAutoApplyEnrollmentPayload.js",
    });
    console.log("Grant result:", grantRes.statusCode, grantRes.body?.success);
  }

  let daycareId = daycareIdArg;
  let daycareName = "";
  if (daycareId) {
    const d = await Daycare.findById(daycareId).select("name").lean();
    daycareName = d?.name || "";
  } else {
    const picked = await pickDaycareId(userId);
    if (!picked) {
      console.error(
        "No eligible daycare (all may already have pending apps). Pass --daycare-id <id>."
      );
      process.exit(3);
    }
    daycareId = picked.id;
    daycareName = picked.name || "";
  }

  const enrollmentPayload = sampleEnrollmentPayload();
  enrollmentPayload.primary_parent.email = email;

  const requestBody = {
    daycareIds: [daycareId],
    parentName: "Parent name",
    parentEmail: email,
    parentPhone: "+918670695089",
    childName: "Child 1",
    childDob: "2026-12-02",
    preferredStartDate: "2026-12-02",
    specialNotes: "",
    enrollmentPayload,
  };

  console.log("\n--- Request (same shape as frontend POST /api/applications/auto-apply) ---\n");
  console.log(JSON.stringify(requestBody, null, 2));

  const walletBefore = await AutoApplyCredit.findOne({ userId }).lean();
  console.log("\nWallet before:", {
    remainingCredits: walletBefore?.remainingCredits ?? 0,
    usedCredits: walletBefore?.usedCredits ?? 0,
  });

  console.log("\n--- Calling submitAutoApplyApplications ---\n");
  const result = await controller.submitAutoApplyApplications(userId, requestBody);
  console.log("statusCode:", result.statusCode);
  console.log("body:", JSON.stringify(result.body, null, 2));

  if (result.statusCode < 200 || result.statusCode >= 300 || !result.body?.success) {
    console.error("\nSubmit failed. If insufficient credits, run with --grant-credits.");
    await mongoose.disconnect();
    process.exit(4);
  }

  const createdIds = (result.body?.data?.createdIds || []).map(String);
  const applicationId = createdIds[0];
  if (!applicationId) {
    console.error("No createdIds in response.");
    await mongoose.disconnect();
    process.exit(5);
  }

  const enrollment = await EnrollmentSubmission.findOne({ applicationId }).lean();
  console.log("\n--- Enrollment in DB (applicationId:", applicationId, ") ---\n");
  if (!enrollment) {
    console.error("No enrollment submission found for application.");
  } else {
    const pp = enrollment.payload?.primary_parent || {};
    const addr = pp.address || {};
    const hw = enrollment.payload?.health_and_wellness || {};
    console.log("Checks vs sample payload:");
    console.log({
      addressStreet: { expected: "n002", got: addr.street, ok: addr.street === "n002" },
      addressCity: { expected: "BADURIA", got: addr.city, ok: addr.city === "BADURIA" },
      jobTitle: {
        expected: "asfas",
        got: pp.employment?.job_title,
        ok: pp.employment?.job_title === "asfas",
      },
      preferredLanguage: {
        expected: "Mandarin",
        got: enrollment.payload?.form_metadata?.preferred_language,
        ok: enrollment.payload?.form_metadata?.preferred_language === "Mandarin",
      },
      childGender: {
        expected: "Male",
        got: enrollment.payload?.child?.gender,
        ok: enrollment.payload?.child?.gender === "Male",
      },
      daysRequired: {
        expected: ["Wednesday", "Tuesday"],
        got: enrollment.payload?.enrollment?.days_required,
        ok:
          Array.isArray(enrollment.payload?.enrollment?.days_required) &&
          enrollment.payload.enrollment.days_required.length === 2,
      },
      photoConsent: {
        expected: true,
        got: hw.photo_consent,
        ok: hw.photo_consent === true,
      },
      emergencyMedical: {
        expected: true,
        got: hw.emergency_medical_treatment,
        ok: hw.emergency_medical_treatment === true,
      },
    });
    console.log("\nFull enrollment payload:\n");
    console.log(JSON.stringify(enrollment.payload, null, 2));
  }

  const walletAfter = await AutoApplyCredit.findOne({ userId }).lean();
  console.log("\nWallet after:", {
    remainingCredits: walletAfter?.remainingCredits ?? 0,
    usedCredits: walletAfter?.usedCredits ?? 0,
  });

  console.log("\nNext: node scripts/inspectUserData.js", email, "--limit 1\n");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("testAutoApplyEnrollmentPayload failed:", e);
  process.exit(1);
});
