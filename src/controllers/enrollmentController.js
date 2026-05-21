const EnrollmentSubmission = require("../schemas/EnrollmentSubmissionSchema");
const {
  successResponse,
  errorResponse,
  notFoundResponse,
  internalErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} = require("../utils/responseHelper");
const {
  SCHEMA_VERSION,
  prefillPayloadFromApplication,
  deepMerge,
  validatePayload,
  deriveCompletionStatus,
  normalizeLookupText,
  normalizeRegion,
  looksLikeProvinceCode,
} = require("../utils/enrollmentPayload");

function getDaycareModel() {
  const mongoose = require("mongoose");
  try {
    return mongoose.model("Daycare");
  } catch {
    require("../schemas/DaycareSchema");
    return mongoose.model("Daycare");
  }
}

function toPublicEnrollment(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    _id: o._id?.toString?.() || o._id,
    applicationId: o.applicationId,
    userId: o.userId,
    daycareId: o.daycareId,
    schemaVersion: o.schemaVersion,
    payload: o.payload,
    completionStatus: o.completionStatus,
    automationStatus: o.automationStatus,
    n8n: o.n8n || {},
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

class EnrollmentController {
  constructor(db) {
    this.db = db;
  }

  async findDaycareById(daycareId) {
    const Daycare = getDaycareModel();
    const mongoose = require("mongoose");
    const id = String(daycareId || "").trim();
    if (!id) return null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      const byOid = await Daycare.findById(id).lean();
      if (byOid) return byOid;
    }
    return Daycare.findOne({ id }).lean();
  }

  async resolveDaycareByNameCityRegion({ name, city, region }) {
    const Daycare = getDaycareModel();
    const nName = normalizeLookupText(name);
    const nCity = normalizeLookupText(city);
    const nRegion = normalizeRegion(region);

    if (!nName || !nCity || !nRegion) {
      return errorResponse(
        "name, city, and region are required (region = geographic region name, not province code)",
        400
      );
    }

    if (looksLikeProvinceCode(region)) {
      return errorResponse(
        'region must be a region name (e.g. "Toronto", "York Region"), not a province code like "ON"',
        400
      );
    }

    const candidates = await Daycare.find({
      city: new RegExp(`^${String(city).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    })
      .limit(50)
      .lean();

    const matches = candidates.filter((d) => {
      const dn = normalizeLookupText(d.name);
      const dc = normalizeLookupText(d.city);
      const dr = normalizeRegion(d.region);
      return dn === nName && dc === nCity && dr === nRegion;
    });

    if (matches.length === 0) {
      return notFoundResponse("No daycare matched name, city, and region");
    }
    if (matches.length > 1) {
      return errorResponse(
        "Multiple daycares matched name, city, and region",
        409,
        matches.map((m) => ({
          daycareId: m._id?.toString(),
          name: m.name,
          city: m.city,
          region: m.region,
        }))
      );
    }

    const daycare = matches[0];
    const daycareId = daycare._id?.toString();
    const { buildFormMetadata } = require("../utils/enrollmentPayload");

    return successResponse({
      daycareId,
      name: daycare.name,
      city: daycare.city,
      region: daycare.region,
      form_metadata: buildFormMetadata(daycare),
    });
  }

  async ensureDraftForApplication(userId, application) {
    const applicationId = String(application._id || application.id || "").trim();
    const daycareId = String(application.daycareId || "").trim();
    if (!applicationId || !daycareId) return null;

    const existing = await EnrollmentSubmission.findOne({ applicationId }).lean();
    if (existing) return existing;

    const daycare = await this.findDaycareById(daycareId);
    const payload = prefillPayloadFromApplication(application, daycare);
    const completionStatus = deriveCompletionStatus(payload);

    const created = await EnrollmentSubmission.create({
      applicationId,
      userId: String(userId),
      daycareId,
      schemaVersion: SCHEMA_VERSION,
      payload,
      completionStatus,
      automationStatus: "not_ready",
    });

    return created.toObject();
  }

  async getByApplicationId(userId, applicationId) {
    const doc = await EnrollmentSubmission.findOne({
      applicationId: String(applicationId).trim(),
      userId: String(userId),
    }).lean();

    if (!doc) {
      return notFoundResponse("Enrollment submission not found");
    }
    return successResponse(toPublicEnrollment(doc));
  }

  async listMine(userId) {
    const docs = await EnrollmentSubmission.find({ userId: String(userId) })
      .sort({ updatedAt: -1 })
      .lean();
    return successResponse(docs.map(toPublicEnrollment));
  }

  async patchPayload(userId, enrollmentId, partialPayload) {
    const doc = await EnrollmentSubmission.findById(enrollmentId);
    if (!doc) return notFoundResponse("Enrollment submission not found");
    if (doc.userId !== String(userId)) return forbiddenResponse();

    if (doc.automationStatus === "submitted") {
      return errorResponse(
        "Enrollment was already submitted to the daycare. Contact support to amend.",
        400
      );
    }

    doc.payload = deepMerge(doc.payload || {}, partialPayload || {});
    doc.completionStatus = deriveCompletionStatus(doc.payload);
    if (doc.completionStatus !== "complete") {
      doc.automationStatus =
        doc.automationStatus === "queued" ? "not_ready" : doc.automationStatus;
      if (doc.payload && typeof doc.payload === "object") {
        doc.payload.status = "draft";
      }
    }
    doc.schemaVersion = SCHEMA_VERSION;
    await doc.save();

    return successResponse(toPublicEnrollment(doc));
  }

  async validate(userId, enrollmentId) {
    const doc = await EnrollmentSubmission.findById(enrollmentId).lean();
    if (!doc) return notFoundResponse("Enrollment submission not found");
    if (doc.userId !== String(userId)) return forbiddenResponse();

    const result = validatePayload(doc.payload);
    return successResponse({
      valid: result.valid,
      missingFields: result.missingFields,
      completionStatus: deriveCompletionStatus(doc.payload),
    });
  }

  async queueAutomation(userId, enrollmentId) {
    const doc = await EnrollmentSubmission.findById(enrollmentId);
    if (!doc) return notFoundResponse("Enrollment submission not found");
    if (doc.userId !== String(userId)) return forbiddenResponse();

    if (doc.automationStatus === "submitted") {
      return errorResponse("Already submitted to daycare", 400);
    }
    if (doc.automationStatus === "queued" || doc.automationStatus === "running") {
      return successResponse(
        toPublicEnrollment(doc),
        "Automation already queued"
      );
    }

    const validation = validatePayload(doc.payload);
    if (!validation.valid) {
      return errorResponse("Enrollment is incomplete", 400, [
        { missingFields: validation.missingFields },
      ]);
    }

    doc.completionStatus = "complete";
    doc.automationStatus = "queued";
    doc.n8n = doc.n8n || {};
    doc.n8n.queuedAt = new Date();
    doc.n8n.lastError = null;
    if (doc.payload && typeof doc.payload === "object") {
      doc.payload.status = "pending_automation";
    }
    await doc.save();

    await this.notifyN8nWebhook(doc);

    return successResponse(
      toPublicEnrollment(doc),
      "Queued for daycare form automation"
    );
  }

  async notifyN8nWebhook(doc) {
    const url = process.env.N8N_ENROLLMENT_WEBHOOK_URL;
    if (!url || !String(url).trim()) {
      console.warn(
        "N8N_ENROLLMENT_WEBHOOK_URL not set; enrollment queued in DB only:",
        doc._id?.toString()
      );
      return;
    }

    try {
      const body = {
        enrollmentId: doc._id?.toString(),
        applicationId: doc.applicationId,
        userId: doc.userId,
        daycareId: doc.daycareId,
        payload: doc.payload,
      };
      const headers = { "Content-Type": "application/json" };
      if (process.env.N8N_API_KEY) {
        headers["X-N8N-API-Key"] = process.env.N8N_API_KEY;
      }
      const res = await fetch(String(url).trim(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("n8n webhook failed:", res.status, text);
      }
    } catch (err) {
      console.error("n8n webhook error:", err);
    }
  }

  async n8nGetPayload(enrollmentId) {
    const doc = await EnrollmentSubmission.findById(enrollmentId).lean();
    if (!doc) return notFoundResponse("Enrollment submission not found");
    return successResponse(toPublicEnrollment(doc));
  }

  async n8nCallback(body) {
    const enrollmentId = String(body?.enrollmentId || "").trim();
    const status = String(body?.status || "").trim().toLowerCase();
    const submissionDate = body?.submission_date || body?.submissionDate || null;
    const errorMessage =
      typeof body?.error === "string" ? body.error.trim() : null;

    if (!enrollmentId) {
      return errorResponse("enrollmentId is required", 400);
    }

    const doc = await EnrollmentSubmission.findById(enrollmentId);
    if (!doc) return notFoundResponse("Enrollment submission not found");

    doc.n8n = doc.n8n || {};
    doc.n8n.lastRunAt = new Date();

    if (status === "submitted" || status === "success" || status === "succeeded") {
      doc.automationStatus = "submitted";
      doc.n8n.lastError = null;
      if (doc.payload && typeof doc.payload === "object") {
        doc.payload.status = "submitted";
        if (!doc.payload.form_metadata) doc.payload.form_metadata = {};
        doc.payload.form_metadata.submission_date =
          submissionDate || new Date().toISOString();
      }
      await doc.save();
      return successResponse(toPublicEnrollment(doc), "Marked as submitted");
    }

    if (status === "failed" || status === "error") {
      doc.automationStatus = "failed";
      doc.n8n.lastError = errorMessage || "Automation failed";
      if (doc.payload && typeof doc.payload === "object") {
        doc.payload.status = "failed";
      }
      await doc.save();
      return successResponse(toPublicEnrollment(doc), "Marked as failed");
    }

    if (status === "running") {
      doc.automationStatus = "running";
      await doc.save();
      return successResponse(toPublicEnrollment(doc));
    }

    return errorResponse(
      'status must be one of: submitted, failed, running',
      400
    );
  }

  async resolveForN8n(query) {
    return this.resolveDaycareByNameCityRegion({
      name: query?.name,
      city: query?.city,
      region: query?.region,
    });
  }
}

module.exports = EnrollmentController;
