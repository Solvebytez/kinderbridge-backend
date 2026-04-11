const ContactLog = require("../schemas/ContactLogSchema");

/**
 * Contact Log Model Wrapper
 * Maintains compatibility with existing code while using Mongoose
 */
class ContactLogModel {
  constructor(db) {
    this.db = db;
    this.collection = ContactLog; // Mongoose model
  }

  /**
   * Create a new contact log
   * @param {Object} contactLogData - Contact log data
   * @returns {Object} Created contact log
   */
  async createContactLog(contactLogData) {
    try {
      return await ContactLog.createContactLog(contactLogData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's contact logs
   * @param {string} userId - User ID
   * @returns {Array} Array of contact logs with daycare details
   */
  async getUserContactLogs(userId) {
    try {
      return await ContactLog.getUserContactLogs(userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get contact logs by daycare
   * @param {string} userId - User ID
   * @param {string} daycareId - Daycare ID
   * @returns {Array} Array of contact logs for the daycare
   */
  async getDaycareContactLogs(userId, daycareId) {
    try {
      return await ContactLog.getDaycareContactLogs(userId, daycareId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update a contact log
   * @param {string} contactLogId - Contact log ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Object} Updated contact log
   */
  async updateContactLog(contactLogId, userId, updateData) {
    try {
      return await ContactLog.updateContactLog(contactLogId, userId, updateData);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a contact log
   * @param {string} contactLogId - Contact log ID
   * @param {string} userId - User ID
   * @returns {Object} Deleted contact log
   */
  async deleteContactLog(contactLogId, userId) {
    try {
      return await ContactLog.deleteContactLog(contactLogId, userId);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ContactLogModel;



























