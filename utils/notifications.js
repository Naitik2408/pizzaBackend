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
 * Send notification for a new order
 * @param {Object} order - Order object
 * @returns {Promise<Object>} - Response from notification service
 */
const sendNewOrderNotification = async (order) => {
  const notification = {
    title: 'New Order Received!',
    body: `${order.customerName} placed order #${order.orderNumber} - ₹${order.amount}`,
    data: { 
      orderId: order._id.toString(),
      type: 'new_order' 
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
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: 1,
      priority: 'high', // For faster delivery when app is in background
      channelId: 'orders', // Android notification channel
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