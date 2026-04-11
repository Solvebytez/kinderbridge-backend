const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");

// POST /api/applications - Create a new application
router.post("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const applicationData = req.body;

    const ApplicationController = require("../controllers/applicationController");
    const applicationController = new ApplicationController(req.db);

    const result = await applicationController.createApplication(
      userId,
      applicationData
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error creating application:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/applications - Get user's applications
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const ApplicationController = require("../controllers/applicationController");
    const applicationController = new ApplicationController(req.db);

    const result = await applicationController.getUserApplications(userId);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/applications/:id - Get application by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const ApplicationController = require("../controllers/applicationController");
    const applicationController = new ApplicationController(req.db);

    const result = await applicationController.getApplicationById(id, userId);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching application:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// PUT /api/applications/:id/status - Update application status
router.put("/:id/status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required",
      });
    }

    const ApplicationController = require("../controllers/applicationController");
    const applicationController = new ApplicationController(req.db);

    const result = await applicationController.updateApplicationStatus(
      id,
      status,
      userId
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error updating application status:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// DELETE /api/applications/:id - Delete an application
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const ApplicationController = require("../controllers/applicationController");
    const applicationController = new ApplicationController(req.db);

    const result = await applicationController.deleteApplication(id, userId);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error deleting application:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;



























