const mongoose = require("mongoose");

/**
 * Standalone enrollment form document (queue / reference schema).
 * Independent of enrollmentsubmissions — same shape as n8n full payload.
 * Collection: enrollment_form_queue
 *
 * No required fields. Defaults: null (scalars / objects), [] (arrays).
 */

const nullableString = {
  type: String,
  default: null,
  trim: true,
  required: false,
};

const nullableBoolean = {
  type: Boolean,
  default: null,
  required: false,
};

const formMetadataSchema = new mongoose.Schema(
  {
    form_id: nullableString,
    service_name: nullableString,
    form_url: nullableString,
    submission_date: nullableString,
    preferred_language: nullableString,
  },
  { _id: false }
);

const childSchema = new mongoose.Schema(
  {
    first_name: nullableString,
    middle_name: nullableString,
    last_name: nullableString,
    date_of_birth: nullableString,
    gender: nullableString,
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    street: nullableString,
    city: nullableString,
    province: nullableString,
    postal_code: nullableString,
    country: nullableString,
  },
  { _id: false }
);

const employmentSchema = new mongoose.Schema(
  {
    employment_status: nullableString,
    employer_name: nullableString,
    job_title: nullableString,
    work_hours: nullableString,
  },
  { _id: false }
);

const parentSchema = new mongoose.Schema(
  {
    first_name: nullableString,
    last_name: nullableString,
    relationship: nullableString,
    email: { ...nullableString, lowercase: true },
    phone: nullableString,
    phone_type: nullableString,
    address: { type: addressSchema, default: null, required: false },
    employment: { type: employmentSchema, default: null, required: false },
  },
  { _id: false }
);

const enrollmentDetailsSchema = new mongoose.Schema(
  {
    program_type: nullableString,
    start_date: nullableString,
    schedule_type: nullableString,
    days_required: { type: [String], default: [], required: false },
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: nullableString,
    relationship: nullableString,
    phone: nullableString,
    authorized_pickup: nullableBoolean,
  },
  { _id: false }
);

const foodAllergySchema = new mongoose.Schema(
  {
    allergen: nullableString,
    severity: nullableString,
    reaction: nullableString,
  },
  { _id: false }
);

const healthAndWellnessSchema = new mongoose.Schema(
  {
    dietary_restrictions: { type: [String], default: [], required: false },
    food_allergies: { type: [foodAllergySchema], default: [], required: false },
    photo_consent: nullableBoolean,
    emergency_medical_treatment: nullableBoolean,
  },
  { _id: false }
);

const educationalPreferencesSchema = new mongoose.Schema(
  {
    curriculum_type: nullableString,
    language_of_instruction: { type: [String], default: [], required: false },
    special_programs: { type: [String], default: [], required: false },
    parent_participation: nullableBoolean,
  },
  { _id: false }
);

const otherChildSchema = new mongoose.Schema(
  {
    name: nullableString,
    date_of_birth: nullableString,
  },
  { _id: false }
);

const householdInformationSchema = new mongoose.Schema(
  {
    household_size: { type: Number, default: null, required: false },
    other_children: { type: [otherChildSchema], default: [], required: false },
    family_structure: nullableString,
  },
  { _id: false }
);

const additionalInformationSchema = new mongoose.Schema(
  {
    how_heard_about_us: nullableString,
    referral_name: nullableString,
    additional_notes: nullableString,
  },
  { _id: false }
);

const consentAndDeclarationsSchema = new mongoose.Schema(
  {
    parent_declaration: nullableBoolean,
    privacy_policy: nullableBoolean,
    photo_release: nullableBoolean,
    terms_and_conditions: nullableBoolean,
  },
  { _id: false }
);

const enrollmentFormQueueSchema = new mongoose.Schema(
  {
    form_metadata: {
      type: formMetadataSchema,
      default: null,
      required: false,
    },
    status: {
      type: String,
      default: null,
      trim: true,
      required: false,
      index: true,
    },
    child: {
      type: childSchema,
      default: null,
      required: false,
    },
    primary_parent: {
      type: parentSchema,
      default: null,
      required: false,
    },
    secondary_parent: {
      type: parentSchema,
      default: null,
      required: false,
    },
    enrollment: {
      type: enrollmentDetailsSchema,
      default: null,
      required: false,
    },
    additional_emergency_contacts: {
      type: [emergencyContactSchema],
      default: [],
      required: false,
    },
    health_and_wellness: {
      type: healthAndWellnessSchema,
      default: null,
      required: false,
    },
    educational_preferences: {
      type: educationalPreferencesSchema,
      default: null,
      required: false,
    },
    household_information: {
      type: householdInformationSchema,
      default: null,
      required: false,
    },
    additional_information: {
      type: additionalInformationSchema,
      default: null,
      required: false,
    },
    consent_and_declarations: {
      type: consentAndDeclarationsSchema,
      default: null,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: "enrollment_form_queue",
    minimize: false,
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
