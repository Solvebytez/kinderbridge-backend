/* eslint-disable no-console */
/**
 * Insert mock document into enrollment_form_queue.
 *
 * Usage (from backend folder):
 *   node scripts/seedEnrollmentFormQueue.js
 *   node scripts/seedEnrollmentFormQueue.js --force   # delete prior mock by email, re-insert
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

const EnrollmentFormQueue = require("../src/schemas/EnrollmentFormQueueSchema");

const MOCK_EMAIL = "wei.chen@gmail.com";

const MOCK_DOCUMENT = {
  form_metadata: {
    form_id: "form_20260521_001",
    service_name: "Advanced Kids Daycare",
    form_url: "https://advancedkidsdaycare.com/register",
    submission_date: "2026-05-21T10:30:00Z",
    preferred_language: "English",
  },
  status: "submitted",
  child: {
    first_name: "Liam",
    middle_name: "Alexander",
    last_name: "Chen",
    date_of_birth: "2022-05-15",
    gender: "Male",
  },
  primary_parent: {
    first_name: "Wei",
    last_name: "Chen",
    relationship: "Father",
    email: MOCK_EMAIL,
    phone: "416-555-0123",
    phone_type: "Mobile",
    address: {
      street: "456 Yonge Street",
      city: "Toronto",
      province: "ON",
      postal_code: "M4Y 1W9",
      country: "Canada",
    },
    employment: {
      employment_status: "Employed Full-time",
      employer_name: "Tech Innovations Inc.",
      job_title: "Senior Software Engineer",
      work_hours: "9:00 AM - 5:00 PM",
    },
  },
  secondary_parent: {
    first_name: "Mei",
    last_name: "Chen",
    relationship: "Mother",
    email: "mei.chen@yahoo.com",
    phone: "416-555-0789",
    phone_type: "Mobile",
    address: {
      street: "456 Yonge Street",
      city: "Toronto",
      province: "ON",
      postal_code: "M4Y 1W9",
      country: "Canada",
    },
    employment: {
      employment_status: "Employed Full-time",
      employer_name: "Global Consulting Group",
      job_title: "Project Manager",
      work_hours: "8:30 AM - 4:30 PM",
    },
  },
  enrollment: {
    program_type: "Preschool (2-5 years)",
    start_date: "2026-07-01",
    schedule_type: "Full Time (5 days)",
    days_required: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ],
  },
  additional_emergency_contacts: [
    {
      name: "Linda Chen",
      relationship: "Grandparent",
      phone: "416-555-9999",
      authorized_pickup: true,
    },
    {
      name: "John Smith",
      relationship: "Family Friend",
      phone: "416-555-8888",
      authorized_pickup: true,
    },
  ],
  health_and_wellness: {
    dietary_restrictions: ["Vegetarian"],
    food_allergies: [
      {
        allergen: "Peanuts",
        severity: "Severe (Anaphylaxis)",
        reaction: "Facial swelling, difficulty breathing",
      },
      {
        allergen: "Tree Nuts",
        severity: "Moderate",
        reaction: "Hives, itching",
      },
    ],
    photo_consent: true,
    emergency_medical_treatment: true,
  },
  educational_preferences: {
    curriculum_type: "Reggio Emilia",
    language_of_instruction: ["English", "Mandarin"],
    special_programs: ["Music", "Art", "Outdoor Learning"],
    parent_participation: true,
  },
  household_information: {
    household_size: 3,
    other_children: [
      {
        name: "Sophie Chen",
        date_of_birth: "2020-03-10",
      },
    ],
    family_structure: "Two-parent household",
  },
  additional_information: {
    how_heard_about_us: "Friend/Family Referral",
    referral_name: "Sarah Johnson",
    additional_notes:
      "Liam is bilingual (English/Mandarin). Prefers center with Mandarin instruction.",
  },
  consent_and_declarations: {
    parent_declaration: true,
    privacy_policy: true,
    photo_release: true,
    terms_and_conditions: true,
  },
};

async function main() {
  const force = process.argv.includes("--force");

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in backend/.env");
    process.exit(1);
  }

  const dbName = process.env.DB_NAME || "daycare_concierge";
  await mongoose.connect(uri.replace(/[<>]/g, ""), { dbName });
  console.log("Connected:", dbName);

  if (force) {
    const removed = await EnrollmentFormQueue.deleteMany({
      "primary_parent.email": MOCK_EMAIL,
      "form_metadata.form_id": MOCK_DOCUMENT.form_metadata.form_id,
    });
    console.log("Removed existing mock rows:", removed.deletedCount);
  } else {
    const existing = await EnrollmentFormQueue.findOne({
      "primary_parent.email": MOCK_EMAIL,
      "form_metadata.form_id": MOCK_DOCUMENT.form_metadata.form_id,
    }).lean();
    if (existing) {
      console.log("Mock already exists (_id):", existing._id);
      console.log("Re-run with --force to replace.");
      await mongoose.disconnect();
      return;
    }
  }

  const doc = await EnrollmentFormQueue.create(MOCK_DOCUMENT);
  console.log("Inserted enrollment_form_queue document:");
  console.log("  _id:", doc._id.toString());
  console.log("  collection: enrollment_form_queue");
  console.log("  status:", doc.status);
  console.log("  child:", `${doc.child.first_name} ${doc.child.last_name}`);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error("seedEnrollmentFormQueue failed:", e);
  process.exit(1);
});
