const mongoose = require("mongoose");

const n8nMetaSchema = new mongoose.Schema(
  {
    runId: { type: String, default: null, trim: true },
    lastError: { type: String, default: null, trim: true },
    lastRunAt: { type: Date, default: null },
    queuedAt: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * Full daycare registration payload for n8n automation (stored in `payload`).
 */
const enrollmentSubmissionSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    daycareId: {
      type: String,
      required: true,
      index: true,
    },
    schemaVersion: {
      type: String,
      default: "20260521_v1",
      trim: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    completionStatus: {
      type: String,
      enum: ["not_started", "in_progress", "complete"],
      default: "not_started",
      index: true,
    },
    automationStatus: {
      type: String,
      enum: ["not_ready", "queued", "running", "submitted", "failed"],
      default: "not_ready",
      index: true,
    },
    n8n: {
      type: n8nMetaSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

enrollmentSubmissionSchema.index({ userId: 1, updatedAt: -1 });
enrollmentSubmissionSchema.index({ userId: 1, daycareId: 1 });

let EnrollmentSubmission;
try {
  EnrollmentSubmission = mongoose.model("EnrollmentSubmission");
} catch (error) {
  EnrollmentSubmission = mongoose.model(
    "EnrollmentSubmission",
    enrollmentSubmissionSchema
  );
}

module.exports = EnrollmentSubmission;
