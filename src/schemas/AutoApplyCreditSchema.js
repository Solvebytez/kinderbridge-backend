const mongoose = require("mongoose");

const creditGrantSchema = new mongoose.Schema(
  {
    credits: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
    },
    paymentReference: {
      type: String,
      trim: true,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: null,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * Stores purchased auto-apply credits per user.
 * One payment can grant up to 30 credits, and credits are consumed on submission.
 */
const autoApplyCreditSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
      unique: true,
      index: true,
    },
    totalCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingCredits: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    grants: {
      type: [creditGrantSchema],
      default: [],
    },
    lastCreditGrantAt: {
      type: Date,
      default: null,
    },
    lastCreditUsageAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

autoApplyCreditSchema.index({ userId: 1, remainingCredits: 1 });

let AutoApplyCredit;
try {
  AutoApplyCredit = mongoose.model("AutoApplyCredit");
} catch (error) {
  AutoApplyCredit = mongoose.model("AutoApplyCredit", autoApplyCreditSchema);
}

module.exports = AutoApplyCredit;
