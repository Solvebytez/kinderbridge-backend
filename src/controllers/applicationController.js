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
    this.applicationModel = new Application(db);
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
}

module.exports = ApplicationController;



























