const mongoose = require("mongoose");

/**
 * Application Schema
 * User applications to daycares
 */
const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
      index: true,
    },
    daycareId: {
      type: String,
      required: [true, "Daycare ID is required"],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "accepted", "rejected", "withdrawn"],
        message:
          "Status must be one of: pending, accepted, rejected, withdrawn",
      },
      default: "pending",
      index: true,
    },
    // Child information
    childAge: {
      type: String,
      required: [true, "Child age is required"],
      trim: true,
    },
    daycareType: {
      type: String,
      required: [true, "Daycare type is required"],
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    maxMonthlyFee: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    // Parent/Guardian information
    parentName: {
      type: String,
      required: [true, "Parent name is required"],
      trim: true,
    },
    parentEmail: {
      type: String,
      required: [true, "Parent email is required"],
      lowercase: true,
      trim: true,
    },
    parentPhone: {
      type: String,
      trim: true,
    },
    additionalNotes: {
      type: String,
      trim: true,
      maxlength: [1000, "Additional notes cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
applicationSchema.index({ userId: 1, createdAt: -1 });
applicationSchema.index({ daycareId: 1, createdAt: -1 });
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ userId: 1, daycareId: 1 });

// Static method to create application
applicationSchema.statics.createApplication = async function (applicationData) {
  try {
    const application = await this.create(applicationData);
    return application;
  } catch (error) {
    throw error;
  }
};

// Static method to get user applications with daycare details
applicationSchema.statics.getUserApplications = async function (userId) {
  try {
    const applications = await this.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Get daycare details for each application - lazy load Daycare schema
    let Daycare;
    try {
      Daycare = mongoose.model("Daycare");
    } catch (error) {
      // If Daycare model is not registered, require the schema to register it
      require("./DaycareSchema");
      Daycare = mongoose.model("Daycare");
    }

    const daycareIds = applications.map((app) => app.daycareId);

    const daycares = await Daycare.find({
      $or: [
        {
          _id: {
            $in: daycareIds
              .filter((id) => mongoose.Types.ObjectId.isValid(id))
              .map((id) => new mongoose.Types.ObjectId(id)),
          },
        },
        { id: { $in: daycareIds } },
      ],
    }).lean();

    // Map applications with daycare data
    return applications.map((app) => {
      const daycare = daycares.find(
        (d) => d._id?.toString() === app.daycareId || d.id === app.daycareId
      );

      return {
        ...app,
        daycare: daycare || null,
      };
    });
  } catch (error) {
    throw error;
  }
};

// Static method to get application by ID
applicationSchema.statics.getApplicationById = async function (applicationId) {
  try {
    const application = await this.findById(applicationId).lean();

    if (!application) {
      throw new Error("Application not found");
    }

    // Get daycare details - lazy load Daycare schema
    let Daycare;
    try {
      Daycare = mongoose.model("Daycare");
    } catch (error) {
      // If Daycare model is not registered, require the schema to register it
      require("./DaycareSchema");
      Daycare = mongoose.model("Daycare");
    }

    let daycare = null;

    if (mongoose.Types.ObjectId.isValid(application.daycareId)) {
      daycare = await Daycare.findById(application.daycareId).lean();
    } else {
      daycare = await Daycare.findOne({ id: application.daycareId }).lean();
    }

    return {
      ...application,
      daycare: daycare || null,
    };
  } catch (error) {
    throw error;
  }
};

// Static method to update application status
applicationSchema.statics.updateApplicationStatus = async function (
  applicationId,
  status,
  userId
) {
  try {
    const application = await this.findById(applicationId);

    if (!application) {
      throw new Error("Application not found");
    }

    // Only allow user to update their own application, or allow status updates by admins
    if (application.userId !== userId) {
      throw new Error("Unauthorized to update this application");
    }

    application.status = status;
    await application.save();

    return application;
  } catch (error) {
    throw error;
  }
};

// Static method to delete application
applicationSchema.statics.deleteApplication = async function (
  applicationId,
  userId
) {
  try {
    const result = await this.findOneAndDelete({
      _id: applicationId,
      userId, // Ensure user owns the application
    });
    return result;
  } catch (error) {
    throw error;
  }
};

// Export model (check if already compiled to avoid recompilation errors)
let Application;
try {
  Application = mongoose.model("Application");
} catch (error) {
  Application = mongoose.model("Application", applicationSchema);
}

module.exports = Application;



























