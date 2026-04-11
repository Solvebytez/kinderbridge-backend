const {
  successResponse,
  errorResponse,
  notFoundResponse,
  internalErrorResponse,
} = require("../utils/responseHelper");

/**
 * Daycare Controller
 * Handles all daycare business logic
 */
class DaycareController {
  constructor(db) {
    this.db = db;
    // Ensure Mongoose is connected (models will handle initialization)
    const Daycare = require("../models/Daycare");
    this.daycareModel = new Daycare(db);
  }

  /**
   * Get all daycares
   * @returns {Object} Response with all daycares
   */
  async getAllDaycares() {
    try {
      const daycares = await this.daycareModel.getAllDaycares();

      const response = successResponse(daycares);
      response.body.metadata = {
        totalCount: daycares.length,
        timestamp: new Date().toISOString(),
      };
      return response;
    } catch (error) {
      console.error("Error fetching daycares:", error);
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Search daycares with filters and pagination
   * @param {Object} filters - Search filters (q, location, priceMin, priceMax, availability, ageRange, features, page, limit)
   * @returns {Object} Response with paginated filtered daycares
   */
  async searchDaycares(filters) {
    try {
      const result = await this.daycareModel.searchDaycares(filters);

      const response = successResponse(result.daycares);
      response.body.metadata = {
        pagination: {
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          totalCount: result.totalCount,
          limit: result.limit,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        },
        filters: filters,
      };
      return response;
    } catch (error) {
      console.error("Error searching daycares:", error);
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Get daycare by ID
   * @param {string} id - Daycare ID
   * @returns {Object} Response with daycare data
   */
  async getDaycareById(id) {
    try {
      const daycare = await this.daycareModel.getDaycareById(id);
      return successResponse(daycare);
    } catch (error) {
      console.error("Error fetching daycare:", error);
      if (error.message === "Daycare not found") {
        return notFoundResponse(`No daycare found with ID: ${id}`);
      }
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Get all unique locations
   * @returns {Object} Response with all unique city locations
   */
  async getAllLocations() {
    try {
      const locations = await this.daycareModel.getAllLocations();

      const response = successResponse(locations);
      response.body.count = locations.length;
      return response;
    } catch (error) {
      console.error("Error fetching locations:", error);
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Get all unique regions
   */
  async getAllRegions() {
    try {
      const regions = await this.daycareModel.getAllRegions();
      const response = successResponse(regions);
      response.body.count = regions.length;
      return response;
    } catch (error) {
      console.error("Error fetching regions:", error);
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Get all unique cities for a region
   */
  async getCitiesByRegion(region) {
    try {
      const cities = await this.daycareModel.getCitiesByRegion(region);
      const response = successResponse(cities);
      response.body.count = cities.length;
      response.body.region = region;
      return response;
    } catch (error) {
      console.error("Error fetching cities by region:", error);
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Get all unique program ages
   */
  async getAllProgramAges() {
    try {
      const programAges = await this.daycareModel.getAllProgramAges();
      const response = successResponse(programAges);
      response.body.count = programAges.length;
      return response;
    } catch (error) {
      console.error("Error fetching program ages:", error);
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Get all unique daycare types filtered by region and/or city
   */
  async getTypesByRegionAndCity(region, city) {
    try {
      const types = await this.daycareModel.getTypesByRegionAndCity(region || "", city || "");
      const response = successResponse(types);
      response.body.count = types.length;
      response.body.region = region || null;
      response.body.city = city || null;
      return response;
    } catch (error) {
      console.error("Error fetching types by region and city:", error);
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Get daycare statistics
   * @returns {Object} Response with daycare statistics
   */
  async getStats() {
    try {
      const stats = await this.daycareModel.getStats();
      return successResponse(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      return internalErrorResponse(error.message);
    }
  }

  /**
   * Get vacancy statistics by age group for a region (v14.0.0)
   * @param {string} region - Region name (e.g., "Toronto")
   * @returns {Object} Response with vacancy counts by age group
   */
  async getVacancyStats(region) {
    try {
      const stats = await this.daycareModel.getVacancyStats(region || "Toronto");
      return successResponse(stats);
    } catch (error) {
      console.error("Error fetching vacancy stats:", error);
      return internalErrorResponse(error.message);
    }
  }
}

module.exports = DaycareController;
