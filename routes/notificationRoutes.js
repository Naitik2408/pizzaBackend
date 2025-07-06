const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { sendCriticalOrderAlert, testFCMNotification } = require('../utils/firebaseAdmin');
const { sendExpoNotifications } = require('../utils/notifications');
const DeviceToken = require('../models/DeviceToken');
const User = require('../models/User');

const router = express.Router();

// @desc    Test FCM notification
// @route   POST /api/notifications/test
// @access  Private (Admin only)
router.post('/test', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    // Get admin device tokens
    const adminUsers = await User.find({ role: 'admin' });
    const adminUserIds = adminUsers.map(user => user._id);
    
    const deviceTokens = await DeviceToken.find({
      user: { $in: adminUserIds },
      isActive: true
    });

    if (deviceTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active device tokens found for admin users'
      });
    }

    // Get FCM tokens
    const fcmTokens = deviceTokens
      .filter(dt => dt.tokenType === 'fcm' || !dt.token.startsWith('ExponentPushToken'))
      .map(dt => dt.token);

    if (fcmTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No FCM tokens found for admin users'
      });
    }

    // Send test notification
    const result = await testFCMNotification(fcmTokens);

    res.json({
      success: true,
      message: 'Test notification sent',
      tokensCount: fcmTokens.length,
      result
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
});

// @desc    Test critical order alert
// @route   POST /api/notifications/test-order
// @access  Private (Admin only)
router.post('/test-order', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    // Get admin device tokens
    const adminUsers = await User.find({ role: 'admin' });
    const adminUserIds = adminUsers.map(user => user._id);
    
    const deviceTokens = await DeviceToken.find({
      user: { $in: adminUserIds },
      isActive: true
    });

    if (deviceTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active device tokens found for admin users'
      });
    }

    // Get FCM tokens
    const fcmTokens = deviceTokens
      .filter(dt => dt.tokenType === 'fcm' || !dt.token.startsWith('ExponentPushToken'))
      .map(dt => dt.token);

    if (fcmTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No FCM tokens found for admin users'
      });
    }

    // Mock order data
    const orderData = {
      orderId: 'test-' + Date.now(),
      orderNumber: 'TEST001',
      customerName: 'Test Customer',
      amount: 299
    };

    // Send critical order alert
    const result = await sendCriticalOrderAlert(fcmTokens, orderData);

    res.json({
      success: true,
      message: 'Critical order alert sent',
      orderData,
      tokensCount: fcmTokens.length,
      result
    });
  } catch (error) {
    console.error('Test order alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test order alert',
      error: error.message
    });
  }
});

// @desc    Test Expo push notification
// @route   POST /api/notifications/test-expo
// @access  Private (Admin only)
router.post('/test-expo', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    // Get admin device tokens
    const adminUsers = await User.find({ role: 'admin' });
    const adminUserIds = adminUsers.map(user => user._id);
    
    const deviceTokens = await DeviceToken.find({
      user: { $in: adminUserIds },
      isActive: true
    });

    if (deviceTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active device tokens found for admin users'
      });
    }

    // Get Expo tokens
    const expoTokens = deviceTokens
      .filter(dt => dt.tokenType === 'expo' || dt.token.startsWith('ExponentPushToken'))
      .map(dt => dt.token);

    if (expoTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No Expo tokens found for admin users'
      });
    }

    // Test notification
    const notification = {
      title: '🚨 TEST PUSH NOTIFICATION',
      body: 'This is a test push notification from the backend - should appear as popup!',
      data: {
        type: 'critical_order_alert',
        test: true,
        timestamp: Date.now(),
        popup: 'true'
      }
    };

    // Send test notification
    const result = await sendExpoNotifications(expoTokens, notification);

    res.json({
      success: true,
      message: 'Test Expo push notification sent',
      tokensCount: expoTokens.length,
      result
    });
  } catch (error) {
    console.error('Test Expo notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test Expo notification',
      error: error.message
    });
  }
});

module.exports = router;
