const mongoose = require("mongoose");

/**
 * Standalone enrollment form document (queue / reference schema).
 * Independent of enrollmentsubmissions — same shape as n8n full payload.
 * Collection: enrollment_form_queue
 */

const formMetadataSchema = new mongoose.Schema(
  {
    form_id: { type: String, default: "", trim: true },
    service_name: { type: String, default: "", trim: true },
    form_url: { type: String, default: "", trim: true },
    submission_date: { type: String, default: null, trim: true },
    preferred_language: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const childSchema = new mongoose.Schema(
  {
    first_name: { type: String, default: "", trim: true },
    middle_name: { type: String, default: "", trim: true },
    last_name: { type: String, default: "", trim: true },
    date_of_birth: { type: String, default: "", trim: true },
    gender: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    province: { type: String, default: "", trim: true },
    postal_code: { type: String, default: "", trim: true },
    country: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const employmentSchema = new mongoose.Schema(
  {
    employment_status: { type: String, default: "", trim: true },
    employer_name: { type: String, default: "", trim: true },
    job_title: { type: String, default: "", trim: true },
    work_hours: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const parentSchema = new mongoose.Schema(
  {
    first_name: { type: String, default: "", trim: true },
    last_name: { type: String, default: "", trim: true },
    relationship: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, default: "", trim: true },
    phone_type: { type: String, default: "", trim: true },
    address: { type: addressSchema, default: () => ({}) },
    employment: { type: employmentSchema, default: () => ({}) },
  },
  { _id: false }
);

const enrollmentDetailsSchema = new mongoose.Schema(
  {
    program_type: { type: String, default: "", trim: true },
    start_date: { type: String, default: "", trim: true },
    schedule_type: { type: String, default: "", trim: true },
    days_required: { type: [String], default: [] },
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    relationship: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    authorized_pickup: { type: Boolean, default: false },
  },
  { _id: false }
);

const foodAllergySchema = new mongoose.Schema(
  {
    allergen: { type: String, default: "", trim: true },
    severity: { type: String, default: "", trim: true },
    reaction: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const healthAndWellnessSchema = new mongoose.Schema(
  {
    dietary_restrictions: { type: [String], default: [] },
    food_allergies: { type: [foodAllergySchema], default: [] },
    photo_consent: { type: Boolean, default: false },
    emergency_medical_treatment: { type: Boolean, default: false },
  },
  { _id: false }
);

const educationalPreferencesSchema = new mongoose.Schema(
  {
    curriculum_type: { type: String, default: "", trim: true },
    language_of_instruction: { type: [String], default: [] },
    special_programs: { type: [String], default: [] },
    parent_participation: { type: Boolean, default: false },
  },
  { _id: false }
);

const otherChildSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    date_of_birth: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const householdInformationSchema = new mongoose.Schema(
  {
    household_size: { type: Number, default: null },
    other_children: { type: [otherChildSchema], default: [] },
    family_structure: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const additionalInformationSchema = new mongoose.Schema(
  {
    how_heard_about_us: { type: String, default: "", trim: true },
    referral_name: { type: String, default: "", trim: true },
    additional_notes: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const consentAndDeclarationsSchema = new mongoose.Schema(
  {
    parent_declaration: { type: Boolean, default: false },
    privacy_policy: { type: Boolean, default: false },
    photo_release: { type: Boolean, default: false },
    terms_and_conditions: { type: Boolean, default: false },
  },
  { _id: false }
);

const enrollmentFormQueueSchema = new mongoose.Schema(
  {
    form_metadata: {
      type: formMetadataSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      default: "draft",
      trim: true,
      index: true,
    },
    child: {
      type: childSchema,
      default: () => ({}),
    },
    primary_parent: {
      type: parentSchema,
      default: () => ({}),
    },
    secondary_parent: {
      type: parentSchema,
      default: null,
    },
    enrollment: {
      type: enrollmentDetailsSchema,
      default: () => ({}),
    },
    additional_emergency_contacts: {
      type: [emergencyContactSchema],
      default: [],
    },
    health_and_wellness: {
      type: healthAndWellnessSchema,
      default: () => ({}),
    },
    educational_preferences: {
      type: educationalPreferencesSchema,
      default: () => ({}),
    },
    household_information: {
      type: householdInformationSchema,
      default: () => ({}),
    },
    additional_information: {
      type: additionalInformationSchema,
      default: () => ({}),
    },
    consent_and_declarations: {
      type: consentAndDeclarationsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: "enrollment_form_queue",
  }
);

enrollmentFormQueueSchema.index({ status: 1, createdAt: -1 });
enrollmentFormQueueSchema.index({ "primary_parent.email": 1 });
enrollmentFormQueueSchema.index({ "form_metadata.form_id": 1 });

let EnrollmentFormQueue;
try {
  EnrollmentFormQueue = mongoose.model("EnrollmentFormQueue");
} catch (error) {
  EnrollmentFormQueue = mongoose.model(
    "EnrollmentFormQueue",
    enrollmentFormQueueSchema
  );
}

module.exports = EnrollmentFormQueue;
