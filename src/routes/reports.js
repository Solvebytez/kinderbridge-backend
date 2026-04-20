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

// Auto-apply: download only the daycares this user applied to (source=auto_apply).
router.get("/download/auto-apply", authenticateToken, async (req, res) => {
  try {
    const userEmail = req.user?.email || "user";
    const userId = String(req.user?.userId || "").trim();

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User ID missing from token",
      });
    }

    const Application = require("../schemas/ApplicationSchema");
    const mongoose = require("mongoose");
    const Daycare = require("../schemas/DaycareSchema");

    const apps = await Application.find({ userId, source: "auto_apply" })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const daycareIds = [...new Set((apps || []).map((a) => String(a.daycareId || "").trim()).filter(Boolean))];

    if (daycareIds.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No auto-apply daycares found for this user",
      });
    }

    const objectIds = daycareIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    const stringIds = daycareIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));

    const daycares = await Daycare.find({
      $or: [
        ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
        ...(stringIds.length > 0 ? [{ id: { $in: stringIds } }] : []),
      ],
    }).lean();

    // Keep the PDF order in the same order as applications (latest-first unique list).
    const daycareByKey = new Map();
    for (const d of daycares) {
      const key = String(d?._id || d?.id || "");
      if (key) daycareByKey.set(key, d);
    }
    const ordered = daycareIds.map((id) => daycareByKey.get(id)).filter(Boolean);

    const pdfBuffer = await generateDaycareReportPDF(ordered, userEmail, {
      title: "Your Auto-Apply Daycare List",
    });

    const fileName = `auto-apply-daycares-${new Date().toISOString().split("T")[0]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("Error generating auto-apply PDF:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate auto-apply PDF",
      message: error.message,
    });
  }
});

module.exports = router;

