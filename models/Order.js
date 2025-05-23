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
    },
    customerName: {
      type: String,
      required: true
    },
    items: [
      {
        menuItemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
        },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        size: { type: String, enum: ['Small', 'Medium', 'Large', 'Not Applicable'] },
        foodType: { type: String, enum: ['Veg', 'Non-Veg', 'Not Applicable'] },
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
    customerPhone: { type: String, required: true },
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
      percentage: { type: Number }
    },
    subTotal: { type: Number }, // Amount before tax, delivery fee, discounts
    tax: { type: Number },
    deliveryFee: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Generate unique order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const count = await mongoose.models.Order.countDocuments({}) + 1;
    this.orderNumber = `${count.toString().padStart(4, '0')}`;
    
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
    
    // If no tax is set but we have a subtotal, estimate the tax
    if (!this.tax && this.subTotal) {
      // Estimate tax at 5% (modify according to your tax rate)
      this.tax = Math.round(this.subTotal * 0.05 * 100) / 100;
    }
    
    // If amount is not set, calculate it
    if (!this.amount) {
      this.amount = (this.subTotal || 0) + (this.tax || 0) + (this.deliveryFee || 0) - ((this.discounts && this.discounts.amount) || 0);
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

// Add a method to get order summary
orderSchema.methods.getSummary = function() {
  return {
    id: this.orderNumber,
    _id: this._id,
    customer: this.customerName,
    status: this.status,
    deliveryAgent: this.deliveryAgentName,
    date: this.getFormattedDate(),
    time: this.time,
    amount: this.amount,
    itemCount: this.totalItemsCount,
    items: this.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      size: item.size,
      foodType: item.foodType,
      totalPrice: (item.totalItemPrice || item.price) * item.quantity,
      hasCustomizations: !!(
        (item.customizations && item.customizations.length) || 
        (item.addOns && item.addOns.length) || 
        (item.toppings && item.toppings.length) ||
        item.specialInstructions
      )
    }))
  };
};

module.exports = mongoose.model('Order', orderSchema);