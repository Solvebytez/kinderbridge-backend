const express = require("express");
const router = express.Router();
const { authenticateN8nService } = require("../middleware/n8nAuth");

function getController(req) {
  const EnrollmentController = require("../controllers/enrollmentController");
  return new EnrollmentController(req.db);
}

/** n8n: fetch enrollment_form_queue by queue id or enrollment submission id */
router.get("/:id", authenticateN8nService, async (req, res) => {
  try {
    const result = await getController(req).n8nGetFormQueue(req.params.id);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching enrollment queue:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
