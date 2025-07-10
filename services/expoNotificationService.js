const { Expo } = require('expo-server-sdk');
const DeviceToken = require('../models/DeviceToken');
const firebaseAdmin = require('../utils/firebaseAdmin');

class ExpoNotificationService {
  constructor() {
    this.initialized = false;
    console.log('🔍 Environment variables:', {
      USE_FIREBASE_ADMIN_FOR_EXPO: process.env.USE_FIREBASE_ADMIN_FOR_EXPO,
      USE_PURE_EXPO_NOTIFICATIONS: process.env.USE_PURE_EXPO_NOTIFICATIONS
    });
    this.useFirebaseAdmin = process.env.USE_FIREBASE_ADMIN_FOR_EXPO === 'true';
    this.usePureExpo = process.env.USE_PURE_EXPO_NOTIFICATIONS === 'true';
    console.log('🎯 Service flags:', {
      useFirebaseAdmin: this.useFirebaseAdmin,
      usePureExpo: this.usePureExpo
    });
    
    // Initialize Expo with Firebase Admin SDK access token for HTTP v1 API
    this.initializeExpo();
  }

  // Initialize Expo with proper authentication
  async initializeExpo() {
    try {
      if (this.useFirebaseAdmin) {
        console.log('🔑 Initializing Expo with Firebase Admin SDK (HTTP v1 API)');
        const accessToken = await this.getFirebaseAccessToken();
        if (accessToken) {
          this.expo = new Expo({
            accessToken: accessToken,
            useFcmV1: true // Use new FCM HTTP v1 API
          });
        } else {
          console.log('⚠️ Failed to get Firebase access token, using default Expo');
          this.expo = new Expo();
        }
      } else {
        console.log('📱 Using pure Expo notifications (no Firebase)');
        this.expo = new Expo();
      }
    } catch (error) {
      console.error('❌ Error initializing Expo:', error);
      this.expo = new Expo();
    }
  }

  // Get Firebase access token using Admin SDK (for HTTP v1 API)
  async getFirebaseAccessToken() {
    try {
      const admin = firebaseAdmin.getApp();
      const accessToken = await admin.options.credential.getAccessToken();
      console.log('🔑 Firebase access token obtained for HTTP v1 API');
      return accessToken.access_token;
    } catch (error) {
      console.error('❌ Failed to get Firebase access token:', error);
      return null;
    }
  }

  // Initialize the service
  initialize() {
    if (this.initialized) return;

    try {
      if (this.usePureExpo) {
        console.log('✅ Expo Notification Service initialized with Pure Expo (no FCM)');
      } else if (this.useFirebaseAdmin) {
        console.log('✅ Expo Notification Service initialized with Firebase Admin SDK (HTTP v1)');
      } else {
        console.log('✅ Expo Notification Service initialized with Expo SDK');
      }
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Expo Notification Service:', error);
      throw error;
    }
  }

  // Get status of the notification service
  getStatus() {
    return {
      initialized: this.initialized,
      useFirebaseAdmin: this.useFirebaseAdmin,
      usePureExpo: this.usePureExpo,
      service: 'Expo Push Notifications',
      timestamp: new Date().toISOString(),
      mode: process.env.NODE_ENV || 'Development'
    };
  }

  // Send notification to a single device
  async sendToDevice(token, notification, data = {}) {
    await this.initializeExpo(); // Ensure Expo is initialized
    this.initialize();

    try {
      // Check if token is valid Expo push token
      if (!Expo.isExpoPushToken(token)) {
        console.error('❌ Invalid Expo push token:', token);
        return { success: false, error: 'Invalid Expo push token' };
      }

      // If using pure Expo notifications, skip Firebase entirely
      if (this.usePureExpo) {
        console.log('🚀 Using Pure Expo notifications (no FCM)');
        return await this.sendPureExpoNotification(token, notification, data);
      }

      // If using Firebase Admin SDK, try Firebase first
      if (this.useFirebaseAdmin) {
        try {
          const firebaseResult = await this.sendViaFirebaseAdmin(token, notification, data);
          if (firebaseResult.success) {
            return firebaseResult;
          }
          console.log('Firebase Admin SDK failed, trying Expo...');
        } catch (error) {
          console.log('Firebase Admin SDK failed, falling back to Expo:', error.message);
        }
      }

      // Use Expo SDK
      const message = {
        to: token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: data,
        priority: 'high',
        badge: 1,
      };

      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('❌ Error sending push notification chunk:', error);
        }
      }

      console.log('✅ Expo notification sent successfully:', tickets);
      return { success: true, tickets };
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification using pure Expo service (no FCM required)
  async sendPureExpoNotification(expoToken, notification, data = {}) {
    try {
      await this.initializeExpo(); // Ensure Expo is initialized
      
      if (!Expo.isExpoPushToken(expoToken)) {
        console.error('❌ Invalid Expo push token:', expoToken);
        return { success: false, error: 'Invalid Expo push token' };
      }

      const message = {
        to: expoToken,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: data,
        priority: 'high',
        ttl: 86400, // 24 hours
      };

      console.log('📤 Sending pure Expo notification:', message);

      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          // Use Expo's push service directly with proper authentication
          console.log('🚀 Sending chunk to Expo push service...');
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          console.log('✅ Pure Expo notification ticket received:', ticketChunk);
        } catch (error) {
          console.error('❌ Error sending pure Expo notification chunk:', error);
          return { success: false, error: error.message };
        }
      }

      // Check if notification was successful
      const successTickets = tickets.filter(ticket => ticket.status === 'ok');
      const errorTickets = tickets.filter(ticket => ticket.status === 'error');

