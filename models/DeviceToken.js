const mongoose = require('mongoose');

const deviceTokenSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      required: true,
    },
    tokenType: {
      type: String,
      enum: ['fcm', 'expo'],
      default: 'expo',
    },
    deviceInfo: {
      brand: String,
      modelName: String,
      osVersion: String,
      appVersion: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add index for faster lookups
deviceTokenSchema.index({ user: 1 });
deviceTokenSchema.index({ tokenType: 1 });

const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);
module.exports = DeviceToken;