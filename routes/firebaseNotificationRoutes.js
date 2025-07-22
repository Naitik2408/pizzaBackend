const express = require('express');
const router = express.Router();
const firebaseNotificationService = require('../services/firebaseNotificationService');
const unifiedNotificationService = require('../services/unifiedNotificationService');
const firebaseAdmin = require('../utils/firebaseAdmin');
const { protect: authMiddleware } = require('../middleware/authMiddleware');
const { apiResponse } = require('../utils/apiResponse');
const asyncHandler = require('express-async-handler');
const logger = require('../utils/logger');

// @desc    Get Firebase configuration status
// @route   GET /api/notifications/status
// @access  Private
const getFirebaseStatus = asyncHandler(async (req, res) => {
  try {
    const firebaseStatus = firebaseAdmin.getStatus();
    
    res.json(apiResponse(true, 'Notification services status retrieved', {
      firebase: {
        ...firebaseStatus,
        timestamp: new Date().toISOString()
      },
      unified: {
        status: 'active',
        service: 'unified',
        timestamp: new Date().toISOString()
      },
      primary: 'unified' // Unified service is the primary service for this app
    }));
  } catch (error) {
    logger.error('Error getting notification services status', error);
    res.status(500).json(apiResponse(false, 'Failed to get notification services status', null));
  }
});

// @desc    Send custom notification to user
// @route   POST /api/notifications/send
// @access  Private/Admin
const sendCustomNotification = asyncHandler(async (req, res) => {
  const { userId, title, body, data = {}, imageUrl } = req.body;

  if (!userId || !title || !body) {
    return res.status(400).json(
      apiResponse(false, 'userId, title, and body are required', null)
    );
  }

  try {
    const notification = { title, body, imageUrl };
    const result = await firebaseNotificationService.sendToUser(userId, notification, data);
    
    if (result.success) {
      res.json(apiResponse(true, 'Notification sent successfully', result));
    } else {
      res.status(400).json(apiResponse(false, result.error || 'Failed to send notification', null));
    }
  } catch (error) {
    console.error('Error sending custom notification:', error);
    res.status(500).json(apiResponse(false, 'Internal server error', null));
  }
});

// @desc    Send notification to multiple users
// @route   POST /api/notifications/send-multiple
// @access  Private/Admin
const sendMultipleNotifications = asyncHandler(async (req, res) => {
  const { userIds, title, body, data = {}, imageUrl } = req.body;

  if (!userIds || !Array.isArray(userIds) || !title || !body) {
    return res.status(400).json(
      apiResponse(false, 'userIds (array), title, and body are required', null)
    );
  }

  try {
    // Always return success message to user first
    res.json(apiResponse(true, 'Notifications sent to admin', {
      userIds,
      title,
      body,
      timestamp: new Date().toISOString(),
      service: 'unified'
    }));

    // Try to send notifications using unified service
    const notification = { title, body, imageUrl };
    
    try {
      logger.dev('Attempting multiple notifications via unified service...');
      const result = await unifiedNotificationService.sendToUsers(userIds, notification, data);
      
      if (result.success) {
        logger.success('Unified notifications sent successfully');
        return;
      }
      
      logger.warn('Unified notification service had issues, trying Firebase directly...');
      const firebaseResult = await firebaseNotificationService.sendToUsers(userIds, notification, data);
      
      if (firebaseResult.success) {
        console.log('✅ Firebase multiple notifications sent successfully');
      } else {
        console.log('❌ All notification services failed for multiple users');
      }
    } catch (backgroundError) {
      console.error('Background notification error for multiple users:', backgroundError);
    }
  } catch (error) {
    console.error('Error sending multiple notifications:', error);
    res.status(500).json(apiResponse(false, 'Internal server error', null));
  }
});

