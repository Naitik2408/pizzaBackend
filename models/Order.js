const mongoose = require('mongoose');

// Schema for customization options (add-ons, toppings, etc.)
const customizationSchema = new mongoose.Schema({
  name: { 
    type: String,
    required: true 
  },
  option: { 
    type: String 
  },
  price: { 
    type: Number,
    default: 0
  }
}, { _id: false });

const orderSchema = mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderNumber: {
      type: String,
      unique: true,
      index: true, // Index for faster search by order number
    },
    customerName: {
      type: String,
      required: true,
      index: true, // Index for faster search by customer name
    },
    items: [
      {
        menuItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
        },
        name: { type: String, required: true, index: true }, // Index for faster search by item name
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        size: { type: String, enum: ['Small', 'Medium', 'Large', 'Not Applicable'] },
        foodType: { type: String, enum: ['Veg', 'Non-Veg', 'Not Applicable'] },
        image: { type: String }, // Add image field for menu item images
        // Original customizations field (keeping for backward compatibility)
        customizations: [customizationSchema],
        // New fields for the enhanced customization system
        addOns: [customizationSchema],        // For add-ons like extra cheese, sauces, etc.
        toppings: [customizationSchema],      // For pizza toppings
        specialInstructions: { type: String }, // For any special requests
        // Base item price before customizations
        basePrice: { type: Number },
        // Total price after all customizations (basePrice + all add-ons)
        totalItemPrice: { type: Number }
      },
    ],
    status: {
      type: String,
      enum: ['Pending', 'Preparing', 'Out for delivery', 'Delivered', 'Cancelled'],
      default: 'Pending',
      index: true, // Index for faster search and filtering by status
    },
    statusUpdates: [
      {
        status: { type: String },
        time: { type: Date, default: Date.now },
        note: { type: String }
      }
    ],
    deliveryAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    deliveryAgentName: {
      type: String,
      default: 'Unassigned'
    },
    date: { type: Date, default: Date.now },
    time: { 
      type: String,
      default: function() {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      }
    },
    amount: { type: Number, required: true },
    address: { 
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      landmark: { type: String }
    },
    fullAddress: {
      type: String,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['Online', 'Cash on Delivery'],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
      default: 'Pending',
    },
    paymentDetails: {
      orderId: { type: String }, // Payment gateway order ID
      paymentId: { type: String }, // Payment gateway payment ID
      signature: { type: String } // Payment gateway signature
    },
    customerPhone: { type: String, required: true, index: true }, // Index for faster search by phone number
    notes: { type: String },
    estimatedDeliveryTime: { type: Date },
    totalItemsCount: { 
      type: Number,
      default: function() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
      }
    },
    discounts: {
      code: { type: String },
      amount: { type: Number, default: 0 },
      percentage: { type: Number },
      description: { type: String } // Added description for discount details
    },
    subTotal: { type: Number }, // Amount before tax, delivery fee, discounts
    tax: { type: Number, default: 0 },
    taxPercentage: { type: Number, default: 0 }, // Store the tax percentage applied
    deliveryFee: { type: Number, default: 0 },
    // Business settings applied at the time of order
    appliedBusinessSettings: {
      taxSettings: {
        gstPercentage: { type: Number },
        applyGST: { type: Boolean }
      },
      deliveryCharges: {
        fixedCharge: { type: Number },
        freeDeliveryThreshold: { type: Number },
        applyToAllOrders: { type: Boolean }
      },
      minimumOrderValue: { type: Number }
    }
  },
  { timestamps: true }
);

// Generate unique order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Count orders for today to generate sequential number
    const todayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    
    const todayOrdersCount = await mongoose.models.Order.countDocuments({
      createdAt: { $gte: todayStart, $lt: todayEnd }
    });
    
    const dailySequence = (todayOrdersCount + 1).toString().padStart(3, '0');
    
    // Generate a unique order number: PZ + YYYYMMDD + DailySequence
    // Example: PZ202407040001, PZ202407040002, etc.
    this.orderNumber = `PZ${year}${month}${day}${dailySequence}`;
    
    // Add initial status update
    if (!this.statusUpdates || this.statusUpdates.length === 0) {
      this.statusUpdates = [{
        status: this.status,
        time: date,
        note: 'Order created'
      }];
    }
    
    // Format the full address for easier display
    if (this.address && !this.fullAddress) {
      this.fullAddress = `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}`;
    }

    // Calculate total item price for each item if not already set
    this.items.forEach(item => {
      if (!item.totalItemPrice) {
        // Basic calculation: base price or item price
        let itemTotal = item.basePrice || item.price;
        
        // Add prices from customizations
        if (item.customizations && item.customizations.length) {
          itemTotal += item.customizations.reduce((sum, custom) => sum + (custom.price || 0), 0);
        }
        
        // Add prices from add-ons
        if (item.addOns && item.addOns.length) {
          itemTotal += item.addOns.reduce((sum, addon) => sum + (addon.price || 0), 0);
        }
        
        // Add prices from toppings
        if (item.toppings && item.toppings.length) {
          itemTotal += item.toppings.reduce((sum, topping) => sum + (topping.price || 0), 0);
        }
        
        // Set the calculated total
        item.totalItemPrice = itemTotal;
      }
    });
    
    // Calculate subtotal if not set
    if (!this.subTotal) {
      this.subTotal = this.items.reduce((sum, item) => sum + (item.totalItemPrice || item.price) * item.quantity, 0);
    }
    
    // Calculate tax based on business settings if available
    if (!this.tax && this.subTotal) {
      // Use applied business settings if available, otherwise default to 5%
      let taxRate = 0.05; // Default 5%
      
      if (this.appliedBusinessSettings && 
          this.appliedBusinessSettings.taxSettings && 
          this.appliedBusinessSettings.taxSettings.applyGST) {
        taxRate = (this.appliedBusinessSettings.taxSettings.gstPercentage || 5) / 100;
        this.taxPercentage = this.appliedBusinessSettings.taxSettings.gstPercentage || 5;
      } else {
        this.taxPercentage = 5; // Default 5%
      }
      
      this.tax = Math.round(this.subTotal * taxRate * 100) / 100;
    }
    
    // Calculate delivery fee based on business settings if available
    if (this.deliveryFee === undefined || this.deliveryFee === null) {
      let deliveryCharge = 40; // Default delivery charge
      
      if (this.appliedBusinessSettings && this.appliedBusinessSettings.deliveryCharges) {
        const deliverySettings = this.appliedBusinessSettings.deliveryCharges;
        
        if (deliverySettings.applyToAllOrders) {
          // Apply delivery charge to all orders
          deliveryCharge = deliverySettings.fixedCharge || 40;
        } else {
          // Apply delivery charge only if order is below free delivery threshold
          if (this.subTotal < (deliverySettings.freeDeliveryThreshold || 500)) {
            deliveryCharge = deliverySettings.fixedCharge || 40;
          } else {
            deliveryCharge = 0; // Free delivery
          }
        }
      }
      
      this.deliveryFee = deliveryCharge;
    }
    
    // Calculate final amount
    if (!this.amount) {
      const discountAmount = (this.discounts && this.discounts.amount) || 0;
      this.amount = (this.subTotal || 0) + (this.tax || 0) + (this.deliveryFee || 0) - discountAmount;
      
      // Ensure amount is not negative
      this.amount = Math.max(0, this.amount);
    }
    
    // Calculate total items count
    this.totalItemsCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
  }
  next();
});

