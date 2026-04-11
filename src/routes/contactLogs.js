const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");

// POST /api/contact-logs - Create a new contact log
router.post("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const contactLogData = req.body;

    const ContactLogController = require("../controllers/contactLogController");
    const contactLogController = new ContactLogController(req.db);

    const result = await contactLogController.createContactLog(
      userId,
      contactLogData
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error creating contact log:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/contact-logs - Get user's contact logs
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const ContactLogController = require("../controllers/contactLogController");
    const contactLogController = new ContactLogController(req.db);

    const result = await contactLogController.getUserContactLogs(userId);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching contact logs:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// GET /api/contact-logs/daycare/:daycareId - Get contact logs for a specific daycare
router.get("/daycare/:daycareId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { daycareId } = req.params;

    const ContactLogController = require("../controllers/contactLogController");
    const contactLogController = new ContactLogController(req.db);

    const result = await contactLogController.getDaycareContactLogs(
      userId,
      daycareId
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error fetching daycare contact logs:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// PUT /api/contact-logs/:id - Update a contact log
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const updateData = req.body;

    const ContactLogController = require("../controllers/contactLogController");
    const contactLogController = new ContactLogController(req.db);

    const result = await contactLogController.updateContactLog(
      userId,
      id,
      updateData
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error updating contact log:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

// DELETE /api/contact-logs/:id - Delete a contact log
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const ContactLogController = require("../controllers/contactLogController");
    const contactLogController = new ContactLogController(req.db);

    const result = await contactLogController.deleteContactLog(userId, id);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error deleting contact log:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;



























