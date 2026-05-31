/**
 * n8n enrollment payload helpers (schema version 20260521_v1)
 */

const SCHEMA_VERSION = "20260521_v1";

function splitFullName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return { first_name: "", middle_name: "", last_name: "" };
  }
  if (parts.length === 1) {
    return { first_name: parts[0], middle_name: "", last_name: "" };
  }
  if (parts.length === 2) {
    return { first_name: parts[0], middle_name: "", last_name: parts[1] };
  }
  return {
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(" "),
    last_name: parts[parts.length - 1],
  };
}

function formatDateOnly(dateValue) {
  if (!dateValue) return "";
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daycareIdString(daycare) {
  if (!daycare) return "";
  const raw = daycare._id ?? daycare.id;
  if (raw == null) return "";
  return typeof raw === "string" ? raw.trim() : String(raw);
}

function buildFormMetadata(daycare) {
  const form = daycare?.enrollmentForm || {};
  const formsLink = String(daycare?.formsLink || "").trim();
  const formUrl =
    String(form.formUrl || "").trim() ||
    (formsLink && formsLink !== "NO" ? formsLink : "");
  const serviceName =
    String(form.serviceName || "").trim() ||
    String(daycare?.name || "").trim();
  const formId =
    String(form.formId || "").trim() ||
    (daycare?._id ? `form_${String(daycare._id)}` : "");
  const region = String(daycare?.region || "").trim();
  const city = String(daycare?.city || "").trim();
  const daycareName = String(daycare?.name || "").trim();

  return {
    form_id: formId,
    service_name: serviceName,
    form_url: formUrl,
    submission_date: null,
    preferred_language: "",
    daycare_id: daycareIdString(daycare),
    daycare_name: daycareName,
    city,
    region,
  };
}

/** Keep parent-entered metadata; always refresh daycare location fields from master. */
function mergeFormMetadataFromDaycare(daycare, existing = {}) {
  const base = buildFormMetadata(daycare);
  const prev =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? existing
      : {};

  return {
    ...prev,
    ...base,
    submission_date:
      prev.submission_date != null && String(prev.submission_date).trim()
        ? prev.submission_date
        : base.submission_date,
    preferred_language:
      prev.preferred_language != null && String(prev.preferred_language).trim()
        ? String(prev.preferred_language).trim()
        : base.preferred_language,
  };
}

function createEmptyPayload(formMetadata) {
  return {
    form_metadata: formMetadata,
    status: "draft",
    child: {
      first_name: "",
      middle_name: "",
      last_name: "",
      date_of_birth: "",
      gender: "",
    },
    primary_parent: {
      first_name: "",
      last_name: "",
      relationship: "",
      email: "",
      phone: "",
      phone_type: "",
      address: {
        street: "",
        city: "",
        province: "",
        postal_code: "",
        country: "",
      },
      employment: {
        employment_status: "",
        employer_name: "",
        job_title: "",
        work_hours: "",
      },
    },
    secondary_parent: null,
    enrollment: {
      program_type: "",
      start_date: "",
      schedule_type: "",
      days_required: [],
    },
    additional_emergency_contacts: [],
    health_and_wellness: {
      dietary_restrictions: [],
      food_allergies: [],
      photo_consent: false,
      emergency_medical_treatment: false,
    },
    educational_preferences: {
      curriculum_type: "",
      language_of_instruction: [],
      special_programs: [],
      parent_participation: false,
    },
    household_information: {
      household_size: null,
      other_children: [],
      family_structure: "",
    },
    additional_information: {
      how_heard_about_us: "",
      referral_name: "",
      additional_notes: "",
    },
    consent_and_declarations: {
      parent_declaration: false,
      privacy_policy: false,
      photo_release: false,
      terms_and_conditions: false,
    },
  };
}

function prefillPayloadFromApplication(application, daycare) {
  const formMetadata = buildFormMetadata(daycare);
  const payload = createEmptyPayload(formMetadata);

  const childNames = splitFullName(application?.childName);
  payload.child.first_name = childNames.first_name;
  payload.child.middle_name = childNames.middle_name;
  payload.child.last_name = childNames.last_name;
  payload.child.date_of_birth = formatDateOnly(application?.childDob);

  const parentNames = splitFullName(application?.parentName);
  payload.primary_parent.first_name = parentNames.first_name;
  payload.primary_parent.last_name =
    parentNames.last_name ||
    [parentNames.middle_name, parentNames.last_name].filter(Boolean).join(" ");
  payload.primary_parent.email = String(application?.parentEmail || "").trim();
  payload.primary_parent.phone = String(application?.parentPhone || "").trim();

  payload.enrollment.start_date = formatDateOnly(
    application?.preferredStartDate || application?.startDate
  );
  payload.additional_information.additional_notes = String(
    application?.specialNotes || application?.additionalNotes || ""
  ).trim();

  // Parent address comes only from enrollment form / checkout optional fields — never daycare location.

  return payload;
}

function deepMerge(target, source) {
  if (!source || typeof source !== "object") return target;
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value === undefined) continue;
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof out[key] === "object" &&
      out[key] !== null &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function validatePayload(payload) {
  const missingFields = [];
  const add = (path, ok) => {
    if (!ok) missingFields.push(path);
  };

  const child = payload?.child || {};
  add("child.first_name", isNonEmptyString(child.first_name));
  add("child.last_name", isNonEmptyString(child.last_name));
  add("child.date_of_birth", isNonEmptyString(child.date_of_birth));

  const pp = payload?.primary_parent || {};
  add("primary_parent.first_name", isNonEmptyString(pp.first_name));
  add("primary_parent.last_name", isNonEmptyString(pp.last_name));
  add("primary_parent.email", isNonEmptyString(pp.email));
  add("primary_parent.phone", isNonEmptyString(pp.phone));
  const addr = pp.address || {};
  add("primary_parent.address.street", isNonEmptyString(addr.street));
  add("primary_parent.address.city", isNonEmptyString(addr.city));
  add("primary_parent.address.province", isNonEmptyString(addr.province));
  add("primary_parent.address.postal_code", isNonEmptyString(addr.postal_code));

  const en = payload?.enrollment || {};
  add("enrollment.program_type", isNonEmptyString(en.program_type));
  add("enrollment.start_date", isNonEmptyString(en.start_date));
  add("enrollment.schedule_type", isNonEmptyString(en.schedule_type));

  const consents = payload?.consent_and_declarations || {};
  add(
    "consent_and_declarations.parent_declaration",
    consents.parent_declaration === true
  );
  add("consent_and_declarations.privacy_policy", consents.privacy_policy === true);
  add(
    "consent_and_declarations.terms_and_conditions",
    consents.terms_and_conditions === true
  );

  const formUrl = payload?.form_metadata?.form_url;
  add("form_metadata.form_url", isNonEmptyString(formUrl));

  const valid = missingFields.length === 0;
  return {
    valid,
    missingFields,
    completionStatus: valid ? "complete" : missingFields.length < 8 ? "in_progress" : "in_progress",
  };
}

function deriveCompletionStatus(payload) {
  const { valid, missingFields } = validatePayload(payload);
  if (valid) return "complete";
  const hasAny =
    isNonEmptyString(payload?.child?.first_name) ||
    isNonEmptyString(payload?.primary_parent?.email);
  if (!hasAny) return "not_started";
  return "in_progress";
}

/**
 * Normalize daycare lookup text (name, city, or region name).
 * Region is a full name (e.g. "York Region", "Toronto") — not a province code like "ON".
 */
function normalizeLookupText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeRegion(region) {
  return normalizeLookupText(region);
}

/** Reject common mistake: using province code instead of region name for resolve API */
function looksLikeProvinceCode(region) {
  const t = String(region || "").trim();
  return /^[A-Za-z]{2}$/.test(t);
}

module.exports = {
  SCHEMA_VERSION,
  splitFullName,
  buildFormMetadata,
  mergeFormMetadataFromDaycare,
  createEmptyPayload,
  prefillPayloadFromApplication,
  deepMerge,
  validatePayload,
  deriveCompletionStatus,
  normalizeRegion,
  normalizeLookupText,
  looksLikeProvinceCode,
};
