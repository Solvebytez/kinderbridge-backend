const mongoose = require("mongoose");

/**
 * Daycare Schema
 */
const contactSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      default: "NO",
    },
    email: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "NO",
    },
  },
  { _id: false }
);

const coordinatesSchema = new mongoose.Schema(
  {
    lat: {
      type: Number,
      default: 0,
    },
    lng: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const ageGroupSchema = new mongoose.Schema(
  {
    capacity: {
      type: Number,
      default: 0,
      min: 0,
    },
    vacancy: {
      type: Number,
      default: 0,
      min: 0,
    },
    qualityRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
  },
  { _id: false }
);

const daycareSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Daycare name is required"],
      trim: true,
      minlength: [2, "Daycare name must be at least 2 characters long"],
      index: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      index: true,
    },
    region: {
      type: String,
      default: "NO",
      trim: true,
      index: true,
    },
    ward: {
      type: String,
      default: "NO",
      trim: true,
      index: true,
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
      minlength: [5, "Address must be at least 5 characters long"],
    },
    phone: {
      type: String,
      default: "NO",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    website: {
      type: String,
      default: "NO",
      trim: true,
    },
    contactUsPage: {
      type: String,
      default: "NO",
      trim: true,
    },
    formsLink: {
      type: String,
      default: "NO",
      trim: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"],
      index: true,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    googleReviewSummary: {
      type: String,
      default: "NO",
      trim: true,
    },
    price: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
      index: true,
    },
    registrationFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    availability: {
      type: String,
      default: "Available",
      index: true,
    },
    ageRange: {
      type: String,
      default: "NO",
      index: true,
    },
    daycareType: {
      type: String,
      default: "NO",
      trim: true,
      index: true,
    },
    cwelcc: {
      type: Boolean,
      default: false,
      index: true,
    },
    subsidyAvailable: {
      type: Boolean,
      default: false,
      index: true,
    },
    programAge: {
      type: String,
      default: "NO",
      trim: true,
      index: true,
    },
    ageGroups: {
      infant: { type: ageGroupSchema, default: () => ({}) },
      toddler: { type: ageGroupSchema, default: () => ({}) },
      preschool: { type: ageGroupSchema, default: () => ({}) },
      kindergarten: { type: ageGroupSchema, default: () => ({}) },
      schoolAge: { type: ageGroupSchema, default: () => ({}) },
    },
    features: {
      type: [String],
      default: [],
      index: true,
    },
    description: {
      type: String,
      default: "NO",
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    contact: {
      type: contactSchema,
      default: () => ({}),
    },
    coordinates: {
      type: coordinatesSchema,
      default: () => ({ lat: 0, lng: 0 }),
    },
    // Additional fields from setup-mongodb.js
    priceString: {
      type: String,
      default: "NO",
    },
    reviews: {
      type: Number,
      default: 0,
    },
    distance: {
      type: Number,
      default: 0,
    },
    hours: {
      type: String,
      default: "NO",
    },
    capacity: {
      type: Number,
      default: 0,
    },
    registrationInfo: {
      type: String,
      default: "NO",
      trim: true,
    },
    languages: {
      type: [String],
      default: [],
    },
    specialNeeds: {
      type: Boolean,
      default: false,
    },
    transportation: {
      type: Boolean,
      default: false,
    },
    meals: {
      type: Boolean,
      default: false,
    },
    napTime: {
      type: Boolean,
      default: false,
    },
    outdoorSpace: {
      type: Boolean,
      default: false,
    },
    security: {
      type: [String],
      default: [],
    },
    certifications: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'daycares_master',
  }
);

// Text index for search
daycareSchema.index({
  name: "text",
  description: "text",
  features: "text",
  city: "text",
  region: "text",
  ward: "text",
  address: "text",
  daycareType: "text",
});

// Compound indexes for common queries
daycareSchema.index({ city: 1, rating: -1 });
daycareSchema.index({ city: 1, price: 1 });
daycareSchema.index({ availability: 1, city: 1 });
daycareSchema.index({ region: 1, city: 1 });
daycareSchema.index({ subsidyAvailable: 1, city: 1 });
daycareSchema.index({ cwelcc: 1, city: 1 });

// Static method to get all locations
daycareSchema.statics.getAllLocations = async function () {
  const locations = await this.distinct("city");
  return locations.sort();
};

// Static method to get statistics
daycareSchema.statics.getStats = async function () {
  const totalDaycares = await this.countDocuments();

  const ratingStats = await this.aggregate([
    { $group: { _id: null, avgRating: { $avg: "$rating" } } },
  ]);

  const locations = await this.distinct("city");

  const stats = {
    totalDaycares,
    averageRating:
      ratingStats.length > 0
        ? Math.round(ratingStats[0].avgRating * 100) / 100
        : 0,
    locations: locations.length,
    availability: {
      total: totalDaycares,
      fullTime: await this.countDocuments({
        availability: { $regex: /full-time/i },
      }),
      partTime: await this.countDocuments({
        availability: { $regex: /part-time/i },
      }),
      dropIn: await this.countDocuments({
        availability: { $regex: /drop-in/i },
      }),
    },
  };

  return stats;
};

// Export model (check if already compiled to avoid recompilation errors)
let Daycare;
try {
  Daycare = mongoose.model("Daycare");
} catch (error) {
  Daycare = mongoose.model("Daycare", daycareSchema);
}

module.exports = Daycare;
