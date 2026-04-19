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
    const existing = await this.creditModel.collection.findOne({ userId }).lean();
    if (!existing) return null;

    const hasStarterGap =
      (existing.totalCredits || 0) === 0 &&
      (existing.usedCredits || 0) === 0 &&
      (existing.remainingCredits || 0) === 0;

    if (!hasStarterGap) {
      return existing;
    }

    const now = new Date();
    const upgraded = await this.creditModel.collection.findOneAndUpdate(
      { userId, totalCredits: 0, usedCredits: 0, remainingCredits: 0 },
      {
        $set: {
          totalCredits: ApplicationController.INITIAL_AUTO_APPLY_CREDITS,
          remainingCredits: ApplicationController.INITIAL_AUTO_APPLY_CREDITS,
          lastCreditGrantAt: now,
        },
        $push: {
          grants: {
            credits: ApplicationController.INITIAL_AUTO_APPLY_CREDITS,
            note: "Initial starter credits",
            grantedAt: now,
          },
        },
      },
      { new: true }
    );

    return upgraded || existing;
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
  async updateApplicationStatus(applicationId, status, userId) {
    try {
      if (!applicationId) {
        return errorResponse("Application ID is required", 400);
      }

      if (!status) {
        return errorResponse("Status is required", 400);
      }

      const validStatuses = ["pending", "accepted", "rejected", "withdrawn"];
      if (!validStatuses.includes(status)) {
        return errorResponse(
          `Status must be one of: ${validStatuses.join(", ")}`,
          400
        );
      }

      const application = await this.applicationModel.updateApplicationStatus(
        applicationId,
        status,
        userId
      );

      const response = successResponse(application);
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
            totalCredits: ApplicationController.INITIAL_AUTO_APPLY_CREDITS,
            usedCredits: 0,
            remainingCredits: ApplicationController.INITIAL_AUTO_APPLY_CREDITS,
            grants: [
              {
                credits: ApplicationController.INITIAL_AUTO_APPLY_CREDITS,
                note: "Initial starter credits",
                grantedAt: new Date(),
              },
            ],
            lastCreditGrantAt: new Date(),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const hydratedWallet = await this.ensureStarterCredits(userId);
      const finalWallet = hydratedWallet || wallet;

      return successResponse({
        totalCredits: finalWallet.totalCredits,
        usedCredits: finalWallet.usedCredits,
        remainingCredits: finalWallet.remainingCredits,
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
      const wallet = await this.creditModel.collection.findOneAndUpdate(
        { userId },
        {
          // Do not set totalCredits/remainingCredits in $setOnInsert: same paths
          // are updated with $inc; MongoDB rejects ConflictingUpdateOperators (40).
          $setOnInsert: {
            userId,
            usedCredits: 0,
          },
          $inc: {
            totalCredits: credits,
            remainingCredits: credits,
          },
          $set: { lastCreditGrantAt: now },
          $push: {
            grants: {
              credits,
              paymentReference,
              note,
              grantedAt: now,
            },
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const response = successResponse(
        {
          totalCredits: wallet.totalCredits,
          usedCredits: wallet.usedCredits,
          remainingCredits: wallet.remainingCredits,
          grantedCredits: credits,
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

      const existingSet = new Set(existingApplications.map((app) => app.daycareId));
      const eligibleDaycareIds = daycareIds.filter((id) => !existingSet.has(id));
      const skippedDaycareIds = daycareIds.filter((id) => existingSet.has(id));

      if (eligibleDaycareIds.length === 0) {
        return successResponse(
          {
            createdCount: 0,
            skippedCount: skippedDaycareIds.length,
            createdIds: [],
            skippedDaycareIds,
            credits: null,
          },
          "All selected daycares already have active applications"
        );
      }

      await this.creditModel.collection.findOneAndUpdate(
        { userId },
        {
          $setOnInsert: {
            userId,
            totalCredits: ApplicationController.INITIAL_AUTO_APPLY_CREDITS,
            usedCredits: 0,
            remainingCredits: ApplicationController.INITIAL_AUTO_APPLY_CREDITS,
            grants: [
              {
                credits: ApplicationController.INITIAL_AUTO_APPLY_CREDITS,
                note: "Initial starter credits",
                grantedAt: new Date(),
              },
            ],
            lastCreditGrantAt: new Date(),
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
      await this.ensureStarterCredits(userId);

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

      return successResponse(
        {
          createdCount: created.length,
          skippedCount: skippedDaycareIds.length,
          createdIds: created.map((item) => item._id),
          skippedDaycareIds,
          credits: {
            totalCredits: consumedWallet.totalCredits,
            usedCredits: consumedWallet.usedCredits,
            remainingCredits: consumedWallet.remainingCredits,
          },
        },
        "Auto-apply applications submitted successfully"
      );
    } catch (error) {
      console.error("Error submitting auto-apply applications:", error);
      return internalErrorResponse(error.message);
    }
  }
}

module.exports = ApplicationController;























