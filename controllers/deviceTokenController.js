const asyncHandler = require('express-async-handler');
const DeviceToken = require('../models/DeviceToken');
const { apiResponse } = require('../utils/apiResponse');

// @desc    Register device token
// @route   POST /api/device-tokens
// @access  Private
const registerDeviceToken = asyncHandler(async (req, res) => {
  const { token, deviceId, platform } = req.body;
  const userId = req.user.id;

  if (!token || !deviceId || !platform) {
    return res.status(400).json(
      apiResponse(false, 'Token, device ID, and platform are required', null)
    );
  }

  try {
    // Determine token type based on token format
    let tokenType = 'fcm'; // Default to FCM
    if (token.startsWith('ExponentPushToken[')) {
      tokenType = 'expo';
    }

    console.log(`📱 Registering ${tokenType} token for user ${userId}:`, token.substring(0, 50) + '...');
    console.log(`📱 Full token details:`, { tokenType, platform, deviceId, userId });

    // Check if token already exists
    let deviceToken = await DeviceToken.findOne({ token });

    if (deviceToken) {
      // Update existing token
      deviceToken.userId = userId;
      deviceToken.deviceId = deviceId;
      deviceToken.platform = platform;
      deviceToken.tokenType = tokenType;
      deviceToken.isActive = true;
      await deviceToken.updateLastUsed();
    } else {
      // Create new token
      deviceToken = await DeviceToken.create({
        userId,
        token,
        deviceId,
        platform,
        tokenType,
      });
    }

    // Deactivate other tokens for this user on the same device
    await DeviceToken.updateMany(
      {
        userId,
        deviceId,
        _id: { $ne: deviceToken._id },
      },
      { isActive: false }
    );

    res.status(201).json(
      apiResponse(true, 'Device token registered successfully', {
        id: deviceToken._id,
        token: deviceToken.token,
        platform: deviceToken.platform,
        tokenType: deviceToken.tokenType,
      })
    );
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json(
      apiResponse(false, 'Failed to register device token', null)
    );
  }
});

// @desc    Get user's device tokens
// @route   GET /api/device-tokens
// @access  Private
const getUserDeviceTokens = asyncHandler(async (req, res) => {
  try {
    const tokens = await DeviceToken.findActiveTokensForUser(req.user.id);

    res.json(
      apiResponse(true, 'Device tokens retrieved successfully', tokens)
    );
  } catch (error) {
    console.error('Error getting device tokens:', error);
    res.status(500).json(
      apiResponse(false, 'Failed to get device tokens', null)
    );
  }
});

// @desc    Delete device token
// @route   DELETE /api/device-tokens/:tokenId
// @access  Private
const deleteDeviceToken = asyncHandler(async (req, res) => {
  try {
    const token = await DeviceToken.findOne({
      _id: req.params.tokenId,
      userId: req.user.id,
    });

    if (!token) {
      return res.status(404).json(
        apiResponse(false, 'Device token not found', null)
      );
    }

    token.isActive = false;
    await token.save();

    res.json(
      apiResponse(true, 'Device token deactivated successfully', null)
    );
  } catch (error) {
    console.error('Error deleting device token:', error);
    res.status(500).json(
      apiResponse(false, 'Failed to delete device token', null)
    );
  }
});

// @desc    Update device token activity
// @route   PUT /api/device-tokens/:tokenId/activity
// @access  Private
const updateTokenActivity = asyncHandler(async (req, res) => {
  try {
    const token = await DeviceToken.findOne({
      _id: req.params.tokenId,
      userId: req.user.id,
    });

    if (!token) {
      return res.status(404).json(
        apiResponse(false, 'Device token not found', null)
      );
    }

    await token.updateLastUsed();

    res.json(
      apiResponse(true, 'Token activity updated successfully', null)
    );
  } catch (error) {
    console.error('Error updating token activity:', error);
    res.status(500).json(
      apiResponse(false, 'Failed to update token activity', null)
    );
  }
});

// @desc    Clean up old device tokens (Admin only)
// @route   DELETE /api/device-tokens/cleanup
// @access  Private/Admin
const cleanupOldTokens = asyncHandler(async (req, res) => {
  try {
    const { days = 30 } = req.body;
    
    const result = await DeviceToken.deactivateOldTokens(days);

    res.json(
      apiResponse(true, `Cleaned up ${result.modifiedCount} old tokens`, {
        deactivatedCount: result.modifiedCount,
      })
    );
  } catch (error) {
    console.error('Error cleaning up tokens:', error);
    res.status(500).json(
      apiResponse(false, 'Failed to cleanup old tokens', null)
    );
  }
});

module.exports = {
  registerDeviceToken,
  getUserDeviceTokens,
  deleteDeviceToken,
  updateTokenActivity,
  cleanupOldTokens,
};