// @desc    Send broadcast notification to all users
// @route   POST /api/notifications/broadcast
// @access  Private/Admin
const sendBroadcastNotification = asyncHandler(async (req, res) => {
  const { title, body, data = {}, imageUrl } = req.body;

  if (!title || !body) {
    return res.status(400).json(
      apiResponse(false, 'title and body are required', null)
    );
  }

  try {
    const notification = { title, body, imageUrl };
    const result = await firebaseNotificationService.sendBroadcastNotification(notification, data);
    
    if (result.success) {
      res.json(apiResponse(true, 'Broadcast notification sent successfully', result));
    } else {
      res.status(400).json(apiResponse(false, result.error || 'Failed to send broadcast notification', null));
    }
  } catch (error) {
    console.error('Error sending broadcast notification:', error);
    res.status(500).json(apiResponse(false, 'Internal server error', null));
  }
});

// @desc    Send order update notification
// @route   POST /api/notifications/order-update
// @access  Private
const sendOrderUpdateNotification = asyncHandler(async (req, res) => {
  const { userId, orderId, status } = req.body;

  if (!userId || !orderId || !status) {
    return res.status(400).json(
      apiResponse(false, 'userId, orderId, and status are required', null)
    );
  }

  try {
    const orderData = { orderId, status };
    const result = await firebaseNotificationService.sendOrderUpdateNotification(userId, orderData);
    
    if (result.success) {
      res.json(apiResponse(true, 'Order update notification sent successfully', result));
    } else {
      res.status(400).json(apiResponse(false, result.error || 'Failed to send order update notification', null));
    }
  } catch (error) {
    console.error('Error sending order update notification:', error);
    res.status(500).json(apiResponse(false, 'Internal server error', null));
  }
});

// @desc    Send delivery update notification
// @route   POST /api/notifications/delivery-update
// @access  Private
const sendDeliveryUpdateNotification = asyncHandler(async (req, res) => {
  const { 
    userId, 
    orderId, 
    status, 
    eta, 
    deliveryPersonName, 
    deliveryPersonPhone 
  } = req.body;

  if (!userId || !orderId || !status) {
    return res.status(400).json(
      apiResponse(false, 'userId, orderId, and status are required', null)
    );
  }

  try {
    const deliveryData = { 
      orderId, 
      status, 
      eta, 
      deliveryPersonName, 
      deliveryPersonPhone 
    };
    const result = await firebaseNotificationService.sendDeliveryUpdateNotification(userId, deliveryData);
    
    if (result.success) {
      res.json(apiResponse(true, 'Delivery update notification sent successfully', result));
    } else {
      res.status(400).json(apiResponse(false, result.error || 'Failed to send delivery update notification', null));
    }
  } catch (error) {
    console.error('Error sending delivery update notification:', error);
    res.status(500).json(apiResponse(false, 'Internal server error', null));
  }
});

// @desc    Send offer notification
// @route   POST /api/notifications/offer
// @access  Private/Admin
const sendOfferNotification = asyncHandler(async (req, res) => {
  const { userIds, offerId, description, discount, imageUrl } = req.body;

  if (!userIds || !Array.isArray(userIds) || !offerId || !description) {
    return res.status(400).json(
      apiResponse(false, 'userIds (array), offerId, and description are required', null)
    );
  }

  try {
    const offerData = { offerId, description, discount, imageUrl };
    const result = await firebaseNotificationService.sendOfferNotification(userIds, offerData);
    
    if (result.success) {
      res.json(apiResponse(true, 'Offer notification sent successfully', result));
    } else {
      res.status(400).json(apiResponse(false, result.error || 'Failed to send offer notification', null));
    }
  } catch (error) {
    console.error('Error sending offer notification:', error);
    res.status(500).json(apiResponse(false, 'Internal server error', null));
  }
});

