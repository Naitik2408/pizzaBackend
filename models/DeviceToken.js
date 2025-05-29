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
  },
  {
    timestamps: true,
  }
);

// Add index for faster lookups
deviceTokenSchema.index({ user: 1 });

const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);
module.exports = DeviceToken;