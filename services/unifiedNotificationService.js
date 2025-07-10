const firebaseNotificationService = require('./firebaseNotificationService');
const expoNotificationService = require('./expoNotificationService');
const DeviceToken = require('../models/DeviceToken');

class UnifiedNotificationService {
  constructor() {
    this.firebaseService = firebaseNotificationService;
    this.expoService = expoNotificationService;
  }

  // Send notification to a single device token
  async sendToDevice(token, notification, data = {}) {
    try {
      // Determine token type
      const tokenType = this.getTokenType(token);
      
      console.log(`📱 Sending ${tokenType} notification to token: ${token.substring(0, 20)}...`);
      
      if (tokenType === 'fcm') {
        return await this.firebaseService.sendToDevice(token, notification, data);
      } else if (tokenType === 'expo') {
        return await this.expoService.sendToDevice(token, notification, data);
      } else {
        throw new Error(`Unsupported token type: ${tokenType}`);
      }
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to user(s) with mixed token types
  async sendToUser(userId, notification, data = {}) {
    try {
      const tokens = await DeviceToken.findActiveTokensForUser(userId);
      
      if (tokens.length === 0) {
        console.warn(`No active tokens found for user: ${userId}`);
        return { success: false, error: 'No active tokens found' };
      }

      // Group tokens by type and prioritize FCM tokens
      const fcmTokens = tokens.filter(t => t.tokenType === 'fcm').map(t => t.token);
      const expoTokens = tokens.filter(t => t.tokenType === 'expo').map(t => t.token);

      console.log(`📊 Found ${fcmTokens.length} FCM tokens and ${expoTokens.length} Expo tokens`);
      console.log(`📊 All tokens:`, tokens.map(t => ({
        type: t.tokenType,
        token: t.token.substring(0, 30) + '...',
        active: t.isActive,
        created: t.createdAt
      })));

      const results = [];

      // PRIORITY 1: Send to FCM tokens using Firebase Admin SDK
      if (fcmTokens.length > 0) {
        console.log(`🔥 Sending to ${fcmTokens.length} FCM tokens via Firebase Admin SDK`);
        try {
          const fcmResult = await this.firebaseService.sendToMultipleDevices(fcmTokens, notification, data);
          results.push({ type: 'fcm', result: fcmResult });
          
          // If FCM succeeds, we can consider the notification sent successfully
          if (fcmResult.success && fcmResult.successCount > 0) {
            console.log(`✅ FCM notification sent successfully to ${fcmResult.successCount} devices`);
            
            // If FCM was successful, don't try Expo to avoid duplicate notifications
            if (fcmResult.successCount === fcmTokens.length) {
              console.log(`✅ All FCM notifications sent successfully, skipping Expo tokens`);
              return {
                success: true,
                successCount: fcmResult.successCount,
                failureCount: fcmResult.failureCount || 0,
                results: results,
                note: 'FCM notifications sent successfully, Expo tokens skipped to avoid duplicates'
              };
            }
          }
        } catch (error) {
          console.error('❌ FCM notification failed:', error);
          results.push({ type: 'fcm', result: { success: false, error: error.message } });
        }
      }

      // PRIORITY 2: Send to Expo tokens (only if no FCM tokens available or FCM failed)
      if (expoTokens.length > 0) {
        if (fcmTokens.length === 0) {
          console.log(`📱 No FCM tokens available, sending to ${expoTokens.length} Expo tokens`);
        } else {
          console.log(`📱 FCM had issues, attempting ${expoTokens.length} Expo tokens as fallback`);
        }
        
        try {
          const expoResult = await this.expoService.sendToMultipleDevices(expoTokens, notification, data);
          results.push({ type: 'expo', result: expoResult });
        } catch (error) {
          console.error('❌ Expo notification failed:', error);
          results.push({ type: 'expo', result: { success: false, error: error.message } });
        }
      }

      // Combine results
      const totalSuccess = results.reduce((sum, r) => sum + (r.result.successCount || 0), 0);
      const totalFailure = results.reduce((sum, r) => sum + (r.result.failureCount || 0), 0);

      return {
        success: totalSuccess > 0,
        successCount: totalSuccess,
        failureCount: totalFailure,
        results: results,
      };
    } catch (error) {
      console.error('❌ Failed to send notification to user:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to multiple users
  async sendToUsers(userIds, notification, data = {}) {
    try {
      const tokens = await DeviceToken.find({
        userId: { $in: userIds },
        isActive: true,
      });
      
      if (tokens.length === 0) {
        console.warn('No active tokens found for users:', userIds);
        return { success: false, error: 'No active tokens found' };
      }

      // Group tokens by type
      const fcmTokens = tokens.filter(t => t.tokenType === 'fcm').map(t => t.token);
      const expoTokens = tokens.filter(t => t.tokenType === 'expo').map(t => t.token);

      const results = [];

      // Send to FCM tokens
      if (fcmTokens.length > 0) {
        console.log(`🔥 Sending to ${fcmTokens.length} FCM tokens via Firebase Admin SDK`);
        try {
          const fcmResult = await this.firebaseService.sendToMultipleDevices(fcmTokens, notification, data);
          results.push({ type: 'fcm', result: fcmResult });
          
          // If FCM succeeds for all tokens, skip Expo
          if (fcmResult.success && fcmResult.successCount === fcmTokens.length) {
            console.log(`✅ All FCM notifications sent successfully, skipping Expo tokens`);
            return {
              success: true,
              successCount: fcmResult.successCount,
              failureCount: fcmResult.failureCount || 0,
              results: results,
              note: 'FCM notifications sent successfully, Expo tokens skipped to avoid duplicates'
            };
          }
        } catch (error) {
          console.error('❌ FCM notification failed:', error);
          results.push({ type: 'fcm', result: { success: false, error: error.message } });
        }
      }

      // Send to Expo tokens (only if no FCM tokens or FCM failed)
      if (expoTokens.length > 0) {
        if (fcmTokens.length === 0) {
          console.log(`📱 No FCM tokens available, sending to ${expoTokens.length} Expo tokens`);
        } else {
          console.log(`📱 FCM had issues, attempting ${expoTokens.length} Expo tokens as fallback`);
        }
        
        try {
          const expoResult = await this.expoService.sendToMultipleDevices(expoTokens, notification, data);
          results.push({ type: 'expo', result: expoResult });
        } catch (error) {
          console.error('❌ Expo notification failed:', error);
          results.push({ type: 'expo', result: { success: false, error: error.message } });
        }
      }

      // Combine results
      const totalSuccess = results.reduce((sum, r) => sum + (r.result.successCount || 0), 0);
      const totalFailure = results.reduce((sum, r) => sum + (r.result.failureCount || 0), 0);

      return {
        success: totalSuccess > 0,
        successCount: totalSuccess,
        failureCount: totalFailure,
        results: results,
      };
    } catch (error) {
      console.error('❌ Failed to send notification to users:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to all admin users
  async sendToAdmins(notification, data = {}) {
    try {
      const adminTokens = await DeviceToken.find({
        isActive: true,
        // Add your admin user filter here if needed
      });
      
      if (adminTokens.length === 0) {
        console.warn('No active admin tokens found');
        return { success: false, error: 'No active admin tokens found' };
      }

      const tokens = adminTokens.map(t => t.token);
      const results = [];

      // Group tokens by type
      const fcmTokens = adminTokens.filter(t => t.tokenType === 'fcm').map(t => t.token);
      const expoTokens = adminTokens.filter(t => t.tokenType === 'expo').map(t => t.token);

      console.log(`📊 Admin notification: ${fcmTokens.length} FCM tokens, ${expoTokens.length} Expo tokens`);

      // Send to FCM tokens first
      if (fcmTokens.length > 0) {
        console.log(`🔥 Sending admin notification to ${fcmTokens.length} FCM tokens via Firebase Admin SDK`);
        try {
          const fcmResult = await this.firebaseService.sendToMultipleDevices(fcmTokens, notification, data);
          results.push({ type: 'fcm', result: fcmResult });
          
          // If FCM succeeds for all tokens, skip Expo
          if (fcmResult.success && fcmResult.successCount === fcmTokens.length) {
            console.log(`✅ All admin FCM notifications sent successfully, skipping Expo tokens`);
            return {
              success: true,
              successCount: fcmResult.successCount,
              failureCount: fcmResult.failureCount || 0,
              results: results,
              note: 'FCM notifications sent successfully, Expo tokens skipped to avoid duplicates'
            };
          }
        } catch (error) {
          console.error('❌ Admin FCM notification failed:', error);
          results.push({ type: 'fcm', result: { success: false, error: error.message } });
        }
      }

      // Send to Expo tokens (only if no FCM tokens or FCM failed)
      if (expoTokens.length > 0) {
        if (fcmTokens.length === 0) {
          console.log(`📱 No FCM tokens available, sending admin notification to ${expoTokens.length} Expo tokens`);
        } else {
          console.log(`📱 FCM had issues, attempting admin notification to ${expoTokens.length} Expo tokens as fallback`);
        }
        
        try {
          const expoResult = await this.expoService.sendToMultipleDevices(expoTokens, notification, data);
          results.push({ type: 'expo', result: expoResult });
        } catch (error) {
          console.error('❌ Admin Expo notification failed:', error);
          results.push({ type: 'expo', result: { success: false, error: error.message } });
        }
      }

      // Combine results
      const totalSuccess = results.reduce((sum, r) => sum + (r.result.successCount || 0), 0);
      const totalFailure = results.reduce((sum, r) => sum + (r.result.failureCount || 0), 0);

      return {
        success: totalSuccess > 0,
        successCount: totalSuccess,
        failureCount: totalFailure,
        results: results,
      };
    } catch (error) {
      console.error('❌ Failed to send notification to admins:', error);
      return { success: false, error: error.message };
    }
  }

  // Send order assignment notification to specific delivery person
  async sendOrderAssignmentNotificationToDelivery(assignmentData) {
    try {
      const { orderId, deliveryAgentId, customerName, deliveryAddress, totalAmount } = assignmentData;
      
      console.log(`🚚 Sending order assignment notification to delivery agent ${deliveryAgentId} for order ${orderId}`);
      
      // Get delivery agent user details
      const User = require('../models/User');
      const deliveryAgent = await User.findById(deliveryAgentId);
      
      if (!deliveryAgent) {
        console.warn(`Delivery agent not found: ${deliveryAgentId}`);
        return { success: false, error: 'Delivery agent not found' };
      }
      
      if (deliveryAgent.role !== 'delivery') {
        console.warn(`User ${deliveryAgentId} is not a delivery agent`);
        return { success: false, error: 'User is not a delivery agent' };
      }
      
      // Get active device tokens for the delivery agent
      const deliveryTokens = await DeviceToken.find({
        userId: deliveryAgentId,
        isActive: true,
      }).populate('userId', 'name role');
      
      if (deliveryTokens.length === 0) {
        console.warn(`No active device tokens found for delivery agent ${deliveryAgent.name}`);
        return { success: false, error: 'No active device tokens found for delivery agent' };
      }

      console.log(`📱 Found ${deliveryTokens.length} active tokens for delivery agent ${deliveryAgent.name}`);

      // Create notification content
      const notification = {
        title: '🚚 New Delivery Assignment!',
        body: `Order #${orderId} assigned to you • ${customerName} • ₹${totalAmount}`,
        channelId: 'pizza_delivery',
      };

      const data = {
        type: 'order_assignment',
        orderId: orderId,
        customerName: customerName,
        deliveryAddress: deliveryAddress,
        totalAmount: totalAmount.toString(),
        deliveryAgentId: deliveryAgentId,
        timestamp: new Date().toISOString(),
      };

      // Group tokens by type for efficient sending
      const fcmTokens = deliveryTokens.filter(t => t.tokenType === 'fcm').map(t => t.token);
      const expoTokens = deliveryTokens.filter(t => t.tokenType === 'expo').map(t => t.token);

      console.log(`📊 Delivery notification: ${fcmTokens.length} FCM tokens, ${expoTokens.length} Expo tokens`);

      const results = [];

      // Send to FCM tokens first (preferred)
      if (fcmTokens.length > 0) {
        console.log(`🔥 Sending delivery assignment notification to ${fcmTokens.length} FCM tokens`);
        try {
          const fcmResult = await this.firebaseService.sendToMultipleDevices(fcmTokens, notification, data);
          results.push({ type: 'fcm', result: fcmResult });
          
          // If FCM succeeds for all tokens, skip Expo
          if (fcmResult.success && fcmResult.successCount === fcmTokens.length) {
            console.log(`✅ All delivery FCM notifications sent successfully for order ${orderId}`);
            return {
              success: true,
              successCount: fcmResult.successCount,
              failureCount: fcmResult.failureCount || 0,
              results: results,
              note: 'FCM notifications sent successfully, Expo tokens skipped to avoid duplicates'
            };
          }
        } catch (error) {
          console.error('❌ Delivery FCM notification failed:', error);
          results.push({ type: 'fcm', result: { success: false, error: error.message } });
        }
      }

      // Send to Expo tokens (only if no FCM tokens or FCM failed)
      if (expoTokens.length > 0) {
        if (fcmTokens.length === 0) {
          console.log(`📱 No FCM tokens available, sending delivery assignment notification to ${expoTokens.length} Expo tokens`);
        } else {
          console.log(`📱 FCM had issues, attempting delivery assignment notification to ${expoTokens.length} Expo tokens`);
        }
        
        try {
          const expoResult = await this.expoService.sendToMultipleDevices(expoTokens, notification, data);
          results.push({ type: 'expo', result: expoResult });
        } catch (error) {
          console.error('❌ Delivery Expo notification failed:', error);
          results.push({ type: 'expo', result: { success: false, error: error.message } });
        }
      }

      // Calculate overall success
      const totalSuccess = results.reduce((sum, r) => sum + (r.result.successCount || 0), 0);
      const totalFailure = results.reduce((sum, r) => sum + (r.result.failureCount || 0), 0);

      console.log(`📊 Delivery assignment notification summary: ${totalSuccess} successful, ${totalFailure} failed`);

      return {
        success: totalSuccess > 0,
        successCount: totalSuccess,
        failureCount: totalFailure,
        results: results,
        deliveryAgent: deliveryAgent.name,
      };
    } catch (error) {
      console.error('❌ Error sending order assignment notification to delivery agent:', error);
      return { success: false, error: error.message };
    }
  }

  // Send order update notification to customer
  async sendOrderUpdateNotification(userId, orderData) {
    try {
      const { orderId, status } = orderData;
      
      console.log(`📦 Sending order update notification to customer ${userId} for order ${orderId} (status: ${status})`);
      
      // Get customer user details
      const User = require('../models/User');
      const customer = await User.findById(userId);
      
      if (!customer) {
        console.warn(`Customer not found: ${userId}`);
        return { success: false, error: 'Customer not found' };
      }
      
      // Get active device tokens for the customer
      const customerTokens = await DeviceToken.find({
        userId: userId,
        isActive: true,
      }).populate('userId', 'name role');
      
      if (customerTokens.length === 0) {
        console.warn(`No active device tokens found for customer ${customer.name}`);
        return { success: false, error: 'No active device tokens found for customer' };
      }

      console.log(`📱 Found ${customerTokens.length} active tokens for customer ${customer.name}`);

      // Create notification content based on status
      let title, body;
      switch (status) {
        case 'Preparing':
          title = '👨‍🍳 Order Being Prepared';
          body = `Your order #${orderId} is now being prepared!`;
          break;
        case 'Out for Delivery':
          title = '🚚 Order Out for Delivery';
          body = `Your order #${orderId} is on its way!`;
          break;
        case 'Delivered':
          title = '✅ Order Delivered';
          body = `Your order #${orderId} has been delivered. Enjoy your meal!`;
          break;
        case 'Cancelled':
          title = '❌ Order Cancelled';
          body = `Your order #${orderId} has been cancelled.`;
          break;
        default:
          title = '📋 Order Update';
          body = `Your order #${orderId} status: ${status}`;
      }

      const notification = {
        title,
        body,
        channelId: 'pizza_orders',
      };

      const data = {
        type: 'order_update',
        orderId: orderId,
        status: status,
        customerId: userId,
        timestamp: new Date().toISOString(),
      };

      // Group tokens by type for efficient sending
      const fcmTokens = customerTokens.filter(t => t.tokenType === 'fcm').map(t => t.token);
      const expoTokens = customerTokens.filter(t => t.tokenType === 'expo').map(t => t.token);

      console.log(`📊 Customer notification: ${fcmTokens.length} FCM tokens, ${expoTokens.length} Expo tokens`);

      const results = [];

      // Send to FCM tokens first (preferred)
      if (fcmTokens.length > 0) {
        console.log(`🔥 Sending order update notification to ${fcmTokens.length} FCM tokens`);
        try {
          const fcmResult = await this.firebaseService.sendToMultipleDevices(fcmTokens, notification, data);
          results.push({ type: 'fcm', result: fcmResult });
          
          // If FCM succeeds for all tokens, skip Expo
          if (fcmResult.success && fcmResult.successCount === fcmTokens.length) {
            console.log(`✅ All customer FCM notifications sent successfully for order ${orderId}`);
            return {
              success: true,
              successCount: fcmResult.successCount,
              failureCount: fcmResult.failureCount || 0,
              results: results,
              note: 'FCM notifications sent successfully, Expo tokens skipped to avoid duplicates'
            };
          }
        } catch (error) {
          console.error('❌ Customer FCM notification failed:', error);
          results.push({ type: 'fcm', result: { success: false, error: error.message } });
        }
      }

      // Send to Expo tokens (only if no FCM tokens or FCM failed)
      if (expoTokens.length > 0) {
        if (fcmTokens.length === 0) {
          console.log(`📱 No FCM tokens available, sending order update notification to ${expoTokens.length} Expo tokens`);
        } else {
          console.log(`📱 FCM had issues, attempting order update notification to ${expoTokens.length} Expo tokens`);
        }
        
        try {
          const expoResult = await this.expoService.sendToMultipleDevices(expoTokens, notification, data);
          results.push({ type: 'expo', result: expoResult });
        } catch (error) {
          console.error('❌ Customer Expo notification failed:', error);
          results.push({ type: 'expo', result: { success: false, error: error.message } });
        }
      }

      // Calculate overall success
      const totalSuccess = results.reduce((sum, r) => sum + (r.result.successCount || 0), 0);
      const totalFailure = results.reduce((sum, r) => sum + (r.result.failureCount || 0), 0);

      console.log(`📊 Order update notification summary: ${totalSuccess} successful, ${totalFailure} failed`);

      return {
        success: totalSuccess > 0,
        successCount: totalSuccess,
        failureCount: totalFailure,
        results: results,
        customer: customer.name,
      };
    } catch (error) {
      console.error('❌ Error sending order update notification to customer:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to determine token type
  getTokenType(token) {
    // FCM tokens are longer and more complex
    if (token.includes(':') && token.length > 140) {
      return 'fcm';
    }
    
    // Expo tokens start with ExponentPushToken
    if (token.startsWith('ExponentPushToken')) {
      return 'expo';
    }
    
    // Default to FCM if uncertain (newer Android tokens)
    if (token.length > 100) {
      return 'fcm';
    }
    
    return 'expo';
  }

  // Send new order notification to all admin users
  async sendNewOrderNotificationToAdmins(orderData) {
    try {
      const { orderId, customerName, totalAmount } = orderData;
      
      console.log(`📢 Sending new order notification to admins for order ${orderId}`);
      
      // Get all admin users and their active device tokens
      const User = require('../models/User');
      const adminUsers = await User.find({ role: 'admin' });
      
      if (adminUsers.length === 0) {
        console.warn('No admin users found in the system');
        return { success: false, error: 'No admin users found' };
      }
      
      const adminUserIds = adminUsers.map(admin => admin._id);
      
      // Get all active device tokens for admin users
      const adminTokens = await DeviceToken.find({
        userId: { $in: adminUserIds },
        isActive: true,
      }).populate('userId', 'name role');
      
      if (adminTokens.length === 0) {
        console.warn('No active device tokens found for admin users');
        return { success: false, error: 'No active device tokens found for admin users' };
      }

      console.log(`📱 Found ${adminTokens.length} active tokens for ${adminUsers.length} admin users`);

      // Create notification content
      const notification = {
        title: '🍕 New Order Received!',
        body: `Order #${orderId} from ${customerName} • ₹${totalAmount}`,
        channelId: 'pizza_orders',
      };

      const data = {
        type: 'new_order',
        orderId: orderId,
        customerName: customerName,
        totalAmount: totalAmount.toString(),
        timestamp: new Date().toISOString(),
      };

      // Group tokens by type for efficient sending
      const fcmTokens = adminTokens.filter(t => t.tokenType === 'fcm').map(t => t.token);
      const expoTokens = adminTokens.filter(t => t.tokenType === 'expo').map(t => t.token);

      console.log(`📊 Admin notification: ${fcmTokens.length} FCM tokens, ${expoTokens.length} Expo tokens`);

      const results = [];

      // Send to FCM tokens first (preferred)
      if (fcmTokens.length > 0) {
        console.log(`🔥 Sending new order notification to ${fcmTokens.length} FCM tokens`);
        try {
          const fcmResult = await this.firebaseService.sendToMultipleDevices(fcmTokens, notification, data);
          results.push({ type: 'fcm', result: fcmResult });
          
          // If FCM succeeds for all tokens, skip Expo
          if (fcmResult.success && fcmResult.successCount === fcmTokens.length) {
            console.log(`✅ All admin FCM notifications sent successfully for order ${orderId}`);
            return {
              success: true,
              successCount: fcmResult.successCount,
              failureCount: fcmResult.failureCount || 0,
              results: results,
              note: 'FCM notifications sent successfully, Expo tokens skipped to avoid duplicates'
            };
          }
        } catch (error) {
          console.error('❌ Admin FCM notification failed:', error);
          results.push({ type: 'fcm', result: { success: false, error: error.message } });
        }
      }

      // Send to Expo tokens (only if no FCM tokens or FCM failed)
      if (expoTokens.length > 0) {
        if (fcmTokens.length === 0) {
          console.log(`📱 No FCM tokens available, sending new order notification to ${expoTokens.length} Expo tokens`);
        } else {
          console.log(`📱 FCM had issues, attempting new order notification to ${expoTokens.length} Expo tokens`);
        }
        
        try {
          const expoResult = await this.expoService.sendToMultipleDevices(expoTokens, notification, data);
          results.push({ type: 'expo', result: expoResult });
        } catch (error) {
          console.error('❌ Admin Expo notification failed:', error);
          results.push({ type: 'expo', result: { success: false, error: error.message } });
        }
      }

      // Calculate overall success
      const totalSuccess = results.reduce((sum, r) => sum + (r.result.successCount || 0), 0);
      const totalFailure = results.reduce((sum, r) => sum + (r.result.failureCount || 0), 0);

      console.log(`📊 New order notification summary: ${totalSuccess} successful, ${totalFailure} failed`);

      return {
        success: totalSuccess > 0,
        successCount: totalSuccess,
        failureCount: totalFailure,
        results: results,
      };
    } catch (error) {
      console.error('❌ Error sending new order notification to admins:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new UnifiedNotificationService();
