const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Create address schema
const addressSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  addressLine1: {
    type: String,
    required: true,
  },
  addressLine2: {
    type: String,
    default: '',
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  zipCode: {
    type: String,
    required: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  }
}, { _id: true });

// Create delivery partner schema for delivery-specific information
const deliveryPartnerSchema = new mongoose.Schema({
  vehicleType: {
    type: String,
    enum: ['bike', 'scooter', 'bicycle', 'car', 'other'],
    required: true
  },
  aadharCard: {
    type: String,
    required: true
  },
  drivingLicense: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  verificationNotes: {
    type: String,
    default: ''
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastActiveTime: {
    type: Date,
    default: null
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['customer', 'delivery', 'admin'], // Define roles
    default: 'customer',
  },
  addresses: [addressSchema], // Add addresses array
  deliveryDetails: {
    type: deliveryPartnerSchema,
    required: function() {
      return this.role === 'delivery';
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Update lastActiveTime when delivery partner goes online
userSchema.pre('save', function(next) {
  if (
    this.isModified('deliveryDetails.isOnline') && 
    this.deliveryDetails && 
    this.deliveryDetails.isOnline
  ) {
    this.deliveryDetails.lastActiveTime = new Date();
  }
  next();
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);