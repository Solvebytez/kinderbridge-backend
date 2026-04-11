const Daycare = require("../schemas/DaycareSchema");
const { connectToMongoDB } = require("../config/database");

/**
 * Daycare Model Wrapper
 * Maintains compatibility with existing code while using Mongoose
 */
class DaycareModel {
  constructor(db) {
    // Mongoose models are global, db parameter kept for compatibility
    this.db = db;
    this.collection = Daycare; // Mongoose model

    // Ensure Mongoose is connected (lazy initialization)
    this.ensureConnection();
  }

  async ensureConnection() {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1) {
      try {
        await connectToMongoDB();
      } catch (error) {
        console.error("Failed to initialize Mongoose:", error);
      }
    }
  }

  /**
   * Create a new daycare
   * @param {Object} daycareData - Daycare data
   * @returns {Object} Created daycare
   */
  async createDaycare(daycareData) {
    try {
      await this.ensureConnection();

      const validationErrors = this.validateDaycareData(daycareData);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(", "));
      }

      const daycare = await Daycare.create(daycareData);
      return daycare.toObject();
    } catch (error) {
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((e) => e.message);
        throw new Error(messages.join(", "));
      }
      throw error;
    }
  }

  /**
   * Get daycare by ID or slug (v15.0.0 - slug support)
   * @param {string} idOrSlug - Daycare ID or slug
   * @returns {Object} Daycare object
   */
  async getDaycareById(idOrSlug) {
    try {
      await this.ensureConnection();

      let daycare;

      // v15.0.0: Try slug first (better SEO, more readable URLs)
      daycare = await Daycare.findOne({ slug: idOrSlug });

      // If not found by slug, try ObjectId
      if (!daycare) {
        const mongoose = require("mongoose");
        if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
          daycare = await Daycare.findById(idOrSlug);
        }
      }

      // If still not found, try string search (backward compatibility)
      if (!daycare) {
        daycare = await Daycare.findOne({
          $or: [{ id: idOrSlug }, { name: { $regex: idOrSlug, $options: "i" } }],
        });
      }

      if (!daycare) {
        throw new Error("Daycare not found");
      }

      return daycare.toObject();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all daycares
   * @param {Object} filters - Optional filters
   * @returns {Array} Array of daycares
   */
  async getAllDaycares(filters = {}) {
    try {
      await this.ensureConnection();

      const daycares = await Daycare.find(filters).lean();
      return daycares;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique regions (non-empty)
   * @returns {Array<string>} regions
   */
  async getAllRegions() {
    await this.ensureConnection();
    // NOTE: We avoid `distinct` because this project enables MongoDB Stable API
    // with `strict: true`, and `distinct` is not supported in API Version 1.
    const rows = await Daycare.aggregate([
      { $match: { region: { $exists: true, $ne: "" } } },
      { $group: { _id: "$region" } },
      { $project: { _id: 0, value: "$_id" } },
      { $sort: { value: 1 } },
    ]);
    return rows.map((r) => r.value);
  }

  /**
   * Get all unique cities/wards for a region (non-empty)
   * Note: user treats city/ward as same dropdown.
   * @param {string} region
   * @returns {Array<string>} cities
   */
  async getCitiesByRegion(region) {
    await this.ensureConnection();
    if (!region) return [];

    // Prefer city values; if you want ward values instead, switch the grouped field.
    // Also avoids `distinct` for MongoDB Stable API strict mode compatibility.
    const rows = await Daycare.aggregate([
      {
        $match: {
          region: { $regex: region, $options: "i" },
          city: { $exists: true, $ne: "" },
        },
      },
      { $group: { _id: "$city" } },
      { $project: { _id: 0, value: "$_id" } },
      { $sort: { value: 1 } },
    ]);
    return rows.map((r) => r.value);
  }

  /**
   * Get all unique programAge values (non-empty and not "NO")
   * @returns {Array<string>} program ages
   */
  async getAllProgramAges() {
    await this.ensureConnection();
    const rows = await Daycare.aggregate([
      { $match: { programAge: { $exists: true, $nin: ["", "NO"] } } },
      { $group: { _id: "$programAge" } },
      { $project: { _id: 0, value: "$_id" } },
      { $sort: { value: 1 } },
    ]);
    return rows.map((r) => r.value);
  }

  /**
   * Get all unique daycareType values filtered by region and/or city
   * @param {string} region - Optional region filter
   * @param {string} city - Optional city filter
   * @returns {Array<string>} distinct daycare types
   */
  async getTypesByRegionAndCity(region, city) {
    await this.ensureConnection();

    const matchStage = {
      daycareType: { $exists: true, $nin: ["", "NO"] },
    };

    if (region) {
      matchStage.region = { $regex: region, $options: "i" };
    }

    if (city) {
      matchStage.city = { $regex: city, $options: "i" };
    }

    const rows = await Daycare.aggregate([
      { $match: matchStage },
      { $group: { _id: "$daycareType" } },
      { $project: { _id: 0, value: "$_id" } },
      { $sort: { value: 1 } },
    ]);

    return rows.map((r) => r.value);
  }

  /**
   * Search daycares with filters and pagination
   * @param {Object} searchParams - Search parameters
   * @returns {Object} Object with daycares array, totalCount, and pagination info
   */
  async searchDaycares(searchParams) {
    try {
      await this.ensureConnection();

      const {
        q,
        location,
        priceMin,
        priceMax,
        availability,
        ageRange,
        programAge,
        features,
        region,
        ward,
        daycareType,
        cwelcc,
        subsidy,
        vacancy,
        page = 1,
        limit = 10,
      } = searchParams;

      let filter = {};

      // Search query (name, description, features)
      if (q) {
        filter.$or = [
          { name: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } },
          { features: { $in: [new RegExp(q, "i")] } },
        ];
      }

      // Location filter (city, address)
      if (location) {
        if (filter.$or) {
          filter.$or.push(
            { city: { $regex: location, $options: "i" } },
            { address: { $regex: location, $options: "i" } }
          );
        } else {
          filter.$or = [
            { city: { $regex: location, $options: "i" } },
            { address: { $regex: location, $options: "i" } },
          ];
        }
      }

      // Region filter
      if (region) {
        filter.region = { $regex: region, $options: "i" };
      }

      // Price range filter
      if (priceMin || priceMax) {
        filter.price = {};
        if (priceMin) filter.price.$gte = parseFloat(priceMin);
        if (priceMax) filter.price.$lte = parseFloat(priceMax);
      }

      // Age range filter - filters by ageGroups existence (shows all daycares that offer that age group)
      // Frontend sends: "Infants", "Toddlers", "Preschool", "School Age"
      // Maps to: ageGroups.infant, ageGroups.toddler, ageGroups.preschool, ageGroups.schoolAge
      let ageRangeArray = [];
      if (ageRange) {
        const normalize = (s) =>
          String(s || "")
            .trim()
            .toLowerCase();

        // Map frontend values to database age group keys
        const ageKeyMap = {
          infants: "infant",
          infant: "infant",
          toddlers: "toddler",
          toddler: "toddler",
          preschool: "preschool",
          kindergarten: "kindergarten",
          "school age": "schoolAge",
          schoolage: "schoolAge",
        };

        // Parse ageRange (can be array or string)
        if (Array.isArray(ageRange) && ageRange.length > 0) {
          ageRangeArray = ageRange;
        } else if (typeof ageRange === "string") {
          const parsed = ageRange.split(",").map((a) => a.trim());
          if (parsed.length > 0) {
            ageRangeArray = parsed;
          }
        }

        // Filter by ageGroups with capacity filtering based on availability parameter
        // availability=yes (default) → capacity > 0 (they accept that age group)
        // availability=no → capacity = 0 (they do NOT accept that age group)
        if (ageRangeArray.length > 0) {
          const groupKeys = ageRangeArray
            .map((a) => ageKeyMap[normalize(a)])
            .filter(Boolean);

          if (groupKeys.length > 0) {
            filter.$and = filter.$and || [];

            // Check availability status (default to "yes" if not provided)
            const normalizeAvailability = String(availability || "yes")
              .trim()
              .toLowerCase();

            if (normalizeAvailability === "no") {
              // Filter for capacity = 0 OR field doesn't exist (they do NOT accept this age group)
              filter.$and.push({
                $or: groupKeys.flatMap((k) => [
                  { [`ageGroups.${k}.capacity`]: { $eq: 0 } },
                  { [`ageGroups.${k}.capacity`]: { $exists: false } },
                  { [`ageGroups.${k}`]: { $exists: false } },
                ]),
              });
              console.log(
                "🔍 Filtering for capacity = 0 or missing, groupKeys:",
                groupKeys
              );
            } else {
              // Default: Filter for capacity > 0 (they accept this age group)
              filter.$and.push({
                $or: groupKeys.map((k) => ({
                  [`ageGroups.${k}.capacity`]: { $gt: 0 },
                })),
              });
              console.log(
                "🔍 Filtering for capacity > 0, groupKeys:",
                groupKeys,
                "availability:",
                availability || "yes (default)"
              );
            }
          }
        }
      }

      // Vacancy filter (cascading with ageRange) - v14.0.0
      // filters by ageGroups.{group}.vacancy
      if (ageRange && vacancy) {
        const normalize = (s) =>
          String(s || "")
            .trim()
            .toLowerCase();

        const ageKeyMap = {
          infants: "infant",
          infant: "infant",
          toddlers: "toddler",
          toddler: "toddler",
          preschool: "preschool",
          kindergarten: "kindergarten",
          "school age": "schoolAge",
          schoolage: "schoolAge",
        };

        let ageRangeArray = [];
        if (Array.isArray(ageRange) && ageRange.length > 0) {
          ageRangeArray = ageRange;
        } else if (typeof ageRange === "string") {
          const parsed = ageRange.split(",").map((a) => a.trim());
          if (parsed.length > 0) {
            ageRangeArray = parsed;
          }
        }

        if (ageRangeArray.length > 0) {
          const groupKeys = ageRangeArray
            .map((a) => ageKeyMap[normalize(a)])
            .filter(Boolean);

          if (groupKeys.length > 0) {
            filter.$and = filter.$and || [];
            const normalizeVacancy = String(vacancy || "")
              .trim()
              .toLowerCase();

            if (normalizeVacancy === "no") {
              // Filter for vacancy = 0 OR field doesn't exist (no vacancy)
              filter.$and.push({
                $or: groupKeys.flatMap((k) => [
                  { [`ageGroups.${k}.vacancy`]: { $eq: 0 } },
                  { [`ageGroups.${k}.vacancy`]: { $exists: false } },
                  { [`ageGroups.${k}`]: { $exists: false } },
                ]),
              });
              console.log(
                "🔍 Filtering for vacancy = 0 or missing, groupKeys:",
                groupKeys
              );
            } else {
              // Default: Filter for vacancy > 0 (has vacancy)
              filter.$and.push({
                $or: groupKeys.map((k) => ({
                  [`ageGroups.${k}.vacancy`]: { $gt: 0 },
                })),
              });
              console.log(
                "🔍 Filtering for vacancy > 0, groupKeys:",
                groupKeys,
                "vacancy:",
                vacancy
              );
            }
          }
        }
      }

      // Program age filter (exact match list)
      // Accepts comma-separated list via querystring: programAge=a,b,c
      if (programAge) {
        const arr = Array.isArray(programAge)
          ? programAge
          : String(programAge)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        if (arr.length > 0) {
          filter.programAge = { $in: arr };
        }
      }

      // Features filter (can be array or string)
      if (features) {
        if (Array.isArray(features) && features.length > 0) {
          filter.features = { $in: features };
        } else if (typeof features === "string") {
          const featureArray = features.split(",").map((f) => f.trim());
          if (featureArray.length > 0) {
            filter.features = { $in: featureArray };
          }
        }
      }

      // Ward filter
      if (ward) {
        filter.$or = filter.$or || [];
        filter.$or.push(
          { ward: { $regex: ward, $options: "i" } },
          { city: { $regex: ward, $options: "i" } }
        );
      }

      // Daycare type filter
      if (daycareType) {
        filter.daycareType = { $regex: daycareType, $options: "i" };
      }

      // CWELCC filter
      if (cwelcc === "true" || cwelcc === true) {
        filter.cwelcc = true;
      }

      // Subsidy filter
      if (subsidy === "true" || subsidy === true) {
        filter.subsidyAvailable = true;
      }

      // Parse pagination parameters
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      // Debug: Log the filter being used
      console.log(
        "🔍 Final filter for search:",
        JSON.stringify(filter, null, 2)
      );

      // Debug: Count with only region filter (to compare with Excel)
      if (region) {
        const regionOnlyFilter = { region: { $regex: region, $options: "i" } };
        const regionOnlyCount = await Daycare.countDocuments(regionOnlyFilter);
        console.log(
          `🔍 Count with ONLY region="${region}" filter (no ageRange):`,
          regionOnlyCount
        );
      }

      // Get total count of matching documents
      const totalCount = await Daycare.countDocuments(filter);
      console.log(
        `🔍 Total count with ALL filters (region + ageRange + availability):`,
        totalCount
      );

      // Get paginated results
      const daycares = await Daycare.find(filter)
        .skip(skip)
        .limit(limitNum)
        .lean();

      // Debug: Log first daycare to see what we're returning
      if (daycares.length > 0) {
        const firstDaycare = daycares[0];
        console.log("🔍 BACKEND - First daycare from DB:", {
          name: firstDaycare.name,
          price: firstDaycare.price,
          priceType: typeof firstDaycare.price,
          priceString: firstDaycare.priceString,
          priceStringType: typeof firstDaycare.priceString,
          hasPriceString: !!firstDaycare.priceString,
          priceStringValue: firstDaycare.priceString,
          allFields: Object.keys(firstDaycare).filter(
            (k) => k.includes("price") || k.includes("Price")
          ),
        });

        // Log ALL fields to see what's actually in the database
        console.log(
          "📋 ALL FIELDS in first daycare:",
          Object.keys(firstDaycare).sort()
        );
      }

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limitNum);

      return {
        daycares,
        totalCount,
        currentPage: pageNum,
        totalPages,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update daycare
   * @param {string} id - Daycare ID
   * @param {Object} updateData - Update data
   * @returns {Object} Updated daycare
   */
  async updateDaycare(id, updateData) {
    try {
      const mongoose = require("mongoose");
      let daycare;

      if (mongoose.Types.ObjectId.isValid(id)) {
        daycare = await Daycare.findByIdAndUpdate(
          id,
          { ...updateData, updatedAt: new Date() },
          { new: true, runValidators: true }
        );
      } else {
        daycare = await Daycare.findOneAndUpdate(
          { id: id },
          { ...updateData, updatedAt: new Date() },
          { new: true, runValidators: true }
        );
      }

      if (!daycare) {
        throw new Error("Daycare not found");
      }

      return daycare.toObject();
    } catch (error) {
      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((e) => e.message);
        throw new Error(messages.join(", "));
      }
      throw error;
    }
  }

  /**
   * Delete daycare
   * @param {string} id - Daycare ID
   * @returns {boolean} Success status
   */
  async deleteDaycare(id) {
    try {
      const mongoose = require("mongoose");
      let result;

      if (mongoose.Types.ObjectId.isValid(id)) {
        result = await Daycare.findByIdAndDelete(id);
      } else {
        result = await Daycare.findOneAndDelete({ id: id });
      }

      return !!result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique locations
   * @returns {Array} Array of unique city names
   */
  async getAllLocations() {
    try {
      await this.ensureConnection();

      return await Daycare.getAllLocations();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get daycare statistics
   * @returns {Object} Statistics object
   */
  async getStats() {
    try {
      await this.ensureConnection();

      return await Daycare.getStats();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get vacancy statistics by age group for a specific region
   * Returns total number of available spots (sum of all vacancies)
   * @param {string} region - Region name (e.g., "Toronto")
   * @returns {Object} Total spots available by age group
   */
  async getVacancyStats(region) {
    try {
      await this.ensureConnection();

      // Find all daycares in the specified region
      const daycares = await Daycare.find({ region: { $regex: region, $options: "i" } }).lean();

      // Initialize counters - sum total spots, not daycares
      const stats = {
        infant: 0,
        toddler: 0,
        preschool: 0,
        kindergarten: 0,
        schoolAge: 0,
      };

      // Sum up total vacancy spots for each age group
      daycares.forEach((daycare) => {
        if (daycare.ageGroups) {
          // Infant - sum total vacancy spots
          if (
            daycare.ageGroups.infant &&
            daycare.ageGroups.infant.vacancy > 0
          ) {
            stats.infant += daycare.ageGroups.infant.vacancy;
          }

          // Toddler - sum total vacancy spots
          if (
            daycare.ageGroups.toddler &&
            daycare.ageGroups.toddler.vacancy > 0
          ) {
            stats.toddler += daycare.ageGroups.toddler.vacancy;
          }

          // Preschool - sum total vacancy spots
          if (
            daycare.ageGroups.preschool &&
            daycare.ageGroups.preschool.vacancy > 0
          ) {
            stats.preschool += daycare.ageGroups.preschool.vacancy;
          }

          // Kindergarten - sum total vacancy spots
          if (
            daycare.ageGroups.kindergarten &&
            daycare.ageGroups.kindergarten.vacancy > 0
          ) {
            stats.kindergarten += daycare.ageGroups.kindergarten.vacancy;
          }

          // School Age - sum total vacancy spots
          if (
            daycare.ageGroups.schoolAge &&
            daycare.ageGroups.schoolAge.vacancy > 0
          ) {
            stats.schoolAge += daycare.ageGroups.schoolAge.vacancy;
          }
        }
      });

      return {
        region: region,
        ...stats,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate daycare data
   * @param {Object} daycareData - Daycare data to validate
   * @returns {Array} Array of validation errors
   */
  validateDaycareData(daycareData) {
    const errors = [];

    if (!daycareData.name || daycareData.name.trim().length < 2) {
      errors.push("Daycare name must be at least 2 characters long");
    }

    if (!daycareData.city || daycareData.city.trim().length < 2) {
      errors.push("City must be at least 2 characters long");
    }

    if (!daycareData.address || daycareData.address.trim().length < 5) {
      errors.push("Address must be at least 5 characters long");
    }

    if (
      daycareData.price &&
      (isNaN(daycareData.price) || daycareData.price < 0)
    ) {
      errors.push("Price must be a valid positive number");
    }

    if (
      daycareData.rating &&
      (daycareData.rating < 0 || daycareData.rating > 5)
    ) {
      errors.push("Rating must be between 0 and 5");
    }

    return errors;
  }
}

module.exports = DaycareModel;
