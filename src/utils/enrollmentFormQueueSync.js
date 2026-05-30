const EnrollmentSubmission = require("../schemas/EnrollmentSubmissionSchema");
const EnrollmentFormQueue = require("../schemas/EnrollmentFormQueueSchema");

const QUEUE_ROOT_KEYS = [
  "form_metadata",
  "status",
  "child",
  "primary_parent",
  "secondary_parent",
  "enrollment",
  "additional_emergency_contacts",
  "health_and_wellness",
  "educational_preferences",
  "household_information",
  "additional_information",
  "consent_and_declarations",
];

function queueStatusFromSubmission(payload, automationStatus) {
  if (payload && typeof payload.status === "string" && payload.status.trim()) {
    return payload.status.trim();
  }
  switch (String(automationStatus || "").toLowerCase()) {
    case "submitted":
      return "submitted";
    case "failed":
      return "failed";
    case "queued":
    case "running":
      return "pending_automation";
    default:
      return "draft";
  }
}

/**
 * Map enrollmentsubmissions.payload → enrollment_form_queue document (root fields).
 */
function payloadToQueueDocument(payload, automationStatus) {
  const src =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : {};
  const out = {};

  for (const key of QUEUE_ROOT_KEYS) {
    if (key === "status") continue;
    if (src[key] !== undefined) {
      out[key] = src[key];
    }
  }

  out.status = queueStatusFromSubmission(src, automationStatus);
  return out;
}

/**
 * Upsert enrollment_form_queue from a submission; set enrollmentFormQueueId when new.
 * @returns {Promise<string|null>} queue document id
 */
async function syncEnrollmentToFormQueue(submission) {
  if (!submission) return null;

  let doc = submission;
  const submissionId = String(submission._id || "").trim();
  if (!submissionId) return null;

  if (typeof submission.payload === "undefined" && submissionId) {
    doc = await EnrollmentSubmission.findById(submissionId);
    if (!doc) return null;
  }

  const queueBody = payloadToQueueDocument(doc.payload, doc.automationStatus);
  let queueId = doc.enrollmentFormQueueId
    ? String(doc.enrollmentFormQueueId).trim()
    : "";

  if (queueId) {
    const updated = await EnrollmentFormQueue.findByIdAndUpdate(
      queueId,
      { $set: queueBody },
      { new: true, runValidators: false }
    );
    if (!updated) {
      queueId = "";
    }
  }

  if (!queueId) {
    const created = await EnrollmentFormQueue.create(queueBody);
    queueId = created._id.toString();
    await EnrollmentSubmission.findByIdAndUpdate(submissionId, {
      enrollmentFormQueueId: queueId,
    });
    if (typeof doc.set === "function") {
      doc.enrollmentFormQueueId = queueId;
    } else {
      doc.enrollmentFormQueueId = queueId;
    }
  }

  return queueId;
}

/**
 * Map queue row → enrollmentsubmissions.payload shape (for parent UI / API).
 */
function queueDocumentToPayload(queueDoc) {
  if (!queueDoc || typeof queueDoc !== "object") return null;
  const out = {};
  for (const key of QUEUE_ROOT_KEYS) {
    if (queueDoc[key] !== undefined) {
      out[key] = queueDoc[key];
    }
  }
  return out;
}

/** Dashboard / badges: prefer queue.status when n8n updated the queue row. */
function automationStatusFromQueueStatus(queueStatus) {
  const s = String(queueStatus || "").trim().toLowerCase();
  if (s === "submitted") return "submitted";
  if (s === "failed") return "failed";
  if (s === "pending_automation") return "queued";
  return null;
}

function childDisplayNameFromPayload(payload) {
  const c = payload?.child;
  if (!c || typeof c !== "object") return "";
  return [c.first_name, c.middle_name, c.last_name]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(" ");
}

async function loadQueueById(queueId) {
  const id = String(queueId || "").trim();
  if (!id) return null;
  return EnrollmentFormQueue.findById(id).lean();
}

async function loadQueuesByIds(queueIds) {
  const ids = [...new Set(queueIds.map((x) => String(x || "").trim()).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = await EnrollmentFormQueue.find({ _id: { $in: ids } }).lean();
  const map = new Map();
  for (const row of rows) {
    map.set(String(row._id), row);
  }
  return map;
}

module.exports = {
  QUEUE_ROOT_KEYS,
  payloadToQueueDocument,
  queueDocumentToPayload,
  queueStatusFromSubmission,
  automationStatusFromQueueStatus,
  childDisplayNameFromPayload,
  loadQueueById,
  loadQueuesByIds,
  syncEnrollmentToFormQueue,
};
