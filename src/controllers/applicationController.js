const {
  successResponse,
  errorResponse,
  notFoundResponse,
  internalErrorResponse,
  unauthorizedResponse,
} = require("../utils/responseHelper");

/**
 * Application Controller
 * Handles all application business logic
 */
class ApplicationController {
  constructor(db) {
    this.db = db;
    // Ensure Mongoose is connected (models will handle initialization)
    const Application = require("../models/Application");
    const AutoApplyCredit = require("../models/AutoApplyCredit");
    this.applicationModel = new Application(db);
    this.creditModel = new AutoApplyCredit(db);
  }

  static INITIAL_AUTO_APPLY_CREDITS = 30;

  async ensureStarterCredits(userId) {
    // Starter credits were removed. Credits are only granted after payment.
    // Keep this method for backward compatibility, but do not mutate the wallet.
    const existing = await this.creditModel.collection.findOne({ userId }).lean();
    return existing || null;
  }

  parseDateInput(value) {
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Accept yyyy-mm-dd
    const isoLike = /^(\d{4})-(\d{2})-(\d{2})$/;
    const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/;

    let parsedDate = null;
    if (isoLike.test(trimmed)) {
      parsedDate = new Date(`${trimmed}T00:00:00.000Z`);
    } else {
      const match = trimmed.match(ddmmyyyy);
      if (match) {
        const [, dd, mm, yyyy] = match;
        parsedDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
      }
    }

    if (!parsedDate || Number.isNaN(parsedDate.getTime())) return null;
    return parsedDate;
  }

