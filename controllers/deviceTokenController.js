const DeviceToken = require('../models/DeviceToken');
const asyncHandler = require('express-async-handler');

// @desc    Register device token for push notifications
// @route   POST /api/device/register
// @access  Private
const registerDeviceToken = asyncHandler(async (req, res) => {
  const { token, platform } = req.body;
  const userId = req.user._id;

  if (!token) {
    res.status(400);
    throw new Error('Device token is required');
  }

  try {
    // Check if token already exists for this user
    let existingToken = await DeviceToken.findOne({ token });

    if (existingToken) {
      // If token exists but belongs to another user, update it
      if (existingToken.user.toString() !== userId.toString()) {
        existingToken.user = userId;
        existingToken.platform = platform;
        await existingToken.save();
      }
      
      return res.status(200).json({
        success: true,
        message: 'Device token updated',
        token: existingToken
      });
    }

    // Create new token
    const deviceToken = new DeviceToken({
      user: userId,
      token,
      platform: platform || 'ios' // Default to iOS if not specified
    });

    const savedToken = await deviceToken.save();

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

module.exports = {
  registerDeviceToken,
  unregisterDeviceToken
};