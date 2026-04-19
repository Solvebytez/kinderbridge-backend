const mongoose = require('mongoose');

/**
 * Purchase Schema
 * Purchase/transaction records
 */
const purchaseSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  daycareId: {
    type: String,
    default: null,
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  currency: {
    type: String,
    default: 'CAD',
    uppercase: true
  },
  status: {
    type: String,
    required: true,
    enum: {
      values: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
      message: 'Status must be one of: pending, completed, failed, refunded, cancelled'
    },
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    default: null
  },
  stripePaymentId: {
    type: String,
    default: null,
    index: true
  },
  /** Same as Stripe PaymentIntent id; kept for legacy DB unique index `paymentIntentId_1`. */
  paymentIntentId: {
    type: String,
    default: null,
    sparse: true,
    index: true,
  },
  paymentType: {
    type: String,
    default: "report",
    trim: true,
    index: true,
  },
  daycareIds: {
    type: [String],
    default: [],
  },
  creditsGranted: {
    type: Number,
    default: 0,
    min: 0,
  },
  processedAt: {
    type: Date,
    default: null,
  },
  webhookEventId: {
    type: String,
    default: null,
    index: true,
  },
  description: {
    type: String,
    default: null,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for common queries
purchaseSchema.index({ userId: 1, createdAt: -1 });
purchaseSchema.index({ daycareId: 1, createdAt: -1 });
purchaseSchema.index({ status: 1, createdAt: -1 });
purchaseSchema.index({ userId: 1, stripePaymentId: 1 });

// Static method to get user purchases
purchaseSchema.statics.getUserPurchases = async function(userId, options = {}) {
  const { limit = 50, skip = 0, status } = options;
  
  let filter = { userId };
  if (status) {
    filter.status = status;
  }
  
  return await this.find(filter)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();
};

// Static method to get daycare purchases
purchaseSchema.statics.getDaycarePurchases = async function(daycareId, options = {}) {
  const { limit = 50, skip = 0, status } = options;
  
  let filter = { daycareId };
  if (status) {
    filter.status = status;
  }
  
  return await this.find(filter)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();
};

// Static method to get statistics
purchaseSchema.statics.getStats = async function(userId = null, daycareId = null) {
  let filter = {};
  if (userId) filter.userId = userId;
  if (daycareId) filter.daycareId = daycareId;

  const total = await this.countDocuments(filter);
  
  const statusStats = await this.aggregate([
    { $match: filter },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const revenueStats = await this.aggregate([
    { $match: { ...filter, status: 'completed' } },
    { $group: { _id: null, totalRevenue: { $sum: '$amount' }, avgAmount: { $avg: '$amount' } } }
  ]);

  const stats = {
    total,
    byStatus: {},
    totalRevenue: revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0,
    averageAmount: revenueStats.length > 0 ? revenueStats[0].avgAmount : 0
  };

  statusStats.forEach(stat => {
    stats.byStatus[stat._id] = stat.count;
  });

  return stats;
};

// Export model (check if already compiled to avoid recompilation errors)
let Purchase;
try {
  Purchase = mongoose.model('Purchase');
} catch (error) {
  Purchase = mongoose.model('Purchase', purchaseSchema);
}

module.exports = Purchase;

