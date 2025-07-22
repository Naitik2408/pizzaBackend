// Optimized logging utility
class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  // Format timestamp
  getTimestamp() {
    return new Date().toISOString();
  }

  // Development logging (detailed)
  dev(message, data = null) {
    if (this.isDevelopment) {
      const timestamp = this.getTimestamp();
      console.log(`[${timestamp}] 🔧 ${message}`);
      if (data) {
        console.log(data);
      }
    }
  }

  // Info logging (always visible)
  info(message, data = null) {
    const timestamp = this.getTimestamp();
    console.log(`[${timestamp}] ℹ️ ${message}`);
    if (data && this.isDevelopment) {
      console.log(data);
    }
  }

  // Success logging
  success(message, data = null) {
    const timestamp = this.getTimestamp();
    console.log(`[${timestamp}] ✅ ${message}`);
    if (data && this.isDevelopment) {
      console.log(data);
    }
  }

  // Warning logging
  warn(message, data = null) {
    const timestamp = this.getTimestamp();
    console.warn(`[${timestamp}] ⚠️ ${message}`);
    if (data) {
      console.warn(data);
    }
  }

  // Error logging (always visible)
  error(message, error = null) {
    const timestamp = this.getTimestamp();
    console.error(`[${timestamp}] ❌ ${message}`);
    if (error) {
      if (this.isDevelopment) {
        console.error(error);
      } else {
        // In production, log only essential error info
        console.error({
          message: error.message,
          stack: error.stack?.split('\n')[0], // Only first line of stack
          timestamp: this.getTimestamp()
        });
      }
    }
  }

  // Socket events logging
  socket(event, message, data = null) {
    if (this.isDevelopment) {
      const timestamp = this.getTimestamp();
      console.log(`[${timestamp}] 🔌 [${event}] ${message}`);
      if (data) {
        console.log(data);
      }
    }
  }

  // API request logging
  api(method, path, userId = null, duration = null) {
    if (this.isDevelopment) {
      const timestamp = this.getTimestamp();
      const userInfo = userId ? ` [User: ${userId}]` : '';
      const durationInfo = duration ? ` (${duration}ms)` : '';
      console.log(`[${timestamp}] 🌐 ${method} ${path}${userInfo}${durationInfo}`);
    }
  }

  // Database operations logging
  db(operation, collection, details = null) {
    if (this.isDevelopment) {
      const timestamp = this.getTimestamp();
      console.log(`[${timestamp}] 🗄️ ${operation} on ${collection}`);
      if (details) {
        console.log(details);
      }
    }
  }

  // Notification logging
  notification(type, recipient, message) {
    const timestamp = this.getTimestamp();
    if (this.isDevelopment) {
      console.log(`[${timestamp}] 📱 [${type}] → ${recipient}: ${message}`);
    } else {
      // Production: Log only essential info
      console.log(`[${timestamp}] 📱 Notification sent: ${type}`);
    }
  }

  // Performance logging
  performance(operation, duration, details = null) {
    const timestamp = this.getTimestamp();
    const level = duration > 1000 ? '🐌' : duration > 500 ? '⚡' : '🚀';
    
    if (this.isDevelopment || duration > 1000) {
      console.log(`[${timestamp}] ${level} ${operation}: ${duration}ms`);
      if (details && this.isDevelopment) {
        console.log(details);
      }
    }
  }
}

const logger = new Logger();
module.exports = logger;
