const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { generateDaycareReportPDF } = require("../services/pdfGenerator");

router.get("/download", authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user?.email || "user";

    const DaycareModel = require("../models/Daycare");
    const daycareModel = new DaycareModel(req.db);

    // Generate a deterministic "Top 30" list (highest rating first, then name).
    // If rating is missing, it sorts lower.
    const all = await daycareModel.getAllDaycares();
    const daycares = (Array.isArray(all) ? all : [])
      .slice()
      .sort((a, b) => {
        const ar = Number(a?.rating ?? -1);
        const br = Number(b?.rating ?? -1);
        if (br !== ar) return br - ar;
        const an = String(a?.name || "");
        const bn = String(b?.name || "");
        return an.localeCompare(bn);
      })
      .slice(0, 30);

    const pdfBuffer = await generateDaycareReportPDF(daycares, userEmail);

    const fileName = `daycare-full-report-${new Date().toISOString().split("T")[0]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("Error generating report PDF:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate report PDF",
      message: error.message,
    });
  }
});

module.exports = router;

