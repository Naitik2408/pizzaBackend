const DeviceToken = require('../models/DeviceToken');
const User = require('../models/User');
const fetch = require('node-fetch');
const { sendFCMNotification, sendCriticalOrderAlert } = require('./firebaseAdmin');

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
    
    // Separate FCM tokens from Expo tokens
    const fcmTokens = deviceTokens
      .filter(dt => dt.tokenType === 'fcm' || !dt.token.startsWith('ExponentPushToken'))
      .map(dt => dt.token);
    
    const expoTokens = deviceTokens
      .filter(dt => dt.tokenType === 'expo' || dt.token.startsWith('ExponentPushToken'))
      .map(dt => dt.token);
    
    console.log(`📱 Sending to ${fcmTokens.length} FCM tokens and ${expoTokens.length} Expo tokens`);
    
    const results = [];
    
    // Send FCM notifications first (system-level)
    if (fcmTokens.length > 0) {
      try {
        const fcmResult = await sendFCMNotification(fcmTokens, notification, notification.data);
        results.push({ type: 'fcm', ...fcmResult });
      } catch (error) {
        console.error('FCM notification error:', error);
        results.push({ type: 'fcm', success: false, error: error.message });
      }
    }
    
    // Send Expo notifications as backup
    if (expoTokens.length > 0) {
      try {
        const expoResult = await sendExpoNotifications(expoTokens, notification);
        results.push({ type: 'expo', ...expoResult });
      } catch (error) {
        console.error('Expo notification error:', error);
        results.push({ type: 'expo', success: false, error: error.message });
      }
    }
    
    return {
      success: results.some(r => r.success),
      results
    };
  } catch (error) {
    console.error('Error sending role notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send system-level critical order alert for a new order
 * @param {Object} order - Order object
 * @returns {Promise<Object>} - Response from notification service
 */
const sendNewOrderNotification = async (order) => {
  try {
    // Find admin users
    const adminUsers = await User.find({ role: 'admin' });
    
    if (!adminUsers || adminUsers.length === 0) {
      console.log('No admin users found');
      return { success: false, message: 'No admin users found' };
    }
    
    // Get admin user IDs
    const adminUserIds = adminUsers.map(user => user._id);
    
    // Find device tokens for admin users
    const deviceTokens = await DeviceToken.find({
      user: { $in: adminUserIds }
    });
    
    if (!deviceTokens || deviceTokens.length === 0) {
      console.log('No device tokens found for admin users');
      return { success: false, message: 'No device tokens found for admin users' };
    }
    
    // Prepare order data
    const orderData = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber || order._id.toString().slice(-6),
      customerName: order.customerName || 'Customer',
      amount: order.amount
    };
    
    // Separate FCM tokens from Expo tokens
    const fcmTokens = deviceTokens
      .filter(dt => dt.tokenType === 'fcm' || !dt.token.startsWith('ExponentPushToken'))
      .map(dt => dt.token);
    
    const expoTokens = deviceTokens
      .filter(dt => dt.tokenType === 'expo' || dt.token.startsWith('ExponentPushToken'))
      .map(dt => dt.token);
    
    console.log(`🚨 Sending critical order alert to ${fcmTokens.length} FCM tokens and ${expoTokens.length} Expo tokens`);
    
    const results = [];
    
    // Send FCM critical alert first (system-level notification)
    if (fcmTokens.length > 0) {
      try {
        const fcmResult = await sendCriticalOrderAlert(fcmTokens, orderData);
        results.push({ type: 'fcm', ...fcmResult });
        console.log('🔥 FCM critical alert sent:', fcmResult);
      } catch (error) {
        console.error('❌ FCM critical alert error:', error);
        results.push({ type: 'fcm', success: false, error: error.message });
      }
    }
    
    // Send Expo notification as backup
    if (expoTokens.length > 0) {
      const expoNotification = {
        title: '🚨 NEW ORDER ALERT! 🚨',
        body: `URGENT: ${orderData.customerName} placed order #${orderData.orderNumber} - ₹${orderData.amount}`,
        data: { 
          ...orderData,
          type: 'critical_order_alert', // Changed to match test notification
          priority: 'max',
          timestamp: Date.now().toString(),
          systemAlert: 'true',
          popup: 'true' // Add popup indicator
        }
      };
      
      try {
        const expoResult = await sendExpoNotifications(expoTokens, expoNotification);
        results.push({ type: 'expo', ...expoResult });
        console.log('📱 Expo backup alert sent:', expoResult);
      } catch (error) {
        console.error('❌ Expo backup alert error:', error);
        results.push({ type: 'expo', success: false, error: error.message });
      }
    }
    
    return {
      success: results.some(r => r.success),
      results,
      message: 'Critical order alert sent to admin users'
    };
  } catch (error) {
    console.error('❌ Error sending new order notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Expo notifications with proper project ID handling
 * @param {Array} tokens - Array of Expo Push Tokens
 * @param {Object} notification - Notification object with title, body, data
 * @returns {Promise<Object>} - Response from Expo push service
 */
const sendExpoNotifications = async (tokens, notification) => {
  try {
    if (!tokens || tokens.length === 0) {
      return { success: false, message: 'No tokens provided' };
    }
    
    console.log(`📱 Sending Expo notifications to ${tokens.length} tokens SEQUENTIALLY`);
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    // Send to each token individually and sequentially to avoid project ID conflicts
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      try {
        const message = {
          to: token,
          sound: 'notification_sound.wav',
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          badge: 1,
          priority: 'high',
          // Don't specify channelId for development - let Expo handle it
          _displayInForeground: true
        };

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message)
        });
        
        const result = await response.json();
        console.log(`📱 Expo notification result for token ${i+1}/${tokens.length}:`, result);
        
        if (result.errors) {
          console.error(`❌ Expo notification failed for token ${i+1}:`, result.errors);
          failed++;
        } else {
          successful++;
        }
        
        results.push(result);
        
        // Add a small delay between requests to avoid rate limiting
        if (i < tokens.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Error sending to token ${i+1}:`, error.message);
        failed++;
        results.push({ error: error.message });
      }
    }
    
    console.log(`📱 Expo Results: ${successful} successful, ${failed} failed`);
    
    return {
      success: successful > 0,
      successful,
      failed,
      results
    };
  } catch (error) {
    console.error('❌ Error sending Expo notifications:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendRoleNotification,
  sendNewOrderNotification,
  sendExpoNotifications
};