const mongoose = require('mongoose');

const offerSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    description: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: null,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    applicableItems: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'MenuItem',
      default: [],
    },
    applicableCategories: {
      type: [String],
      default: [],
    },
    restrictedToUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    isNewUserOffer: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Virtual method to check if an offer is still valid
offerSchema.virtual('isValid').get(function () {
  const now = new Date();
  return (
    this.active &&
    now >= this.validFrom &&
    now <= this.validUntil &&
    (this.usageLimit === null || this.usageCount < this.usageLimit)
  );
});

// Method to format the discount for display
offerSchema.virtual('formattedDiscount').get(function () {
  if (this.discountType === 'percentage') {
    return `${this.discountValue}%`;
  } else {
    return `₹${this.discountValue}`;
  }
});

module.exports = mongoose.model('Offer', offerSchema);