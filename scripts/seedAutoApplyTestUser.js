/* eslint-disable no-console */
/**
 * Reset + seed auto-apply test data for a parent email.
 *
 * 1. Removes purchases, wallet, auto-apply applications, enrollments, linked queue rows
 * 2. Inserts a completed auto_apply_credits purchase
 * 3. Grants 30 credits to the wallet
 * 4. Submits auto-apply for 5 Toronto test daycares (creates enrollments + enrollment_form_queue)
 *
 * Usage (from backend folder):
 *   node scripts/seedAutoApplyTestUser.js sahinh013@gmail.com
 *   node scripts/seedAutoApplyTestUser.js sahinh013@gmail.com --submit-only
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
const Daycare = require("../src/schemas/DaycareSchema");
const ApplicationController = require("../src/controllers/applicationController");

function hasFlag(name) {
  return process.argv.includes(name);
}

function buildEnrollmentPayload(email) {
  return {
    child: {
      first_name: "Test",
      middle_name: "",
      last_name: "Child",
      date_of_birth: "2024-06-15",
      gender: "Male",
    },
    primary_parent: {
      first_name: "Sahin",
      last_name: "Test",
      relationship: "Father",
      email,
      phone: "+14165550123",
      phone_type: "Mobile",
      address: {
        street: "123 Test Street",
        city: "Toronto",
        province: "ON",
        postal_code: "M5V 1A1",
        country: "Canada",
      },
      employment: {
        employment_status: "Employed Full-time",
        employer_name: "Test Employer",
        job_title: "Engineer",
        work_hours: "9 AM - 5 PM",
      },
    },
    enrollment: {
      program_type: "Preschool (2-5 years)",
      start_date: "2026-09-01",
      schedule_type: "Full Time (5 days)",
      days_required: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    },
    health_and_wellness: {
      dietary_restrictions: [],
      food_allergies: [],
      photo_consent: true,
      emergency_medical_treatment: true,
    },
    consent_and_declarations: {
      parent_declaration: true,
      privacy_policy: true,
      terms_and_conditions: true,
    },
    form_metadata: {
      preferred_language: "English",
    },
  };
}

const TEST_DAYCARES = [
  {
    name: "Abiona Centre For Infant And Early Mental Health Early Learning",
    city: "Toronto",
    address: "40 Humewood Dr, Toronto, ON, M6C 2W4",
  },
  {
    name: "Albion Heights School Age YMCA",
    city: "Etobicoke",
    address: "45 Lynmont Road, Etobicoke, ON M9V 3W9",
  },
  {
    name: "Absorbent Minds (Op1756925 Ontario Inc.)",
    city: "Scarborough",
    address: "16 Old Kingston Road, Scarborough, Ontario M1E 3J5",
  },
  {
    name: "Absorbent Minds 2",
    city: "Scarborough",
    address: "20 Old Kingston Road, Scarborough, ON M1E 3J5",
  },
  {
    name: "After Four Children's Enrichment Program",
    city: "Scarborough",
    address: "10 Japonica Rd, Scarborough, ON M1R 4R7",
  },
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function cleanupUser(userId) {
  const subs = await EnrollmentSubmission.find({ userId })
    .select("enrollmentFormQueueId")
    .lean();
  const queueIds = subs
    .map((s) => String(s.enrollmentFormQueueId || "").trim())
    .filter(Boolean);

  const purchaseDelete = await Purchase.deleteMany({ userId });
  const walletDelete = await AutoApplyCredit.deleteOne({ userId });
  const appsDelete = await Application.deleteMany({
    userId,
    source: "auto_apply",
  });
  const enrollmentsDelete = await EnrollmentSubmission.deleteMany({ userId });
  const queueDelete =
    queueIds.length > 0
      ? await EnrollmentFormQueue.deleteMany({ _id: { $in: queueIds } })
      : { deletedCount: 0 };

  return {
    purchases: purchaseDelete.deletedCount,
    wallet: walletDelete.deletedCount,
    applications: appsDelete.deletedCount,
    enrollments: enrollmentsDelete.deletedCount,
    queue: queueDelete.deletedCount,
  };
}

async function findDaycare(spec) {
  return Daycare.findOne({
    name: new RegExp(`^${escapeRegex(spec.name)}$`, "i"),
    city: new RegExp(`^${escapeRegex(spec.city)}$`, "i"),
    address: new RegExp(`^${escapeRegex(spec.address)}$`, "i"),
  })
    .select("_id name city region address")
    .lean();
}

async function submitAutoApplyForDaycares(userId, email, daycareIds, resolved) {
  const controller = new ApplicationController({});
  const enrollmentPayload = buildEnrollmentPayload(email);
  const requestBody = {
    daycareIds,
    parentName: "Sahin Test",
    parentEmail: email,
    parentPhone: "+14165550123",
    childName: "Test Child",
    childDob: "2024-06-15",
    preferredStartDate: "2026-09-01",
    specialNotes: "Seeded via seedAutoApplyTestUser.js",
    enrollmentPayload,
  };

  console.log("\n=== STEP 4: SUBMIT AUTO-APPLY (enrollment_form_queue) ===");
  const result = await controller.submitAutoApplyApplications(userId, requestBody);
  console.log("statusCode:", result.statusCode);
  if (result.statusCode < 200 || result.statusCode >= 300 || !result.body?.success) {
    console.error("Submit failed:", JSON.stringify(result.body, null, 2));
    return false;
  }

  const createdIds = (result.body?.data?.createdIds || []).map(String);
  console.log("Applications created:", createdIds.length);

  for (let i = 0; i < createdIds.length; i += 1) {
    const applicationId = createdIds[i];
    const enrollment = await EnrollmentSubmission.findOne({ applicationId }).lean();
    const daycare = resolved[i];
    console.log(`\n${i + 1}. ${daycare?.name || applicationId}`);
    console.log("   applicationId:", applicationId);
    console.log("   enrollmentId:", enrollment?._id || "(missing)");
    console.log("   enrollmentFormQueueId:", enrollment?.enrollmentFormQueueId || "(missing)");
  }

  const queueCount = await EnrollmentFormQueue.countDocuments({});
  const userQueueIds = (
    await EnrollmentSubmission.find({ userId }).select("enrollmentFormQueueId").lean()
  )
    .map((s) => s.enrollmentFormQueueId)
    .filter(Boolean);

  console.log("\nQueue rows linked to this user:", userQueueIds.length);
  console.log("Total enrollment_form_queue rows in DB:", queueCount);
  return true;
}

async function main() {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();
  const submitOnly = hasFlag("--submit-only");

  if (!email) {
    console.error(
      "Usage: node scripts/seedAutoApplyTestUser.js <email> [--submit-only]"
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
  console.log("User:", { email, userId, submitOnly });

  let resolved = [];
  let daycareIds = [];

  if (!submitOnly) {
    console.log("\n=== STEP 1: CLEANUP ===");
    const cleaned = await cleanupUser(userId);
    console.log("Deleted:", cleaned);
  } else {
    console.log("\n=== STEP 1: SKIPPED (--submit-only) ===");
  }

  console.log("\n=== STEP 2: RESOLVE TEST DAYCARES ===");
  for (const spec of TEST_DAYCARES) {
    const daycare = await findDaycare(spec);
    if (!daycare?._id) {
      console.error("Daycare not found:", spec);
      await mongoose.disconnect();
      process.exit(3);
    }
    resolved.push(daycare);
    console.log(`✅ ${daycare.name}`);
    console.log(`   id: ${daycare._id}`);
    console.log(`   city: ${daycare.city} | region: ${daycare.region}`);
  }
  daycareIds = resolved.map((d) => String(d._id));

  if (!submitOnly) {
    console.log("\n=== STEP 3: SEED PURCHASE + CREDITS ===");
    const paymentIntentId = `seed_test_${Date.now()}`;

    const controller = new ApplicationController({});
    const grantRes = await controller.grantAutoApplyCredits(userId, {
      credits: 30,
      paymentReference: paymentIntentId,
      note: "seedAutoApplyTestUser.js",
    });

    if (!grantRes.body?.success) {
      console.error("Failed to grant credits:", grantRes.body);
      await mongoose.disconnect();
      process.exit(4);
    }

    await Purchase.create({
      userId,
      amount: 29.99,
      currency: "CAD",
      status: "completed",
      paymentMethod: "card",
      stripePaymentId: paymentIntentId,
      paymentIntentId,
      paymentType: "auto_apply_credits",
      daycareIds,
      creditsGranted: 30,
      processedAt: new Date(),
      description: "Seeded auto-apply credits for 3-step form testing",
    });

    const wallet = await AutoApplyCredit.findOne({ userId }).lean();
    console.log("Purchase created:", paymentIntentId);
    console.log("Wallet:", {
      totalCredits: wallet?.totalCredits ?? 0,
      usedCredits: wallet?.usedCredits ?? 0,
      remainingCredits: wallet?.remainingCredits ?? 0,
    });
  } else {
    const wallet = await AutoApplyCredit.findOne({ userId }).lean();
    console.log("\n=== STEP 3: SKIPPED (using existing wallet) ===");
    console.log("Wallet:", {
      totalCredits: wallet?.totalCredits ?? 0,
      usedCredits: wallet?.usedCredits ?? 0,
      remainingCredits: wallet?.remainingCredits ?? 0,
    });
    if ((wallet?.remainingCredits ?? 0) < daycareIds.length) {
      console.error(
        `Need at least ${daycareIds.length} remaining credits to submit ${daycareIds.length} daycares.`
      );
      await mongoose.disconnect();
      process.exit(5);
    }
  }

  const ok = await submitAutoApplyForDaycares(userId, email, daycareIds, resolved);
  if (!ok) {
    await mongoose.disconnect();
    process.exit(6);
  }

  console.log("\n=== VERIFY ===");
  console.log(`node scripts/inspectUserData.js ${email}`);
  console.log(`node scripts/checkDaycaresBoughtByEmail.js ${email}`);

  await mongoose.disconnect();
  console.log("\nDone.\n");
}

main().catch(async (err) => {
  console.error("seedAutoApplyTestUser failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