// @desc    Manually register device token for current user
// @route   POST /api/notifications/register-token
// @access  Private
const manualTokenRegistration = asyncHandler(async (req, res) => {
  try {
    const { token, tokenType = 'fcm' } = req.body;
    
    if (!token) {
      return res.status(400).json(apiResponse(false, 'Token is required', null));
    }
    
    const userId = req.user._id || req.user.id;
    
    // Create device token entry
    const DeviceToken = require('../models/DeviceToken');
    
    const deviceToken = new DeviceToken({
      userId,
      token,
      deviceId: 'manual-registration',
      platform: 'android',
      tokenType,
      isActive: true,
    });
    
    await deviceToken.save();
    
    console.log(`✅ Manual token registered for user ${req.user.name}:`, token.substring(0, 20) + '...');
    
    res.json(apiResponse(true, 'Device token registered manually', {
      userId,
      userName: req.user.name,
      tokenType,
      token: token.substring(0, 20) + '...',
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error registering token manually:', error);
    res.status(500).json(apiResponse(false, 'Failed to register token', {
      error: error.message
    }));
  }
});

// @desc    Get delivery agent device tokens
// @route   GET /api/notifications/delivery-tokens/:agentId
// @access  Private/Admin
const getDeliveryAgentTokens = asyncHandler(async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const DeviceToken = require('../models/DeviceToken');
    const User = require('../models/User');
    
    // Get delivery agent details
    const agent = await User.findById(agentId).select('name email role deliveryDetails');
    
    if (!agent) {
      return res.status(404).json(apiResponse(false, 'Delivery agent not found', null));
    }
    
    // Get device tokens for this agent
    const tokens = await DeviceToken.find({ userId: agentId }).select('token tokenType platform isActive createdAt lastUsed');
    
    res.json(apiResponse(true, 'Delivery agent tokens retrieved', {
      agent: {
        _id: agent._id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        isOnline: agent.deliveryDetails?.isOnline || false,
        isVerified: agent.deliveryDetails?.isVerified || false,
      },
      tokens: tokens.map(token => ({
        tokenId: token._id,
        tokenType: token.tokenType,
        platform: token.platform,
        isActive: token.isActive,
        createdAt: token.createdAt,
        lastUsed: token.lastUsed,
        tokenPreview: token.token.substring(0, 20) + '...',
      })),
      totalTokens: tokens.length,
      activeTokens: tokens.filter(t => t.isActive).length,
    }));
  } catch (error) {
    console.error('Error getting delivery agent tokens:', error);
    res.status(500).json(apiResponse(false, 'Failed to get delivery agent tokens', {
      error: error.message
    }));
  }
});

// @desc    Get current user's device tokens and login status
// @route   GET /api/notifications/my-tokens
// @access  Private
const getCurrentUserTokens = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const DeviceToken = require('../models/DeviceToken');
    
    // Get current user details
    const currentUser = {
      _id: req.user._id || req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      isDeliveryAgent: req.user.role === 'delivery',
      deliveryDetails: req.user.deliveryDetails || null,
    };
    
    // Get device tokens for current user
    const tokens = await DeviceToken.find({ userId }).select('token tokenType platform isActive createdAt lastUsed');
    
    console.log(`🎯 Token check for ${currentUser.name} (${currentUser.email}):`, tokens.length, 'tokens found');
    
    res.json(apiResponse(true, 'Current user tokens retrieved', {
      user: currentUser,
      tokens: tokens.map(token => ({
        tokenId: token._id,
        tokenType: token.tokenType,
        platform: token.platform,
        isActive: token.isActive,
        createdAt: token.createdAt,
        lastUsed: token.lastUsed,
        tokenPreview: token.token.substring(0, 30) + '...',
        fullToken: token.token, // Include full token for debugging
      })),
      totalTokens: tokens.length,
      activeTokens: tokens.filter(t => t.isActive).length,
      expectedUser: currentUser.role === 'delivery' ? 'gadha@gmail.com' : 'other',
      isCorrectUser: currentUser.email === 'gadha@gmail.com',
    }));
  } catch (error) {
    console.error('Error getting current user tokens:', error);
    res.status(500).json(apiResponse(false, 'Failed to get current user tokens', {
      error: error.message
    }));
  }
});

