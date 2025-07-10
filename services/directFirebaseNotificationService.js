const firebaseAdmin = require('../utils/firebaseAdmin');
const DeviceToken = require('../models/DeviceToken');

class DirectFirebaseNotificationService {
  constructor() {
    this.initialized = false;
  }

  // Initialize the service
  initialize() {
    if (this.initialized) return;

    try {
      this.messaging = firebaseAdmin.getMessaging();
      this.initialized = true;
      console.log('✅ Direct Firebase Notification Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Direct Firebase Notification Service:', error);
      throw error;
    }
  }

  // Send direct Firebase notification (works with any push token)
  async sendDirectNotification(token, notification, data = {}) {
    this.initialize();

    try {
      // Create FCM message for HTTP v1 API
      const message = {
        token: token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          ...data,
          timestamp: Date.now().toString(),
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'pizza-notifications',
            sound: 'default',
            icon: 'notification_icon',
            color: '#FF6B35'
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              alert: {
                title: notification.title,
                body: notification.body,
              },
            },
          },
        },
      };

      console.log('🔥 Sending direct Firebase notification:', message);
      
      const result = await this.messaging.send(message);
      console.log('✅ Direct Firebase notification sent:', result);
      
      return { success: true, messageId: result };
    } catch (error) {
      console.error('❌ Direct Firebase notification failed:', error);
      return { success: false, error: error.message };
    }
  }



  // Get status
  getStatus() {
    return {
      initialized: this.initialized,
      service: 'Direct Firebase Notifications',
      timestamp: new Date().toISOString(),
      mode: process.env.NODE_ENV || 'Development'
    };
  }
}

// Create singleton instance
const directFirebaseNotificationService = new DirectFirebaseNotificationService();

module.exports = directFirebaseNotificationService;
