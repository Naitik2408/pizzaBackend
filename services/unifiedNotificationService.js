const firebaseNotificationService = require('./firebaseNotificationService');
const logger = require('../utils/logger');

/**
 * Unified Notification Service
 * 
 * This service acts as a wrapper around Firebase notifications
 * and provides a unified interface for all notification operations.
 */
class UnifiedNotificationService {
  constructor() {
    this.firebaseService = firebaseNotificationService;
  }

  /**
   * Initialize the notification service
   */
  async initialize() {
    try {
      this.firebaseService.initialize();
      logger.success('Unified notification service initialized');
    } catch (error) {
      logger.error('Failed to initialize unified notification service', error);
      throw error;
    }
  }

  /**
   * Send notification to a single device
   */
  async sendToDevice(token, notification, data = {}) {
    try {
      logger.notification('send_to_device', `Sending to token: ${token.substring(0, 20)}...`);
      const result = await this.firebaseService.sendToDevice(token, notification, data);
      logger.notification('send_to_device', `Result: ${result.success ? 'success' : 'failed'}`);
      return result;
    } catch (error) {
      logger.error('Error sending notification to device', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to multiple devices
   */
  async sendToMultipleDevices(tokens, notification, data = {}) {
    try {
      logger.notification('send_to_multiple', `Sending to ${tokens.length} devices`);
      const result = await this.firebaseService.sendToMultipleDevices(tokens, notification, data);
      logger.notification('send_to_multiple', `Success: ${result.successCount}, Failed: ${result.failureCount}`);
      return result;
    } catch (error) {
      logger.error('Error sending notification to multiple devices', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to a user
   */
  async sendToUser(userId, notification, data = {}) {
    try {
      logger.notification('send_to_user', `Sending to user: ${userId}`);
      const result = await this.firebaseService.sendToUser(userId, notification, data);
      logger.notification('send_to_user', `Result: ${result.success ? 'success' : 'failed'}`);
      return result;
    } catch (error) {
      logger.error('Error sending notification to user', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToUsers(userIds, notification, data = {}) {
    try {
      logger.notification('send_to_users', `Sending to ${userIds.length} users`);
      const result = await this.firebaseService.sendToUsers(userIds, notification, data);
      logger.notification('send_to_users', `Result: ${result.success ? 'success' : 'failed'}`);
      return result;
    } catch (error) {
      logger.error('Error sending notification to users', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send order update notification
   */
  async sendOrderUpdateNotification(userId, orderData) {
    try {
      logger.notification('order_update', `Order ${orderData.orderId} update to user ${userId}`);
      const result = await this.firebaseService.sendOrderUpdateNotification(userId, orderData);
      logger.notification('order_update', `Result: ${result.success ? 'success' : 'failed'}`);
      return result;
    } catch (error) {
      logger.error('Error sending order update notification', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send offer notification
   */
  async sendOfferNotification(userIds, offerData) {
    try {
      logger.notification('offer', `Offer notification to ${userIds.length} users`);
      const result = await this.firebaseService.sendOfferNotification(userIds, offerData);
      logger.notification('offer', `Result: ${result.success ? 'success' : 'failed'}`);
      return result;
    } catch (error) {
      logger.error('Error sending offer notification', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send delivery update notification
   */
  async sendDeliveryUpdateNotification(userId, deliveryData) {
    try {
      logger.notification('delivery_update', `Delivery update for order ${deliveryData.orderId} to user ${userId}`);
      const result = await this.firebaseService.sendDeliveryUpdateNotification(userId, deliveryData);
      logger.notification('delivery_update', `Result: ${result.success ? 'success' : 'failed'}`);
      return result;
    } catch (error) {
      logger.error('Error sending delivery update notification', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send broadcast notification to all users
   */
  async sendBroadcastNotification(notification, data = {}) {
    try {
      logger.notification('broadcast', 'Sending broadcast notification');
      const result = await this.firebaseService.sendBroadcastNotification(notification, data);
      logger.notification('broadcast', `Result: Success: ${result.totalSuccess}, Failed: ${result.totalFailure}`);
      return result;
    } catch (error) {
      logger.error('Error sending broadcast notification', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send new order notification to admin users
   * This is the function that was missing and causing the error
   */
  async sendNewOrderNotificationToAdmins(orderData) {
    try {
      logger.notification('new_order_admin', `New order ${orderData.orderId} notification to admins`);
      
      // Create customer data object from order data
      const customerData = {
        id: orderData.customerId || 'unknown',
        name: orderData.customerName || 'Unknown Customer'
      };

      // Format order data for Firebase service
      const formattedOrderData = {
        orderNumber: orderData.orderId,
        amount: orderData.totalAmount,
        status: orderData.status || 'pending',
        itemCount: orderData.itemCount || 0
      };

      const result = await this.firebaseService.sendNewOrderNotificationToAdmins(formattedOrderData, customerData);
      
      if (result.success) {
        logger.notification('new_order_admin', `✅ Notification sent to ${result.successCount} admin devices`);
      } else {
        logger.notification('new_order_admin', `❌ Failed to send notification: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error sending new order notification to admins', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send order assignment notification to delivery agent
   */
  async sendOrderAssignmentNotificationToDelivery(orderData) {
    try {
      logger.notification('delivery_assignment', `Order ${orderData.orderId} assigned to delivery agent ${orderData.deliveryAgentId}`);
      
      const result = await this.firebaseService.sendOrderAssignmentNotificationToDelivery(orderData);
      
      if (result.success) {
        logger.notification('delivery_assignment', `✅ Notification sent to ${result.successCount} devices`);
      } else {
        logger.notification('delivery_assignment', `❌ Failed to send notification: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error sending delivery assignment notification', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Deactivate a device token
   */
  async deactivateToken(token) {
    try {
      await this.firebaseService.deactivateToken(token);
      logger.notification('deactivate_token', `Token deactivated: ${token.substring(0, 20)}...`);
    } catch (error) {
      logger.error('Error deactivating token', error);
    }
  }

  /**
   * Deactivate multiple device tokens
   */
  async deactivateTokens(tokens) {
    try {
      await this.firebaseService.deactivateTokens(tokens);
      logger.notification('deactivate_tokens', `${tokens.length} tokens deactivated`);
    } catch (error) {
      logger.error('Error deactivating tokens', error);
    }
  }
}

// Create and export singleton instance
const unifiedNotificationService = new UnifiedNotificationService();

module.exports = unifiedNotificationService;
