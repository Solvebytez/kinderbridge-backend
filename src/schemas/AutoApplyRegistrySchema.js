const mongoose = require("mongoose");

/**
 * Auto-apply registry — direct mirror of the processed Excel sheet (no DB matching).
 */
const autoApplyRegistrySchema = new mongoose.Schema(
  {
    excelRow: {
      type: Number,
      required: true,
    },
    name: { type: String, default: "", trim: true, index: true },
    region: { type: String, default: "", trim: true, index: true },
    city: { type: String, default: "", trim: true, index: true },
    address: { type: String, default: "", trim: true },
    cwelcc: { type: String, default: "", trim: true },
    subsidyAvailable: { type: String, default: "", trim: true },
    monthlyFee: { type: String, default: "", trim: true },
    registrationFee: { type: String, default: "", trim: true },
    daycareType: { type: String, default: "", trim: true },
    hoursOfOperation: { type: String, default: "", trim: true },
    programAge: { type: String, default: "", trim: true },
    infants: { type: String, default: "", trim: true },
    toddlers: { type: String, default: "", trim: true },
    preschoolers: { type: String, default: "", trim: true },
    schoolAge: { type: String, default: "", trim: true },
    googleReviews: { type: String, default: "", trim: true },
    googleReviewCount: { type: String, default: "", trim: true },
    googleReviewSummary: { type: String, default: "", trim: true },
    website: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    registrationInfo: { type: String, default: "", trim: true },
    formsLinkPrevious: { type: String, default: "", trim: true },
    contactUsPage: { type: String, default: "", trim: true },
    latitude: { type: String, default: "", trim: true },
    longitude: { type: String, default: "", trim: true },
    slug: { type: String, default: "", trim: true },
    formLinkExtracted: { type: String, default: "", trim: true },
    ifByEmail: { type: String, default: "", trim: true },
    ifByPhone: { type: String, default: "", trim: true },
    status: { type: String, default: "", trim: true, index: true },
    dataRequested: { type: String, default: "", trim: true },
    endpoint: { type: String, default: "", trim: true },
    remark: { type: String, default: "", trim: true },
    getEndpoint: { type: String, default: "", trim: true },
    postEndpoint: { type: String, default: "", trim: true },
    integrated: { type: String, default: "", trim: true },
    sourceFile: { type: String, default: "", trim: true },
  },
  {
    timestamps: true,
    collection: "auto_apply",
  }
);

autoApplyRegistrySchema.index({ sourceFile: 1, excelRow: 1 }, { unique: true });

let AutoApplyRegistry;
try {
  AutoApplyRegistry = mongoose.model("AutoApplyRegistry");
} catch {
  AutoApplyRegistry = mongoose.model("AutoApplyRegistry", autoApplyRegistrySchema);
}

module.exports = AutoApplyRegistry;