  /**
   * Create a new application
   * @param {string} userId - User ID
   * @param {Object} applicationData - Application data
   * @returns {Object} Response with created application
   */
  async createApplication(userId, applicationData) {
    try {
      if (!userId) {
        return unauthorizedResponse("User ID is required");
      }

      if (!applicationData.daycareId) {
        return errorResponse("Daycare ID is required", 400);
      }

      // Add userId to application data
      const fullApplicationData = {
        ...applicationData,
        userId,
      };

      const application = await this.applicationModel.createApplication(
        fullApplicationData
      );

      const response = successResponse(application);
      response.body.message = "Application submitted successfully";
      return response;
    } catch (error) {
      console.error("Error creating application:", error);
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Get user's applications
   * @param {string} userId - User ID
   * @returns {Object} Response with user's applications
   */
  async getUserApplications(userId) {
    try {
      if (!userId) {
        return unauthorizedResponse("User ID is required");
      }

      const applications = await this.applicationModel.getUserApplications(
        userId
      );

      const response = successResponse(applications);
      response.body.metadata = {
        totalCount: applications.length,
        timestamp: new Date().toISOString(),
      };
      return response;
    } catch (error) {
      console.error("Error fetching user applications:", error);
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Get application by ID
   * @param {string} applicationId - Application ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Object} Response with application
   */
  async getApplicationById(applicationId, userId) {
    try {
      if (!applicationId) {
        return errorResponse("Application ID is required", 400);
      }

      const application = await this.applicationModel.getApplicationById(
        applicationId
      );

      // Check if user is authorized to view this application
      if (application.userId !== userId) {
        return unauthorizedResponse("Unauthorized to view this application");
      }

      return successResponse(application);
    } catch (error) {
      console.error("Error fetching application:", error);
      if (error.message === "Application not found") {
        return notFoundResponse(
          `No application found with ID: ${applicationId}`
        );
      }
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Update application status
   * @param {string} applicationId - Application ID
   * @param {string} status - New status
   * @param {string} userId - User ID (for authorization)
   * @returns {Object} Response with updated application
   */
  async updateApplicationStatus(applicationId, status, userId, updatePayload = {}) {
    try {
      if (!applicationId) {
        return errorResponse("Application ID is required", 400);
      }

      if (!status) {
        return errorResponse("Status is required", 400);
      }

      const raw = String(status).trim();
      const normalized = raw.toLowerCase();
      // Accept frontend labels too (e.g. "Responses", "Follow-Ups").
      const aliasMap = {
        pending: "pending",
        viewed: "viewed",
        "follow-ups": "follow_up",
        "follow ups": "follow_up",
        followups: "follow_up",
        followup: "follow_up",
        "follow-up": "follow_up",
        "follow up": "follow_up",
        responses: "responded",
        response: "responded",
        responded: "responded",
        accepted: "accepted",
        rejected: "rejected",
        withdrawn: "withdrawn",
      };

      const mapped = aliasMap[normalized] || null;

      const validStatuses = [
        "pending",
        "viewed",
        "follow_up",
        "responded",
        "accepted",
        "rejected",
        "withdrawn",
      ];
      if (!mapped || !validStatuses.includes(mapped)) {
        return errorResponse(
          `Status must be one of: ${validStatuses.join(", ")}`,
          400
        );
      }

      const portal =
        typeof updatePayload?.portal === "string" ? updatePayload.portal.trim() : null;
      const responseMessage =
        typeof updatePayload?.responseMessage === "string"
          ? updatePayload.responseMessage
          : null;

      const application = await this.applicationModel.updateApplicationStatus(
        applicationId,
        mapped,
        userId
      );

      if (portal !== null || responseMessage !== null) {
        await this.applicationModel.collection.findOneAndUpdate(
          { _id: applicationId, userId },
          {
            $set: {
              ...(portal !== null ? { portal } : {}),
              ...(responseMessage !== null ? { responseMessage: String(responseMessage) } : {}),
            },
          },
          { new: true }
        );
      }

      const refreshed = await this.applicationModel.collection
        .findById(applicationId)
        .lean();

      const response = successResponse(refreshed || application);
      response.body.message = "Application status updated successfully";
      return response;
    } catch (error) {
      console.error("Error updating application status:", error);
      if (error.message === "Application not found") {
        return notFoundResponse(
          `No application found with ID: ${applicationId}`
        );
      }
      if (error.message === "Unauthorized to update this application") {
        return unauthorizedResponse(error.message);
      }
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Delete application
   * @param {string} applicationId - Application ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Object} Response with deletion confirmation
   */
  async deleteApplication(applicationId, userId) {
    try {
      if (!applicationId) {
        return errorResponse("Application ID is required", 400);
      }

      if (!userId) {
        return unauthorizedResponse("User ID is required");
      }

      const application = await this.applicationModel.deleteApplication(
        applicationId,
        userId
      );

      if (!application) {
        return notFoundResponse("Application not found or you don't have permission to delete it");
      }

      const response = successResponse({ deleted: true, id: applicationId });
      response.body.message = "Application deleted successfully";
      return response;
    } catch (error) {
      console.error("Error deleting application:", error);
      return internalErrorResponse(error.message);
    }
  }

  async getAutoApplyCredits(userId) {
    try {
      if (!userId) {
        return unauthorizedResponse("User ID is required");
      }

      const wallet = await this.creditModel.collection.findOneAndUpdate(
        { userId },
        {
          $setOnInsert: {
            userId,
            totalCredits: 0,
            usedCredits: 0,
            remainingCredits: 0,
            grants: [],
            lastCreditGrantAt: null,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const finalWallet = wallet;

      return successResponse({
        // Pack size is 30, but wallets start at 0 until payment grants a pack.
        totalCredits: Number(finalWallet.totalCredits || 0),
        usedCredits: Number(finalWallet.usedCredits || 0),
        remainingCredits: Number(finalWallet.remainingCredits || 0),
      });
    } catch (error) {
      console.error("Error getting auto-apply credits:", error);
      return internalErrorResponse(error.message);
    }
  }

  async grantAutoApplyCredits(userId, payload = {}) {
    try {
      if (!userId) {
        return unauthorizedResponse("User ID is required");
      }

      const credits = Number(payload.credits ?? 30);
      if (!Number.isInteger(credits) || credits <= 0 || credits > 30) {
        return errorResponse("credits must be an integer between 1 and 30", 400);
      }

      const paymentReference =
        typeof payload.paymentReference === "string"
          ? payload.paymentReference.trim() || null
          : null;
      const note =
        typeof payload.note === "string" ? payload.note.trim() || null : null;

      const now = new Date();
      const PACK = ApplicationController.INITIAL_AUTO_APPLY_CREDITS;

      // Idempotency: if we already recorded this paymentReference, return current wallet as success.
      if (paymentReference) {
        const existingByRef = await this.creditModel.collection.findOne(
          { userId, "grants.paymentReference": paymentReference },
          { projection: { totalCredits: 1, usedCredits: 1, remainingCredits: 1 } }
        );
        if (existingByRef) {
          return successResponse(
            {
              totalCredits: Number(existingByRef.totalCredits || 0),
              usedCredits: Number(existingByRef.usedCredits || 0),
              remainingCredits: Number(existingByRef.remainingCredits || 0),
              grantedCredits: 0,
            },
            "Credits already granted for this payment"
          );
        }
      }

      // Single-pack model: user should NOT buy another pack until the current pack is consumed.
      const existing = await this.creditModel.collection.findOne({ userId }).lean();
      const existingRemaining = Number(existing?.remainingCredits ?? 0);
      const normalizedRemaining = Number.isFinite(existingRemaining)
        ? Math.max(0, existingRemaining)
        : 0;

      if (existing && normalizedRemaining > 0) {
        return errorResponse(
          `You still have ${normalizedRemaining} credits remaining. Please use them before purchasing again.`,
          400,
          [{ remainingCredits: normalizedRemaining }]
        );
      }

      const walletResult = await this.creditModel.collection.findOneAndUpdate(
        { userId },
        {
          $setOnInsert: {
            userId,
          },
          $set: {
            totalCredits: PACK,
            usedCredits: 0,
            remainingCredits: PACK,
            lastCreditGrantAt: now,
          },
          $push: {
            grants: {
              credits: PACK,
              paymentReference,
              note,
              grantedAt: now,
            },
          },
        },
        { upsert: true, returnDocument: "after" }
      );
      // Driver may return doc directly or as { value } depending on MongoDB driver version
      const wallet = walletResult?.value ?? walletResult;
      if (!wallet) {
        return internalErrorResponse("Failed to load wallet after granting credits");
      }

      const response = successResponse(
        {
          totalCredits: PACK,
          usedCredits: Number(wallet.usedCredits || 0),
          remainingCredits: Number(wallet.remainingCredits || 0),
          grantedCredits: PACK,
        },
        "Credits granted successfully"
      );
      return response;
    } catch (error) {
      console.error("Error granting auto-apply credits:", error);
      return internalErrorResponse(error.message);
    }
  }

  async submitAutoApplyApplications(userId, payload) {
    try {
      if (!userId) {
        return unauthorizedResponse("User ID is required");
      }

      const daycareIds = Array.isArray(payload?.daycareIds)
        ? [...new Set(payload.daycareIds.map((id) => String(id).trim()).filter(Boolean))]
        : [];

      if (daycareIds.length === 0) {
        return errorResponse("At least one daycare ID is required", 400);
      }

      const parentName = String(payload?.parentName || "").trim();
      const parentEmail = String(payload?.parentEmail || "").trim().toLowerCase();
      const parentPhone = String(payload?.parentPhone || "").trim();
      const childName = String(payload?.childName || "").trim();
      const specialNotes = String(payload?.specialNotes || "").trim();
      const childDob = this.parseDateInput(payload?.childDob);
      const preferredStartDate = this.parseDateInput(payload?.preferredStartDate);

      if (!parentName || !parentEmail || !parentPhone || !childName) {
        return errorResponse(
          "parentName, parentEmail, parentPhone, and childName are required",
          400
        );
      }
      if (!childDob) {
        return errorResponse("childDob is required (dd-mm-yyyy or yyyy-mm-dd)", 400);
      }
      if (!preferredStartDate) {
        return errorResponse(
          "preferredStartDate is required (dd-mm-yyyy or yyyy-mm-dd)",
          400
        );
      }

      const ApplicationCollection = this.applicationModel.collection;
      const existingApplications = await ApplicationCollection.find({
        userId,
        daycareId: { $in: daycareIds },
        status: { $in: ["pending", "accepted"] },
      })
        .select("daycareId")
        .lean();

      const existingSet = new Set(
        existingApplications.map((app) => String(app.daycareId || "").trim())
      );
      const eligibleDaycareIds = daycareIds.filter((id) => !existingSet.has(id));
      const skippedDaycareIds = daycareIds.filter((id) => existingSet.has(id));

      if (eligibleDaycareIds.length === 0) {
        return errorResponse(
          "All selected daycares already have a pending or accepted application. Choose different daycares or wait until an application is rejected or withdrawn before re-applying.",
          400,
          [
            {
              code: "ALL_DAYCARES_ALREADY_APPLIED",
              skippedDaycareIds,
              skippedCount: skippedDaycareIds.length,
            },
          ]
        );
      }

      await this.creditModel.collection.findOneAndUpdate(
        { userId },
        {
          $setOnInsert: {
            userId,
            totalCredits: 0,
            usedCredits: 0,
            remainingCredits: 0,
            grants: [],
            lastCreditGrantAt: null,
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );

      const creditsNeeded = eligibleDaycareIds.length;
      const consumedWallet = await this.creditModel.collection.findOneAndUpdate(
        { userId, remainingCredits: { $gte: creditsNeeded } },
        {
          $inc: {
            usedCredits: creditsNeeded,
            remainingCredits: -creditsNeeded,
          },
          $set: { lastCreditUsageAt: new Date() },
        },
        { new: true }
      );

      if (!consumedWallet) {
        const wallet = await this.creditModel.collection.findOne({ userId }).lean();
        const remainingCredits = wallet?.remainingCredits || 0;
        return errorResponse(
          `Insufficient credits. You selected ${creditsNeeded}, but only ${remainingCredits} credits remain.`,
          400,
          [{ remainingCredits, creditsNeeded }]
        );
      }

      const docs = eligibleDaycareIds.map((daycareId) => ({
        userId,
        daycareId,
        source: "auto_apply",
        status: "pending",
        parentName,
        parentEmail,
        parentPhone,
        childName,
        childDob,
        preferredStartDate,
        specialNotes: specialNotes || undefined,
        // Keep legacy compatibility fields populated where practical.
        startDate: preferredStartDate,
        additionalNotes: specialNotes || undefined,
      }));

      let created = [];
      try {
        created = await ApplicationCollection.insertMany(docs, { ordered: true });
      } catch (createError) {
        // Compensate credits on write failure.
        await this.creditModel.collection.findOneAndUpdate(
          { userId },
          {
            $inc: {
              usedCredits: -creditsNeeded,
              remainingCredits: creditsNeeded,
            },
          }
        );
        throw createError;
      }

      try {
        const EnrollmentController = require("./enrollmentController");
        const enrollmentController = new EnrollmentController(this.db);
        const enrollmentPartial =
          payload?.enrollmentPayload &&
          typeof payload.enrollmentPayload === "object"
            ? payload.enrollmentPayload
            : null;
        for (const app of created) {
          const draft = await enrollmentController.ensureDraftForApplication(
            userId,
            app
          );
          if (enrollmentPartial && draft?._id) {
            await enrollmentController.patchPayload(
              userId,
              String(draft._id),
              enrollmentPartial
            );
          }
        }
      } catch (enrollmentError) {
        console.error(
          "Warning: auto-apply succeeded but enrollment draft creation failed:",
          enrollmentError
        );
      }

      const successMessage =
        skippedDaycareIds.length > 0
          ? `Submitted ${created.length} application(s). ${skippedDaycareIds.length} daycare(s) were skipped — you already have a pending or accepted application there.`
          : "Auto-apply applications submitted successfully";

      return successResponse(
        {
          createdCount: created.length,
          skippedCount: skippedDaycareIds.length,
          createdIds: created.map((item) => item._id),
          skippedDaycareIds,
          credits: {
            totalCredits: Number(consumedWallet.totalCredits || 0),
            usedCredits: Number(consumedWallet.usedCredits || 0),
            remainingCredits: Number(consumedWallet.remainingCredits || 0),
          },
        },
        successMessage
      );
    } catch (error) {
      console.error("Error submitting auto-apply applications:", error);
      return internalErrorResponse(error.message);
    }
  }
}

module.exports = ApplicationController;