      console.log('📊 Notification results:', {
        total: tickets.length,
        success: successTickets.length,
        failed: errorTickets.length,
        tickets: tickets
      });

      return {
        success: successTickets.length > 0,
        successCount: successTickets.length,
        failureCount: errorTickets.length,
        tickets: tickets
      };

    } catch (error) {
      console.error('❌ Error in pure Expo notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification via Firebase Admin SDK (for Expo tokens)
  async sendViaFirebaseAdmin(token, notification, data = {}) {
    try {
      console.log('🔥 Attempting to send via Firebase Admin SDK to Expo token:', token);
      
      const messaging = firebaseAdmin.getMessaging();
      
      // Create a message that works with Expo tokens using HTTP v1 API
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

      const result = await messaging.send(message);
      console.log('✅ Firebase Admin notification sent:', result);
      
      return { success: true, messageId: result };
    } catch (error) {
      console.error('❌ Firebase Admin notification failed:', error);
      
      // If Firebase Admin fails, try the pure Expo method as fallback
      console.log('🔄 Falling back to pure Expo notification...');
      return await this.sendPureExpoNotification(token, notification, data);
    }
  }

  // Send to multiple users
  async sendToUsers(userIds, notification, data = {}) {
    this.initialize();

    try {
      // Get all active device tokens for these users
      const deviceTokens = await DeviceToken.find({ 
        userId: { $in: userIds },
        isActive: true 
      });

      if (deviceTokens.length === 0) {
        console.warn('No active device tokens found for users:', userIds);
        return { success: false, error: 'No device tokens found' };
      }

      const tokens = deviceTokens.map(dt => dt.token);
      return await this.sendToMultipleDevices(tokens, notification, data);
    } catch (error) {
      console.error('❌ Error sending to users:', error);
      return { success: false, error: error.message };
    }
  }

  // Send to multiple devices
  async sendToMultipleDevices(tokens, notification, data = {}) {
    await this.initializeExpo(); // Ensure Expo is initialized
    this.initialize();

    if (!tokens || tokens.length === 0) {
      console.warn('No tokens provided for multicast');
      return { success: false, error: 'No tokens provided' };
    }

    try {
      // Filter valid Expo push tokens
      const validTokens = tokens.filter(token => Expo.isExpoPushToken(token));
      
      if (validTokens.length === 0) {
        console.warn('No valid Expo push tokens found');
        return { success: false, error: 'No valid Expo push tokens' };
      }

      if (this.usePureExpo) {
        console.log('🎯 Using pure Expo notifications for multicast...');
        const results = [];
        
        for (const token of validTokens) {
          const result = await this.sendPureExpoNotification(token, notification, data);
          results.push(result);
        }
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        
        return {
          success: successCount > 0,
          successCount,
          failureCount,
          results
        };
      }

      const messages = validTokens.map(token => ({
        to: token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: data,
        priority: 'high',
        badge: 1,
      }));

      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('❌ Error sending push notification chunk:', error);
        }
      }

      const successCount = tickets.filter(ticket => ticket.status === 'ok').length;
      const failureCount = tickets.filter(ticket => ticket.status === 'error').length;

      console.log(`✅ Expo multicast sent. Success: ${successCount}, Failed: ${failureCount}`);
      
      return { 
        success: true, 
        successCount, 
        failureCount, 
        tickets 
      };
    } catch (error) {
      console.error('❌ Error sending multicast notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send new order notification to admins
  async sendNewOrderNotification(order) {
    try {
      // Get all admin users
      const User = require('../models/User');
      const admins = await User.find({ role: 'admin' });
      
      if (admins.length === 0) {
        console.warn('No admin users found');
        return { success: false, error: 'No admin users found' };
      }

      const adminIds = admins.map(admin => admin._id);
      
      const notification = {
        title: '🍕 New Order Alert!',
        body: `Order #${order.orderId} has been placed. Amount: ₹${order.totalAmount}`
      };

      const data = {
        type: 'new_order',
        orderId: order.orderId,
        amount: order.totalAmount,
        timestamp: new Date().toISOString()
      };

      console.log('📢 Sending new order notification to admins:', adminIds);
      
      const result = await this.sendToUsers(adminIds, notification, data);
      
      if (result.success) {
        console.log('✅ New order notification sent successfully');
      } else {
        console.error('❌ Failed to send new order notification:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error sending new order notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Direct Firebase notification (fallback)
  async sendDirectFirebaseNotification(userId, notification, data = {}) {
    try {
      const firebaseAdmin = require('../utils/firebaseAdmin');
      
      // Get user's device tokens
      const deviceTokens = await DeviceToken.find({
        userId: userId,
        isActive: true
      });

      if (deviceTokens.length === 0) {
        console.warn('No active device tokens found for user:', userId);
        return { success: false, error: 'No device tokens found' };
      }

      const messaging = firebaseAdmin.getMessaging();
      const results = [];

      for (const deviceToken of deviceTokens) {
        try {
          const message = {
            token: deviceToken.token,
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
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1,
                },
              },
            },
          };

          const result = await messaging.send(message);
          console.log('✅ Firebase notification sent:', result);
          results.push({ success: true, messageId: result });
        } catch (error) {
          console.error('❌ Failed to send to token:', deviceToken.token, error.message);
          results.push({ success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      console.log(`✅ Firebase multicast sent. Success: ${successCount}, Failed: ${failureCount}`);
      
      return {
        success: successCount > 0,
        successCount,
        failureCount,
        results
      };
    } catch (error) {
      console.error('❌ Error in direct Firebase notification:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const expoNotificationService = new ExpoNotificationService();

module.exports = expoNotificationService;
