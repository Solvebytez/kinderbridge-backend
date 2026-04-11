const Application = require("../schemas/ApplicationSchema");

/**
 * Application Model Wrapper
 * Maintains compatibility with existing code while using Mongoose
 */
class ApplicationModel {
  constructor(db) {
    this.db = db;
    this.collection = Application; // Mongoose model
  }

  /**
   * Create a new application
   * @param {Object} applicationData - Application data
   * @returns {Object} Created application
   */
  async createApplication(applicationData) {
    try {
      return await Application.createApplication(applicationData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's applications
   * @param {string} userId - User ID
   * @returns {Array} Array of applications with daycare details
   */
  async getUserApplications(userId) {
    try {
      return await Application.getUserApplications(userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get application by ID
   * @param {string} applicationId - Application ID
   * @returns {Object} Application with daycare details
   */
  async getApplicationById(applicationId) {
    try {
      return await Application.getApplicationById(applicationId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update application status
   * @param {string} applicationId - Application ID
   * @param {string} status - New status (pending, accepted, rejected, withdrawn)
   * @param {string} userId - User ID (for authorization)
   * @returns {Object} Updated application
   */
  async updateApplicationStatus(applicationId, status, userId) {
    try {
      return await Application.updateApplicationStatus(
        applicationId,
        status,
        userId
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete application
   * @param {string} applicationId - Application ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Object} Deleted application or null
   */
  async deleteApplication(applicationId, userId) {
    try {
      return await Application.deleteApplication(applicationId, userId);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ApplicationModel;



























