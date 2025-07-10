const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  deviceId: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    enum: ['android', 'ios'],
    required: true,
  },
  tokenType: {
    type: String,
    enum: ['fcm', 'expo'],
    default: 'fcm',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastUsed: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
deviceTokenSchema.index({ userId: 1, platform: 1 });
deviceTokenSchema.index({ token: 1 });
deviceTokenSchema.index({ isActive: 1 });

// Update lastUsed when token is accessed
deviceTokenSchema.methods.updateLastUsed = function() {
  this.lastUsed = new Date();
  this.isActive = true;
  return this.save();
};

// Static method to find active tokens for user
deviceTokenSchema.statics.findActiveTokensForUser = function(userId) {
  return this.find({ userId, isActive: true });
};

// Static method to find active tokens for multiple users
deviceTokenSchema.statics.findActiveTokensForUsers = function(userIds) {
  return this.find({ 
    userId: { $in: userIds }, 
    isActive: true 
  });
};

// Static method to deactivate old tokens
deviceTokenSchema.statics.deactivateOldTokens = function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.updateMany(
    { lastUsed: { $lt: cutoffDate } },
    { isActive: false }
  );
};

// Static method to find active FCM tokens for user (for Firebase delivery)
deviceTokenSchema.statics.findActiveFCMTokensForUser = function(userId) {
  return this.find({ 
    userId, 
    isActive: true, 
    tokenType: 'fcm' 
  });
};

// Static method to find active Expo tokens for user (for Expo delivery)
deviceTokenSchema.statics.findActiveExpoTokensForUser = function(userId) {
  return this.find({ 
    userId, 
    isActive: true, 
    tokenType: 'expo' 
  });
};

const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);

module.exports = DeviceToken;
