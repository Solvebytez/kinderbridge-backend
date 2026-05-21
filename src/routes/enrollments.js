const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { authenticateN8nService } = require("../middleware/n8nAuth");

function getController(req) {
  const EnrollmentController = require("../controllers/enrollmentController");
  return new EnrollmentController(req.db);
}

// —— Parent (authenticated) ——

router.get("/mine", authenticateToken, async (req, res) => {
  try {
    const result = await getController(req).listMine(req.user.userId);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error listing enrollments:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get(
  "/by-application/:applicationId",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await getController(req).getByApplicationId(
        req.user.userId,
        req.params.applicationId
      );
      res.status(result.statusCode).json(result.body);
    } catch (error) {
      console.error("Error fetching enrollment:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/by-application/:applicationId",
  authenticateToken,
  async (req, res) => {
    try {
      const Application = require("../schemas/ApplicationSchema");
      const app = await Application.findById(req.params.applicationId).lean();
      if (!app || app.userId !== req.user.userId) {
        return res.status(404).json({ success: false, error: "Application not found" });
      }
      const draft = await getController(req).ensureDraftForApplication(
        req.user.userId,
        app
      );
      res.status(200).json({ success: true, data: draft });
    } catch (error) {
      console.error("Error ensuring enrollment draft:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.patch("/:id", authenticateToken, async (req, res) => {
  try {
    const result = await getController(req).patchPayload(
      req.user.userId,
      req.params.id,
      req.body?.payload ?? req.body
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error patching enrollment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/:id/validate", authenticateToken, async (req, res) => {
  try {
    const result = await getController(req).validate(
      req.user.userId,
      req.params.id
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error validating enrollment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/:id/queue-automation", authenticateToken, async (req, res) => {
  try {
    const result = await getController(req).queueAutomation(
      req.user.userId,
      req.params.id
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error queueing enrollment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// —— n8n service ——

router.post("/n8n/resolve-daycare", authenticateN8nService, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await getController(req).resolveDaycareByNameCityRegion({
      name: body.name,
      city: body.city,
      region: body.region,
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error resolving daycare:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/n8n/resolve-daycare", authenticateN8nService, async (req, res) => {
  try {
    const result = await getController(req).resolveForN8n(req.query);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error resolving daycare:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/n8n/payload/:id", authenticateN8nService, async (req, res) => {
  try {
    const result = await getController(req).n8nGetPayload(req.params.id);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching n8n payload:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/n8n/callback", authenticateN8nService, async (req, res) => {
  try {
    const result = await getController(req).n8nCallback(req.body || {});
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error processing n8n callback:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
