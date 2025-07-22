const firebaseAdmin = require('../utils/firebaseAdmin');
const DeviceToken = require('../models/DeviceToken');

class FirebaseNotificationService {
  constructor() {
    this.messaging = null;
    this.initialized = false;
  }

  // Initialize the service
  initialize() {
    if (this.initialized) return;

    try {
      this.messaging = firebaseAdmin.getMessaging();
      this.initialized = true;
      
      const status = firebaseAdmin.getStatus();
      console.log(`✅ Firebase Notification Service initialized in ${status.mode} mode`);
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Notification Service:', error);
      throw error;
    }
  }

  // Send notification to a single device
  async sendToDevice(token, notification, data = {}) {
    this.initialize();

    try {
      const message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: {
          ...data,
          timestamp: Date.now().toString(),
        },
        android: {
          notification: {
            icon: 'notification_icon',
            color: '#FF6B35',
            sound: 'default',
            channelId: data.type === 'test' ? 'test' : data.type === 'order' ? 'orders' : data.type === 'offer' ? 'offers' : 'default',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            visibility: 'public',
            notificationPriority: 'PRIORITY_MAX',
          },
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              sound: 'notification_sound.wav',
              badge: 1,
            },
          },
        },
      };

      const response = await this.messaging.send(message);
      console.log('✅ Notification sent successfully:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
      
      // Handle invalid tokens
      if (error.code === 'messaging/registration-token-not-registered' || 
          error.code === 'messaging/invalid-registration-token') {
        console.log('📱 Invalid token, deactivating:', token);
        await this.deactivateToken(token);
      }
      
      return { success: false, error: error.message };
    }
  }

  // Send notification to multiple devices
  async sendToMultipleDevices(tokens, notification, data = {}) {
    this.initialize();

    if (!tokens || tokens.length === 0) {
      console.warn('No tokens provided for multicast');
      return { success: false, error: 'No tokens provided' };
    }

    try {
      const message = {
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: {
          ...data,
          timestamp: Date.now().toString(),
        },
        android: {
          notification: {
            icon: 'notification_icon',
            color: '#FF6B35',
            sound: 'notification_sound',
            channelId: 'default',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
          priority: 'high',
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              sound: 'notification_sound.wav',
              badge: 1,
            },
          },
        },
      };

      const response = await this.messaging.sendEachForMulticast(message);
      
      console.log(`✅ Multicast sent. Success: ${response.successCount}, Failed: ${response.failureCount}`);
      
      // Handle failed tokens
      if (response.failureCount > 0) {
        await this.handleFailedTokens(tokens, response.responses);
      }

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        results: response.responses,
      };
    } catch (error) {
      console.error('❌ Failed to send multicast notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to user(s)
  async sendToUser(userId, notification, data = {}) {
    try {
      const tokens = await DeviceToken.findActiveTokensForUser(userId);
      
      if (tokens.length === 0) {
        console.warn(`No active tokens found for user: ${userId}`);
        return { success: false, error: 'No active tokens found' };
      }

      const tokenStrings = tokens.map(t => t.token);
      return await this.sendToMultipleDevices(tokenStrings, notification, data);
    } catch (error) {
      console.error('❌ Failed to send notification to user:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to multiple users
  async sendToUsers(userIds, notification, data = {}) {
    try {
      const tokens = await DeviceToken.findActiveTokensForUsers(userIds);
      
      if (tokens.length === 0) {
        console.warn('No active tokens found for users:', userIds);
        return { success: false, error: 'No active tokens found' };
      }

      const tokenStrings = tokens.map(t => t.token);
      return await this.sendToMultipleDevices(tokenStrings, notification, data);
    } catch (error) {
      console.error('❌ Failed to send notification to users:', error);
      return { success: false, error: error.message };
    }
  }

  // Send order update notification
  async sendOrderUpdateNotification(userId, orderData) {
    const notification = {
      title: '🍕 Order Update',
      body: `Your order #${orderData.orderId} is ${orderData.status}`,
    };

    const data = {
      type: 'order',
      orderId: orderData.orderId.toString(),
      status: orderData.status,
      userId: userId.toString(),
    };

    return await this.sendToUser(userId, notification, data);
  }

  // Send offer notification
  async sendOfferNotification(userIds, offerData) {
    const notification = {
      title: '🎉 Special Offer!',
      body: offerData.description,
      imageUrl: offerData.imageUrl,
    };

    const data = {
      type: 'offer',
      offerId: offerData.offerId.toString(),
      discount: offerData.discount.toString(),
    };

    return await this.sendToUsers(userIds, notification, data);
  }

  // Send delivery update notification
  async sendDeliveryUpdateNotification(userId, deliveryData) {
    const notification = {
      title: '🚚 Delivery Update',
      body: `Your order is ${deliveryData.status}. ETA: ${deliveryData.eta}`,
    };

    const data = {
      type: 'delivery',
      orderId: deliveryData.orderId.toString(),
      status: deliveryData.status,
      eta: deliveryData.eta,
      deliveryPersonName: deliveryData.deliveryPersonName,
      deliveryPersonPhone: deliveryData.deliveryPersonPhone,
    };

    return await this.sendToUser(userId, notification, data);
  }

  // Send general notification to all users
  async sendBroadcastNotification(notification, data = {}) {
    try {
      // Get all active tokens (implement pagination for large datasets)
      const tokens = await DeviceToken.find({ isActive: true }).limit(1000);
      
      if (tokens.length === 0) {
        return { success: false, error: 'No active tokens found' };
      }

      const tokenStrings = tokens.map(t => t.token);
      
      // Split into batches of 500 (FCM limit)
      const batchSize = 500;
      const results = [];

      for (let i = 0; i < tokenStrings.length; i += batchSize) {
        const batch = tokenStrings.slice(i, i + batchSize);
        const result = await this.sendToMultipleDevices(batch, notification, { ...data, type: 'general' });
        results.push(result);
      }

      const totalSuccess = results.reduce((sum, r) => sum + (r.successCount || 0), 0);
      const totalFailure = results.reduce((sum, r) => sum + (r.failureCount || 0), 0);

      return {
        success: true,
        totalSuccess,
        totalFailure,
        batchResults: results,
      };
    } catch (error) {
      console.error('❌ Failed to send broadcast notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle failed tokens and deactivate them
  async handleFailedTokens(tokens, responses) {
    const failedTokens = [];
    
    responses.forEach((response, index) => {
      if (!response.success) {
        const error = response.error;
        console.log(`❌ Token ${index} failed:`, error.code, error.message);
        if (error.code === 'messaging/registration-token-not-registered' || 
            error.code === 'messaging/invalid-registration-token') {
          failedTokens.push(tokens[index]);
        }
      }
    });

    if (failedTokens.length > 0) {
      console.log(`📱 Deactivating ${failedTokens.length} invalid tokens`);
      await this.deactivateTokens(failedTokens);
    }
  }

  // Deactivate a single token
  async deactivateToken(token) {
    try {
      await DeviceToken.updateOne(
        { token },
        { isActive: false }
      );
    } catch (error) {
      console.error('Failed to deactivate token:', error);
    }
  }

  // Deactivate multiple tokens
  async deactivateTokens(tokens) {
    try {
      await DeviceToken.updateMany(
        { token: { $in: tokens } },
        { isActive: false }
      );
    } catch (error) {
      console.error('Failed to deactivate tokens:', error);
    }
  }

  // Send new order notification to admin users
  async sendNewOrderNotificationToAdmins(orderData, customerData) {
    try {
      // This method will be called from order controller
      // Find all admin users and get their device tokens
      const DeviceToken = require('../models/DeviceToken');
      const User = require('../models/User');
      
      const adminUsers = await User.find({ role: 'admin' }).select('_id');
      
      if (adminUsers.length === 0) {
        console.warn('No admin users found for new order notification');
        return { success: false, error: 'No admin users found' };
      }

      const adminUserIds = adminUsers.map(admin => admin._id);
      const tokens = await DeviceToken.findActiveTokensForUsers(adminUserIds);
      
      if (tokens.length === 0) {
        console.warn('No active device tokens found for admin users');
        return { success: false, error: 'No active admin tokens found' };
      }

      const notification = {
        title: '🍕 New Order Received!',
        body: `Order #${orderData.orderNumber} from ${customerData.name} - ₹${orderData.amount}`,
      };

      const data = {
        type: 'new_order',
        orderId: orderData.orderNumber.toString(),
        customerId: customerData.id.toString(),
        customerName: customerData.name,
        amount: orderData.amount.toString(),
        status: orderData.status,
        itemCount: orderData.itemCount?.toString() || '0',
        source: 'admin_alert',
        timestamp: Date.now().toString(),
      };

      const tokenStrings = tokens.map(t => t.token);
      const result = await this.sendToMultipleDevices(tokenStrings, notification, data);
      
      console.log(`✅ New order notification sent to ${result.successCount || 0} admin devices`);
      
      return {
        success: true,
        adminCount: adminUsers.length,
        tokenCount: tokens.length,
        successCount: result.successCount || 0,
        failureCount: result.failureCount || 0,
      };
    } catch (error) {
      console.error('❌ Failed to send new order notification to admins:', error);
      return { success: false, error: error.message };
    }
  }

  // Send order assignment notification to delivery agent
  async sendOrderAssignmentNotificationToDelivery(orderData) {
    try {
      const DeviceToken = require('../models/DeviceToken');
      
      const tokens = await DeviceToken.findActiveTokensForUser(orderData.deliveryAgentId);
      
      if (tokens.length === 0) {
        console.warn(`No active device tokens found for delivery agent: ${orderData.deliveryAgentId}`);
        return { success: false, error: 'No active delivery agent tokens found' };
      }

      const notification = {
        title: '🚚 New Delivery Assignment!',
        body: `Order #${orderData.orderId} assigned to you - ₹${orderData.totalAmount}`,
      };

      const data = {
        type: 'delivery_assignment',
        orderId: orderData.orderId.toString(),
        customerName: orderData.customerName,
        deliveryAddress: orderData.deliveryAddress,
        amount: orderData.totalAmount.toString(),
        timestamp: Date.now().toString(),
      };

      const tokenStrings = tokens.map(t => t.token);
      const result = await this.sendToMultipleDevices(tokenStrings, notification, data);
      
      console.log(`✅ Delivery assignment notification sent to ${result.successCount || 0} devices`);
      
      return {
        success: true,
        tokenCount: tokens.length,
        successCount: result.successCount || 0,
        failureCount: result.failureCount || 0,
      };
    } catch (error) {
      console.error('❌ Failed to send delivery assignment notification:', error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const firebaseNotificationService = new FirebaseNotificationService();

module.exports = firebaseNotificationService;