// @desc    Deactivate all device tokens for current user (logout)
// @route   POST /api/notifications/logout-tokens
// @access  Private
const deactivateUserTokens = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const DeviceToken = require('../models/DeviceToken');
    
    console.log(`🚪 Deactivating all tokens for user ${req.user.name} (${req.user.email}) on logout`);
    
    // Deactivate all tokens for this user
    const result = await DeviceToken.updateMany(
      { userId, isActive: true },
      { isActive: false, lastUsed: new Date() }
    );
    
    console.log(`✅ Deactivated ${result.modifiedCount} tokens for user ${req.user.name}`);
    
    res.json(apiResponse(true, 'All device tokens deactivated successfully', {
      userId,
      userName: req.user.name,
      deactivatedCount: result.modifiedCount,
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error deactivating user tokens:', error);
    res.status(500).json(apiResponse(false, 'Failed to deactivate device tokens', {
      error: error.message
    }));
  }
});

// @desc    Auto-register device token based on login user data
// @route   POST /api/notifications/auto-register
// @access  Private
const autoRegisterTokenOnLogin = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { fcmToken, deviceInfo } = req.body;
    
    if (!fcmToken) {
      return res.status(400).json(apiResponse(false, 'FCM token is required', null));
    }
    
    console.log(`🔔 Auto-registering FCM token for ${req.user.name} (${req.user.email}) - Role: ${req.user.role}`);
    
    const DeviceToken = require('../models/DeviceToken');
    
    // Check if token already exists
    let deviceToken = await DeviceToken.findOne({ token: fcmToken });
    
    if (deviceToken) {
      // Update existing token with current user
      deviceToken.userId = userId;
      deviceToken.deviceId = deviceInfo?.deviceId || deviceToken.deviceId;
      deviceToken.platform = deviceInfo?.platform || deviceToken.platform;
      deviceToken.isActive = true;
      deviceToken.lastUsed = new Date();
      await deviceToken.save();
      
      console.log(`✅ Updated existing FCM token for ${req.user.name}`);
    } else {
      // Create new token
      deviceToken = new DeviceToken({
        userId,
        token: fcmToken,
        deviceId: deviceInfo?.deviceId || `device-${Date.now()}`,
        platform: deviceInfo?.platform || 'android',
        tokenType: 'fcm',
        isActive: true,
      });
      await deviceToken.save();
      
      console.log(`✅ Created new FCM token for ${req.user.name}`);
    }
    
    // Deactivate other tokens for this user (optional - keep only latest)
    await DeviceToken.updateMany(
      {
        userId,
        _id: { $ne: deviceToken._id },
        isActive: true
      },
      { isActive: false }
    );
    
    res.json(apiResponse(true, `FCM token auto-registered for ${req.user.role}`, {
      userId,
      userName: req.user.name,
      userEmail: req.user.email,
      userRole: req.user.role,
      tokenId: deviceToken._id,
      tokenType: deviceToken.tokenType,
      platform: deviceToken.platform,
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error auto-registering token:', error);
    res.status(500).json(apiResponse(false, 'Failed to auto-register FCM token', {
      error: error.message
    }));
  }
});

// Routes
router.get('/status', authMiddleware, getFirebaseStatus);
router.post('/send', authMiddleware, sendCustomNotification);
router.post('/send-multiple', authMiddleware, sendMultipleNotifications);
router.post('/broadcast', authMiddleware, sendBroadcastNotification);
router.post('/order-update', authMiddleware, sendOrderUpdateNotification);
router.post('/delivery-update', authMiddleware, sendDeliveryUpdateNotification);
router.post('/offer', authMiddleware, sendOfferNotification);
router.post('/register-token', authMiddleware, manualTokenRegistration);
router.get('/delivery-tokens/:agentId', authMiddleware, getDeliveryAgentTokens);
router.get('/my-tokens', authMiddleware, getCurrentUserTokens);
router.post('/logout-tokens', authMiddleware, deactivateUserTokens);
router.post('/auto-register', authMiddleware, autoRegisterTokenOnLogin);

module.exports = router;
