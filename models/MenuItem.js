const mongoose = require('mongoose');

// Define a schema for size variations
const sizeVariationSchema = new mongoose.Schema({
  size: {
    type: String,
    enum: ['Small', 'Medium', 'Large', 'Not Applicable'],
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  available: {
    type: Boolean,
    default: true
  }
}, { _id: false });

// Define a schema for size-specific pricing in add-ons
const sizePricingSchema = new mongoose.Schema({
  size: {
    type: String,
    enum: ['Small', 'Medium', 'Large', 'Not Applicable'],
    required: true
  },
  price: {
    type: Number,
    required: true
  }
}, { _id: false });

// Define a schema for add-ons
const addOnSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  available: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  hasSizeSpecificPricing: {
    type: Boolean,
    default: false
  },
  sizePricing: {
    type: [sizePricingSchema],
    default: []
  }
}, { _id: false });

// Define a schema for add-on groups
const addOnGroupSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  minSelection: {
    type: Number,
    default: 0
  },
  maxSelection: {
    type: Number,
    default: 1
  },
  required: {
    type: Boolean,
    default: false
  },
  addOns: {
    type: [addOnSchema],
    default: []
  }
}, { _id: false });

const menuItemSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    // Base price (for single size items or display purposes)
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      enum: [
        'Pizza', 
        'Burger', 
        'Grilled Sandwich', 
        'Special Combo', 
        'Pasta', 
        'Noodles', 
        'Snacks', 
        'Milkshake', 
        'Cold Drink', 
        'Rice Item', 
        'Sweets',
        'Sides'
      ],
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    available: {
      type: Boolean,
      default: true,
    },
    popular: {
      type: Boolean,
      default: false,
    },
    foodType: {
      type: String,
      enum: ['Veg', 'Non-Veg', 'Not Applicable'],
      default: 'Not Applicable',
      required: true,
    },
    isVeg: {
      type: Boolean,
      default: false,
    },
    // Explicit field to track size type (single or multiple)
    sizeType: {
      type: String,
      enum: ['single', 'multiple'],
      default: 'single'
    },
    // Original size field (used for single-size items)
    size: {
      type: String,
      enum: ['Small', 'Medium', 'Large', 'Not Applicable'],
      default: 'Medium',
    },
    // Array of size variations for multiple-size items
    sizeVariations: {
      type: [sizeVariationSchema],
      default: [],
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    // Flag to indicate if this item has multiple sizes
    hasMultipleSizes: {
      type: Boolean,
      default: false
    },
    // Add customization fields
    hasAddOns: {
      type: Boolean,
      default: false
    },
    addOnGroups: {
      type: [addOnGroupSchema],
      default: []
    }
  },
  { 
    timestamps: true,
    // Enable virtuals when converting to JSON
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Performance indexes for optimized queries
menuItemSchema.index({ name: 'text', description: 'text', category: 'text' }); // Text search
menuItemSchema.index({ category: 1, available: 1 }); // Category filter with availability
menuItemSchema.index({ foodType: 1, available: 1 }); // Food type filter with availability
menuItemSchema.index({ price: 1 }); // Price sorting
menuItemSchema.index({ popular: -1, rating: -1, available: 1 }); // Popular items
menuItemSchema.index({ available: 1, popular: -1, rating: -1 }); // Available popular items
menuItemSchema.index({ createdAt: -1 }); // Newest items
menuItemSchema.index({ rating: -1, ratingCount: -1 }); // Best rated items
menuItemSchema.index({ sizeType: 1, available: 1 }); // Size type filter
menuItemSchema.index({ 'sizeVariations.size': 1, available: 1 }); // Size variation queries

// Pre-save hook to ensure data consistency
menuItemSchema.pre('save', function(next) {
  // Set hasMultipleSizes based on sizeType
  this.hasMultipleSizes = this.sizeType === 'multiple';
  
  // If this is single size, clear any size variations to avoid confusion
  if (this.sizeType === 'single') {
    this.sizeVariations = [];
  }
  
  // If multiple size but no variations, add a default one
  if (this.sizeType === 'multiple' && (!this.sizeVariations || this.sizeVariations.length === 0)) {
    this.sizeVariations = [{
      size: this.size || 'Medium',
      price: this.price,
      available: this.available
    }];
  }
  
  // Keep isVeg in sync with foodType
  this.isVeg = this.foodType === 'Veg';
  
  next();
});

// Hook to run before findOneAndUpdate to handle sizeType changes
menuItemSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // If changing to single size, clear size variations
  if (update.sizeType === 'single') {
    update.sizeVariations = [];
    update.hasMultipleSizes = false;
  }
  
  // If changing to multiple size, ensure hasMultipleSizes is true
  if (update.sizeType === 'multiple') {
    update.hasMultipleSizes = true;
  }
  
  // Keep isVeg in sync with foodType
  if (update.foodType) {
    update.isVeg = update.foodType === 'Veg';
  }
  
  next();
});

// Virtual getter for base price based on size type
menuItemSchema.virtual('basePrice').get(function() {
  if (this.sizeType === 'single') {
    return this.price;
  } else if (this.sizeVariations && this.sizeVariations.length > 0) {
    // For multiple-size items, use the smallest size as base price
    // or just the first size if sorting isn't necessary
    return this.sizeVariations[0].price;
  }
  return this.price; // Fallback
});

// Virtual getter for backward compatibility
menuItemSchema.virtual('isVegItem').get(function() {
  return this.foodType === 'Veg';
});

// Virtual getter to get the default size
menuItemSchema.virtual('defaultSize').get(function() {
  if (this.sizeType === 'single') {
    return this.size;
  } else if (this.sizeVariations && this.sizeVariations.length > 0) {
    return this.sizeVariations[0].size;
  }
  return 'Medium'; // Fallback
});

// Virtual for available sizes (useful for frontend)
menuItemSchema.virtual('availableSizes').get(function() {
  if (this.sizeType === 'single') {
    return [this.size];
  } else if (this.sizeVariations && this.sizeVariations.length > 0) {
    return this.sizeVariations
      .filter(v => v.available)
      .map(v => v.size);
  }
  return [];
});

module.exports = mongoose.model('MenuItem', menuItemSchema);