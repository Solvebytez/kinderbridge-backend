const express = require("express");
const router = express.Router();

// GET /api/daycares - Get all daycares
router.get("/", async (req, res) => {
  try {
    const DaycareController = require("../controllers/daycareController");
    const daycareController = new DaycareController(req.db);

    const result = await daycareController.getAllDaycares();
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching daycares:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/daycares/search - Search daycares
router.get("/search", async (req, res) => {
  try {
    const DaycareController = require("../controllers/daycareController");
    const daycareController = new DaycareController(req.db);

    const result = await daycareController.searchDaycares(req.query);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error searching daycares:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/daycares/detail/:id - Get specific daycare
router.get("/detail/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const DaycareController = require("../controllers/daycareController");
    const daycareController = new DaycareController(req.db);

    const result = await daycareController.getDaycareById(id);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching daycare:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/daycares/locations - Get all unique locations
router.get("/locations/all", async (req, res) => {
  try {
    const DaycareController = require("../controllers/daycareController");
    const daycareController = new DaycareController(req.db);

    const result = await daycareController.getAllLocations();
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/daycares/regions/all - Get all unique regions
router.get("/regions/all", async (req, res) => {
  try {
    const DaycareController = require("../controllers/daycareController");
    const daycareController = new DaycareController(req.db);

    const result = await daycareController.getAllRegions();
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching regions:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/daycares/cities/all?region=... - Get cities for a region
router.get("/cities/all", async (req, res) => {
  try {
    const { region } = req.query;
    const DaycareController = require("../controllers/daycareController");
    const daycareController = new DaycareController(req.db);

    const result = await daycareController.getCitiesByRegion(region || "");
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/daycares/program-ages/all - Get all unique program ages
router.get("/program-ages/all", async (req, res) => {
  try {
    const DaycareController = require("../controllers/daycareController");
    const daycareController = new DaycareController(req.db);

    const result = await daycareController.getAllProgramAges();
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching program ages:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/daycares/types/all?region=...&city=... - Get distinct daycare types filtered by region and/or city
router.get("/types/all", async (req, res) => {
  try {
    const { region, city } = req.query;
    const DaycareController = require("../controllers/daycareController");
    const daycareController = new DaycareController(req.db);

    const result = await daycareController.getTypesByRegionAndCity(region || "", city || "");
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching types by region and city:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/daycares/stats - Get daycare statistics
router.get("/stats/overview", async (req, res) => {
  try {
    const DaycareController = require("../controllers/daycareController");
    const daycareController = new DaycareController(req.db);

    const result = await daycareController.getStats();
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/daycares/vacancy-stats?region=Toronto - Get vacancy statistics by age group (v14.0.0)
router.get("/vacancy-stats", async (req, res) => {
  try {
    const { region } = req.query;
    const DaycareController = require("../controllers/daycareController");
    const daycareController = new DaycareController(req.db);

    const result = await daycareController.getVacancyStats(region);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching vacancy stats:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;
