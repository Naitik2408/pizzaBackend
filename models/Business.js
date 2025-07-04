const mongoose = require('mongoose');

const BusinessSettingsSchema = new mongoose.Schema({
  // Business Profile Information
  businessInfo: {
    name: {
      type: String,
      required: true,
      default: 'Friends Pizza Hut',
      trim: true
    },
    address: {
      type: String,
      required: true,
      default: '123 Foodie Street, Flavor Town',
      trim: true
    },
    phone: {
      type: String,
      required: true,
      default: '+1-234-567-8900',
      trim: true
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true
    },
    hours: {
      monday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      tuesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      wednesday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      thursday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      friday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      saturday: { open: String, close: String, isOpen: { type: Boolean, default: true } },
      sunday: { open: String, close: String, isOpen: { type: Boolean, default: true } }
    },
    isCurrentlyOpen: {
      type: Boolean,
      default: true
    },
    manualOverride: {
      isActive: { type: Boolean, default: false },
      status: { type: Boolean, default: true }, // true = open, false = closed
      reason: { type: String, default: '' }
    }
  },
  
  // Payment Settings
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
    businessInfo: {
      name: 'Friends Pizza Hut',
      address: '123 Foodie Street, Flavor Town',
      phone: '+1-234-567-8900',
      email: 'contact@friendspizzahut.com',
      hours: {
        monday: { open: '11:00', close: '23:00', isOpen: true },
        tuesday: { open: '11:00', close: '23:00', isOpen: true },
        wednesday: { open: '11:00', close: '23:00', isOpen: true },
        thursday: { open: '11:00', close: '23:00', isOpen: true },
        friday: { open: '11:00', close: '23:00', isOpen: true },
        saturday: { open: '11:00', close: '23:00', isOpen: true },
        sunday: { open: '11:00', close: '23:00', isOpen: true }
      },
      isCurrentlyOpen: true,
      manualOverride: {
        isActive: false,
        status: true,
        reason: ''
      }
    },
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

// Method to check if business is currently open
BusinessSettingsSchema.methods.isBusinessOpen = function() {
  // Check manual override first
  if (this.businessInfo.manualOverride.isActive) {
    return this.businessInfo.manualOverride.status;
  }

  const now = new Date();
  const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
  const daySchedule = this.businessInfo.hours[currentDay];

  if (!daySchedule || !daySchedule.isOpen) {
    return false;
  }

  const currentTime = now.getHours() * 60 + now.getMinutes(); // Convert to minutes
  const openTime = this.parseTimeToMinutes(daySchedule.open);
  const closeTime = this.parseTimeToMinutes(daySchedule.close);

  // Handle overnight hours (e.g., open until 2 AM next day)
  if (closeTime < openTime) {
    return currentTime >= openTime || currentTime <= closeTime;
  }

  return currentTime >= openTime && currentTime <= closeTime;
};

// Helper method to parse time string to minutes
BusinessSettingsSchema.methods.parseTimeToMinutes = function(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Method to get business status with reason
BusinessSettingsSchema.methods.getBusinessStatus = function() {
  const isOpen = this.isBusinessOpen();
  let reason = '';

  if (this.businessInfo.manualOverride.isActive) {
    reason = this.businessInfo.manualOverride.reason || 
             (this.businessInfo.manualOverride.status ? 'Manually opened' : 'Manually closed');
  } else {
    const now = new Date();
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const daySchedule = this.businessInfo.hours[currentDay];
    
    if (!daySchedule || !daySchedule.isOpen) {
      reason = 'Closed today';
    } else if (isOpen) {
      reason = `Open until ${daySchedule.close}`;
    } else {
      reason = `Opens at ${daySchedule.open}`;
    }
  }

  return {
    isOpen,
    reason,
    manualOverride: this.businessInfo.manualOverride.isActive
  };
};

const BusinessSettings = mongoose.model('BusinessSettings', BusinessSettingsSchema);

module.exports = BusinessSettings;