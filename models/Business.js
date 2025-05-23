const mongoose = require('mongoose');

const BusinessSettingsSchema = new mongoose.Schema({
  upiId: {
    type: String,
    required: true,
    trim: true
  },
  bankDetails: {
    accountName: {
      type: String,
      required: true,
      trim: true
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true
    },
    ifscCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    bankName: {
      type: String,
      required: true,
      trim: true
    }
  },
  deliveryCharges: {
    fixedCharge: {
      type: Number,
      required: true,
      default: 40,
      min: 0
    },
    freeDeliveryThreshold: {
      type: Number,
      required: true,
      default: 500,
      min: 0
    },
    applyToAllOrders: {
      type: Boolean,
      required: true,
      default: false
    }
  },
  taxSettings: {
    gstPercentage: {
      type: Number,
      required: true,
      default: 5,
      min: 0,
      max: 28
    },
    applyGST: {
      type: Boolean,
      required: true,
      default: true
    }
  },
  minimumOrderValue: {
    type: Number,
    required: true,
    default: 200,
    min: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Use singleton pattern - there should only be one business settings document
BusinessSettingsSchema.statics.findOrCreate = async function(updateData = {}, userId) {
  const settings = await this.findOne();
  
  if (settings) {
    // Update existing settings if update data is provided
    if (Object.keys(updateData).length > 0) {
      // Handle migration from old delivery charge structure if needed
      if (updateData.deliveryCharges) {
        const oldDeliveryCharges = settings.deliveryCharges;
        
        // If the update data doesn't have the new structure but the old exists
        if (oldDeliveryCharges.baseCharge !== undefined && 
            oldDeliveryCharges.perKmCharge !== undefined && 
            !updateData.deliveryCharges.hasOwnProperty('applyToAllOrders')) {
          
          updateData.deliveryCharges = {
            fixedCharge: updateData.deliveryCharges.baseCharge || oldDeliveryCharges.baseCharge,
            freeDeliveryThreshold: updateData.deliveryCharges.freeDeliveryThreshold || oldDeliveryCharges.freeDeliveryThreshold,
            applyToAllOrders: false
          };
        }
      }
      
      Object.assign(settings, updateData);
      settings.lastUpdated = Date.now();
      settings.updatedBy = userId;
      await settings.save();
    }
    return settings;
  }
  
  // Create with default values if no record exists
  const defaultSettings = {
    upiId: 'pizzashop@okaxis',
    bankDetails: {
      accountName: 'Pizza Shop',
      accountNumber: '1234567890',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank of India'
    },
    deliveryCharges: {
      fixedCharge: 40,
      freeDeliveryThreshold: 500,
      applyToAllOrders: false
    },
    taxSettings: {
      gstPercentage: 5,
      applyGST: true
    },
    minimumOrderValue: 200,
    updatedBy: userId
  };
  
  // Apply any update data on top of defaults
  const initialSettings = { ...defaultSettings, ...updateData };
  return this.create(initialSettings);
};

// Method to calculate delivery charge based on order total
BusinessSettingsSchema.methods.calculateDeliveryCharge = function(orderTotal) {
  const { fixedCharge, freeDeliveryThreshold, applyToAllOrders } = this.deliveryCharges;
  
  // If delivery charge applies to all orders, return the fixed charge
  if (applyToAllOrders) {
    return fixedCharge;
  }
  
  // Otherwise, check if order exceeds the free delivery threshold
  return orderTotal >= freeDeliveryThreshold ? 0 : fixedCharge;
};

// Method to calculate tax amount
BusinessSettingsSchema.methods.calculateTax = function(subtotal) {
  const { gstPercentage, applyGST } = this.taxSettings;
  
  if (!applyGST) {
    return 0;
  }
  
  return (subtotal * gstPercentage) / 100;
};

const BusinessSettings = mongoose.model('BusinessSettings', BusinessSettingsSchema);

module.exports = BusinessSettings;