// Method to calculate formatted date string for frontend
orderSchema.methods.getFormattedDate = function() {
  const date = this.date;
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
};

// Add a method to get order summary with complete pricing breakdown
orderSchema.methods.getSummary = function() {
  return {
    id: this.orderNumber,
    _id: this._id,
    customer: this.customerName,
    customerName: this.customerName, // Added for consistency
    status: this.status,
    deliveryAgent: this.deliveryAgentName,
    date: this.getFormattedDate(),
    time: this.time,
    // Complete pricing breakdown
    subtotal: this.subTotal || 0,
    deliveryFee: this.deliveryFee || 0,
    tax: this.tax || 0,
    taxPercentage: this.taxPercentage || 0,
    discount: (this.discounts && this.discounts.amount) || 0,
    discountCode: (this.discounts && this.discounts.code) || null,
    amount: this.amount,
    total: this.amount, // Alias for amount
    itemCount: this.totalItemsCount,
    items: this.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      size: item.size,
      foodType: item.foodType,
      basePrice: item.basePrice || item.price,
      totalItemPrice: item.totalItemPrice || item.price,
      totalPrice: (item.totalItemPrice || item.price) * item.quantity,
      customizations: item.customizations || [],
      addOns: item.addOns || [],
      toppings: item.toppings || [],
      specialInstructions: item.specialInstructions,
      hasCustomizations: !!(
        (item.customizations && item.customizations.length) || 
        (item.addOns && item.addOns.length) || 
        (item.toppings && item.toppings.length) ||
        item.specialInstructions
      )
    })),
    // Additional order details for delivery agent
    paymentMethod: this.paymentMethod,
    paymentStatus: this.paymentStatus,
    address: this.address,
    fullAddress: this.fullAddress,
    customerPhone: this.customerPhone,
    notes: this.notes,
    // Business settings applied at order time
    appliedBusinessSettings: this.appliedBusinessSettings
  };
};

// Add a method to get delivery completion summary for completed orders
orderSchema.methods.getDeliveryCompletionSummary = function() {
  // Calculate delivery duration (mock data for now, you can implement actual tracking)
  const deliveryDuration = "25-30 min"; // This should be calculated from actual delivery time
  
  // Mock rating (you can implement actual rating system)
  const rating = Math.floor(Math.random() * 2) + 4; // Random rating between 4-5
  
  // Mock feedback (you can implement actual feedback system)
  const feedbacks = [
    "Great delivery service!",
    "Food was hot and fresh",
    "Quick delivery, thank you!",
    "Excellent service",
    "",
    "",
    "" // More empty strings to make feedback less frequent
  ];
  const feedback = feedbacks[Math.floor(Math.random() * feedbacks.length)];
  
  // Calculate commission (example: 10% of order total)
  const commission = Math.round(this.amount * 0.10 * 100) / 100;
  
  return {
    id: this.orderNumber,
    _id: this._id,
    date: this.date,
    time: this.time,
    customerName: this.customerName,
    items: this.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.totalItemPrice || item.price,
      size: item.size,
      foodType: item.foodType,
      customizations: item.customizations || [],
      addOns: item.addOns || [],
      toppings: item.toppings || []
    })),
    // Complete pricing breakdown for transparency
    subtotal: this.subTotal || 0,
    deliveryFee: this.deliveryFee || 0,
    tax: this.tax || 0,
    discount: (this.discounts && this.discounts.amount) || 0,
    total: this.amount,
    // Delivery specific information
    commission: commission,
    deliveryDuration: deliveryDuration,
    rating: rating,
    feedback: feedback,
    customerImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100' // Default image
  };
};

module.exports = mongoose.model('Order', orderSchema);