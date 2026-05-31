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
  mergeFormMetadataFromDaycare,
} = require("../utils/enrollmentPayload");
const {
  syncEnrollmentToFormQueue,
  queueDocumentToPayload,
  displayFieldsFromQueueStatus,
  loadQueueById,
  loadQueuesByIds,
} = require("../utils/enrollmentFormQueueSync");
const EnrollmentFormQueue = require("../schemas/EnrollmentFormQueueSchema");

function getDaycareModel() {
  const mongoose = require("mongoose");
  try {
    return mongoose.model("Daycare");
  } catch {
    require("../schemas/DaycareSchema");
    return mongoose.model("Daycare");
  }
}

function toPublicEnrollment(doc, queueLean = null) {
  if (!doc) return null;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  let payload = o.payload;
  let automationStatus = o.automationStatus;
  let completionStatus = o.completionStatus;
  let formQueue = null;
  let queueStatus = null;

  if (queueLean) {
    formQueue = {
      ...queueLean,
      _id: queueLean._id?.toString?.() || queueLean._id,
    };
    queueStatus =
      queueLean.status != null && String(queueLean.status).trim()
        ? String(queueLean.status).trim()
        : "draft";
    const fromQueue = queueDocumentToPayload(queueLean);
    if (fromQueue) {
      payload = fromQueue;
    }
    const display = displayFieldsFromQueueStatus(queueStatus);
    automationStatus = display.automationStatus;
    completionStatus = display.completionStatus;
  }

  return {
    _id: o._id?.toString?.() || o._id,
    applicationId: o.applicationId,
    userId: o.userId,
    daycareId: o.daycareId,
    schemaVersion: o.schemaVersion,
    enrollmentFormQueueId: o.enrollmentFormQueueId || null,
    payload,
    formQueue,
    queueStatus,
    completionStatus,
    automationStatus,
    n8n: o.n8n || {},
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

async function publicEnrollmentWithQueue(doc) {
  const lean = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const queueLean = lean.enrollmentFormQueueId
    ? await loadQueueById(lean.enrollmentFormQueueId)
    : null;
  return toPublicEnrollment(lean, queueLean);
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
    let payload = prefillPayloadFromApplication(application, daycare);
    if (daycare) {
      payload = {
        ...payload,
        form_metadata: mergeFormMetadataFromDaycare(daycare, payload.form_metadata),
      };
    }
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

    try {
      await syncEnrollmentToFormQueue(created);
    } catch (syncErr) {
      console.error("enrollment_form_queue sync failed (create):", syncErr);
    }

    const refreshed = await EnrollmentSubmission.findById(created._id).lean();
    return refreshed || created.toObject();
  }

  async getByApplicationId(userId, applicationId) {
    const doc = await EnrollmentSubmission.findOne({
      applicationId: String(applicationId).trim(),
      userId: String(userId),
    }).lean();

    if (!doc) {
      return notFoundResponse("Enrollment submission not found");
    }
    const queueLean = doc.enrollmentFormQueueId
      ? await loadQueueById(doc.enrollmentFormQueueId)
      : null;
    return successResponse(toPublicEnrollment(doc, queueLean));
  }

  async listMine(userId) {
    const docs = await EnrollmentSubmission.find({ userId: String(userId) })
      .sort({ updatedAt: -1 })
      .lean();
    const queueMap = await loadQueuesByIds(
      docs.map((d) => d.enrollmentFormQueueId)
    );
    return successResponse(
      docs.map((d) =>
        toPublicEnrollment(
          d,
          d.enrollmentFormQueueId
            ? queueMap.get(String(d.enrollmentFormQueueId))
            : null
        )
      )
    );
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
    const daycare = await this.findDaycareById(doc.daycareId);
    if (daycare) {
      doc.payload.form_metadata = mergeFormMetadataFromDaycare(
        daycare,
        doc.payload.form_metadata
      );
    }
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

    try {
      await syncEnrollmentToFormQueue(doc);
    } catch (syncErr) {
      console.error("enrollment_form_queue sync failed (patch):", syncErr);
    }

    const refreshed = await EnrollmentSubmission.findById(doc._id).lean();
    const queueLean = refreshed?.enrollmentFormQueueId
      ? await loadQueueById(refreshed.enrollmentFormQueueId)
      : null;
    return successResponse(toPublicEnrollment(refreshed || doc, queueLean));
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
        await publicEnrollmentWithQueue(doc),
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

    try {
      await syncEnrollmentToFormQueue(doc);
    } catch (syncErr) {
      console.error("enrollment_form_queue sync failed (queue):", syncErr);
    }

    await this.notifyN8nWebhook(doc);

    const refreshed = await EnrollmentSubmission.findById(doc._id).lean();
    const queueLean = refreshed?.enrollmentFormQueueId
      ? await loadQueueById(refreshed.enrollmentFormQueueId)
      : null;
    return successResponse(
      toPublicEnrollment(refreshed || doc, queueLean),
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
      const queueId = doc.enrollmentFormQueueId
        ? String(doc.enrollmentFormQueueId)
        : await syncEnrollmentToFormQueue(doc);

      const body = {
        enrollmentId: doc._id?.toString(),
        enrollmentFormQueueId: queueId || null,
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
    const queueLean = doc.enrollmentFormQueueId
      ? await loadQueueById(doc.enrollmentFormQueueId)
      : null;
    return successResponse(toPublicEnrollment(doc, queueLean));
  }

  async n8nGetFormQueue(queueId) {
    const id = String(queueId || "").trim();
    if (!id) return errorResponse("id is required", 400);

    let queueDoc = await EnrollmentFormQueue.findById(id).lean();
    let enrollmentMeta = null;

    if (!queueDoc) {
      const submission = await EnrollmentSubmission.findById(id).lean();
      if (submission?.enrollmentFormQueueId) {
        enrollmentMeta = {
          enrollmentId: submission._id?.toString(),
          applicationId: submission.applicationId,
          userId: submission.userId,
          daycareId: submission.daycareId,
        };
        queueDoc = await EnrollmentFormQueue.findById(
          submission.enrollmentFormQueueId
        ).lean();
      }
    } else {
      const submission = await EnrollmentSubmission.findOne({
        enrollmentFormQueueId: id,
      }).lean();
      if (submission) {
        enrollmentMeta = {
          enrollmentId: submission._id?.toString(),
          applicationId: submission.applicationId,
          userId: submission.userId,
          daycareId: submission.daycareId,
        };
      }
    }

    if (!queueDoc) {
      return notFoundResponse("Enrollment form queue record not found");
    }

    return successResponse({
      ...queueDoc,
      _id: queueDoc._id?.toString(),
      enrollment: enrollmentMeta,
    });
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
      try {
        await syncEnrollmentToFormQueue(doc);
      } catch (syncErr) {
        console.error("enrollment_form_queue sync failed (callback submitted):", syncErr);
      }
      return successResponse(
        await publicEnrollmentWithQueue(doc),
        "Marked as submitted"
      );
    }

    if (status === "failed" || status === "error") {
      doc.automationStatus = "failed";
      doc.n8n.lastError = errorMessage || "Automation failed";
      if (doc.payload && typeof doc.payload === "object") {
        doc.payload.status = "failed";
      }
      await doc.save();
      try {
        await syncEnrollmentToFormQueue(doc);
      } catch (syncErr) {
        console.error("enrollment_form_queue sync failed (callback failed):", syncErr);
      }
      return successResponse(
        await publicEnrollmentWithQueue(doc),
        "Marked as failed"
      );
    }

    if (status === "running") {
      doc.automationStatus = "running";
      await doc.save();
      try {
        await syncEnrollmentToFormQueue(doc);
      } catch (syncErr) {
        console.error("enrollment_form_queue sync failed (callback running):", syncErr);
      }
      return successResponse(await publicEnrollmentWithQueue(doc));
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
