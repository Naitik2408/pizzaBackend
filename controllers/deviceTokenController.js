const DeviceToken = require('../models/DeviceToken');
const asyncHandler = require('express-async-handler');

// @desc    Register device token for push notifications
// @route   POST /api/device/register
// @access  Private
const registerDeviceToken = asyncHandler(async (req, res) => {
  const { token, platform, tokenType, deviceInfo } = req.body;
  const userId = req.user._id;

  if (!token) {
    res.status(400);
    throw new Error('Device token is required');
  }

  try {
    // Determine token type if not provided
    let finalTokenType = tokenType;
    if (!finalTokenType) {
      finalTokenType = token.startsWith('ExponentPushToken') ? 'expo' : 'fcm';
    }

    // Check if token already exists for this user
    let existingToken = await DeviceToken.findOne({ token });

    if (existingToken) {
      // If token exists but belongs to another user, update it
      if (existingToken.user.toString() !== userId.toString()) {
        existingToken.user = userId;
        existingToken.platform = platform;
        existingToken.tokenType = finalTokenType;
        existingToken.deviceInfo = deviceInfo;
        existingToken.isActive = true;
        await existingToken.save();
      }
      
      console.log(`📱 Device token updated for user ${userId}: ${finalTokenType} token`);
      return res.status(200).json({
        success: true,
        message: 'Device token updated',
        token: existingToken
      });
    }

    // IMPORTANT: Clean up old tokens for this user to prevent duplicates
    // This prevents mixing Expo Go and development build notifications
    console.log(`🧹 Cleaning up old tokens for user ${userId} before registering new ${finalTokenType} token`);
    const deletedOldTokens = await DeviceToken.deleteMany({ 
      user: userId,
      token: { $ne: token } // Don't delete the current token if it somehow exists
    });
    
    if (deletedOldTokens.deletedCount > 0) {
      console.log(`🗑️  Removed ${deletedOldTokens.deletedCount} old tokens for user ${userId}`);
    }

    // Create new token
    const deviceToken = new DeviceToken({
      user: userId,
      token,
      platform: platform || 'ios',
      tokenType: finalTokenType,
      deviceInfo: deviceInfo || {},
      isActive: true
    });

    const savedToken = await deviceToken.save();
    
    console.log(`📱 New device token registered for user ${userId}: ${finalTokenType} token`);
    console.log(`🔔 ${finalTokenType === 'fcm' ? 'FCM system notifications' : 'Expo notifications'} enabled`);

    res.status(201).json({
      success: true,
      message: 'Device registered successfully',
      token: savedToken
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500);
    throw new Error('Failed to register device token');
  }
});

// @desc    Remove device token
// @route   DELETE /api/device/unregister
// @access  Private
const unregisterDeviceToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const userId = req.user._id;

  if (!token) {
    res.status(400);
    throw new Error('Device token is required');
  }

  try {
    // Find and remove token
    const deletedToken = await DeviceToken.findOneAndDelete({ 
      token, 
      user: userId 
    });

    if (!deletedToken) {
      return res.status(404).json({
        success: false,
        message: 'Device token not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Device token unregistered'
    });
  } catch (error) {
    console.error('Error unregistering device token:', error);
    res.status(500);
    throw new Error('Failed to unregister device token');
  }
});

// @desc    Clear all device tokens for current user (for debugging)
// @route   DELETE /api/device/clear-all
// @access  Private
const clearAllDeviceTokens = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    // Remove all tokens for this user
    const deletedTokens = await DeviceToken.deleteMany({ user: userId });

    console.log(`🧹 Cleared ${deletedTokens.deletedCount} device tokens for user ${userId}`);

    res.status(200).json({
      success: true,
      message: `Cleared ${deletedTokens.deletedCount} device tokens`,
      deletedCount: deletedTokens.deletedCount
    });
  } catch (error) {
    console.error('Error clearing device tokens:', error);
    res.status(500);
    throw new Error('Failed to clear device tokens');
  }
});

module.exports = {
  registerDeviceToken,
  unregisterDeviceToken,
  clearAllDeviceTokens
};