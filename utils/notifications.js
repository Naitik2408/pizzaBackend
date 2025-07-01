const DeviceToken = require('../models/DeviceToken');
const User = require('../models/User');
const fetch = require('node-fetch');

/**
 * Send push notification to users with a specific role
 * @param {String} role - User role to target (admin, delivery, etc)
 * @param {Object} notification - Notification object with title, body, data
 * @returns {Promise<Object>} - Response from notification service
 */
const sendRoleNotification = async (role, notification) => {
  try {
    // Find all users with the specified role
    const users = await User.find({ role });
    
    if (!users || users.length === 0) {
      console.log(`No users found with role: ${role}`);
      return { success: false, message: 'No users found with specified role' };
    }
    
    // Get user IDs
    const userIds = users.map(user => user._id);
    
    // Find device tokens for these users
    const deviceTokens = await DeviceToken.find({
      user: { $in: userIds }
    });
    
    if (!deviceTokens || deviceTokens.length === 0) {
      console.log(`No device tokens found for users with role: ${role}`);
      return { success: false, message: 'No device tokens found' };
    }
    
    // Extract tokens
    const tokens = deviceTokens.map(dt => dt.token);
    
    // Send notifications
    return await sendExpoNotifications(tokens, notification);
  } catch (error) {
    console.error('Error sending role notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send system-level alarm notification for a new order
 * @param {Object} order - Order object
 * @returns {Promise<Object>} - Response from notification service
 */
const sendNewOrderNotification = async (order) => {
  const notification = {
    title: '🚨 NEW ORDER ALERT! 🚨',
    body: `URGENT: ${order.customerName || 'Customer'} placed order #${order.orderNumber || order._id.slice(-6)} - ₹${order.amount}`,
    data: { 
      orderId: order._id.toString(),
      orderNumber: order.orderNumber || order._id.slice(-6),
      customerName: order.customerName || 'Customer',
      amount: order.amount.toString(),
      type: 'new_order_alarm',
      priority: 'max',
      timestamp: Date.now().toString(),
      // System-level alert flags
      systemAlert: 'true',
      fullScreen: 'true',
      callLike: 'true'
    }
  };
  
  return await sendRoleNotification('admin', notification);
};

/**
 * Send notifications via Expo's push notification service
 * @param {Array} tokens - Array of Expo Push Tokens
 * @param {Object} notification - Notification object with title, body, data
 * @returns {Promise<Object>} - Response from Expo push service
 */
const sendExpoNotifications = async (tokens, notification) => {
  try {
    if (!tokens || tokens.length === 0) {
      return { success: false, message: 'No tokens provided' };
    }
    
    const messages = tokens.map(token => ({
      to: token,
      sound: 'notification_sound.wav', // Custom alarm sound
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: 1,
      priority: 'max', // Maximum priority for system alerts
      channelId: notification.data?.fullScreen ? 'full_screen_alerts' : 'order_alerts',
      // System-level notification properties
      _displayInForeground: true,
      categoryId: 'ORDER_ALERT',
      subtitle: 'Immediate Action Required',
      // Android-specific properties for call-like behavior
      android: {
        priority: 'max',
        sticky: true,
        autoDismiss: false,
        ongoing: true,
        fullScreenIntent: notification.data?.fullScreen === 'true',
        timeoutAfter: 60000, // 60 seconds
        actions: [
          {
            title: 'View Order',
            icon: 'ic_action_view',
            identifier: 'view_order'
          },
          {
            title: 'Dismiss',
            icon: 'ic_action_dismiss', 
            identifier: 'dismiss_alert'
          }
        ]
      },
      // iOS-specific properties for critical alerts
      ios: {
        critical: true,
        criticalVolume: 1.0,
        interruptionLevel: 'critical'
      }
    }));
    
    console.log('Sending push notifications to tokens:', tokens);
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages)
    });
    
    const result = await response.json();
    console.log('Push notification response:', result);
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendRoleNotification,
  sendNewOrderNotification,
  sendExpoNotifications
};