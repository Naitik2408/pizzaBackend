const fetch = require('node-fetch');

// Firebase project configuration
const FIREBASE_PROJECT_ID = 'pizza-abe9a';
const FIREBASE_SERVER_KEY = 'AAAA3YqFqYc:APA91bFJ7hQcLZSq3LiUfGKNzJvqGFLgIqzqvjqM2CfEUfWWQCIjNKKTgJ0G7f-zM6wqTfFKqvwJOANXAZbm-VVEQiYJfWBmLNKHmQSPGaRqjVm5h4fVmGJfWBmLNKHmQSPGaRqjVm5h4fVmGJfWBmLNKHmQSPGaRqjVm5h4fVmGJfWBmLNKHmQSPGaRqjVm5h4f'; // Your Firebase server key

/**
 * Send FCM notification using Firebase Cloud Messaging API
 */
const sendFCMNotification = async (tokens, notification, data = {}) => {
  try {
    if (!tokens || tokens.length === 0) {
      return { success: false, message: 'No FCM tokens provided' };
    }

    console.log(`🔥 Sending FCM notification to ${tokens.length} tokens`);

    // Prepare the FCM message
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        icon: 'ic_launcher',
        sound: 'notification_sound.wav',
        badge: '1',
        tag: 'order_alert',
        color: '#FF6B00',
        priority: 'high',
        visibility: 'public',
        category: 'call',
        actions: [
          {
            action: 'view_order',
            title: 'View Order',
            icon: 'ic_view'
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: 'ic_dismiss'
          }
        ]
      },
      data: {
        ...data,
        timestamp: Date.now().toString(),
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      priority: 'high',
      content_available: true,
      android: {
        priority: 'high',
        notification: {
          channel_id: 'critical_order_alerts',
          priority: 'high',
          default_sound: false,
          default_vibrate_timings: false,
          default_light_settings: false,
          sound: 'notification_sound.wav',
          vibrate_timings: ['0s', '1s', '0.5s', '1s'],
          light_settings: {
            color: {
              red: 1.0,
              green: 0.0,
              blue: 0.0,
              alpha: 1.0
            },
            light_on_duration: '1s',
            light_off_duration: '0.5s'
          },
          visibility: 'public',
          local_only: false,
          sticky: false,
          actions: [
            {
              action: 'view_order',
              title: 'View Order',
              icon: 'ic_view'
            }
          ]
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body
            },
            sound: 'notification_sound.wav',
            badge: 1,
            category: 'ORDER_ALERT',
            'interruption-level': 'critical',
            'relevance-score': 1.0,
            'thread-id': 'order-alerts'
          }
        }
      }
    };

    // Send to each token individually for better error handling
    const results = await Promise.allSettled(
      tokens.map(async (token) => {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${FIREBASE_SERVER_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...message,
            to: token
          })
        });

        if (!response.ok) {
          throw new Error(`FCM request failed: ${response.status}`);
        }

        return await response.json();
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`🔥 FCM Results: ${successful} successful, ${failed} failed`);

    return {
      success: successful > 0,
      successful,
      failed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
    };
  } catch (error) {
    console.error('❌ FCM Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send critical order alert via FCM
 */
const sendCriticalOrderAlert = async (tokens, orderData) => {
  const notification = {
    title: '🚨 URGENT: NEW ORDER ALERT! 🚨',
    body: `${orderData.customerName} placed order #${orderData.orderNumber} - ₹${orderData.amount}. IMMEDIATE ACTION REQUIRED!`
  };

  const data = {
    type: 'critical_order_alert',
    orderId: orderData.orderId,
    orderNumber: orderData.orderNumber,
    customerName: orderData.customerName,
    amount: orderData.amount.toString(),
    urgency: 'critical',
    requiresAction: 'true',
    systemAlert: 'true',
    fullScreen: 'true',
    callLike: 'true'
  };

  return await sendFCMNotification(tokens, notification, data);
};

/**
 * Test FCM notification
 */
const testFCMNotification = async (tokens) => {
  const notification = {
    title: '🧪 Test Notification',
    body: 'This is a test notification from your Pizza app backend.'
  };

  const data = {
    type: 'test_notification',
    timestamp: Date.now().toString()
  };

  return await sendFCMNotification(tokens, notification, data);
};

module.exports = {
  sendFCMNotification,
  sendCriticalOrderAlert,
  testFCMNotification
};
