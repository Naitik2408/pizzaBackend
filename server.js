const app = require('./app');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const BusinessSettings = require('./models/Business');
require('dotenv').config();

// Connect to database
connectDB();

// Create HTTP server using Express app
const server = http.createServer(app);

// Initialize Socket.IO with optimized configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  // Optimized transports and timeouts
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 30000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6, // 1MB limit
  // Enable compression
  compression: true,
  // Connection state recovery
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  }
});

// Add Socket.IO instance to app for controller access
app.set('io', io);

// Optimized business status update function
const updateBusinessStatus = async () => {
  const startTime = Date.now();
  
  try {
    const settings = await BusinessSettings.findOrCreate();
    
    // Only update if manual override is not active
    if (!settings.businessInfo.manualOverride.isActive) {
      const isOpen = settings.isBusinessOpen();
      const currentStatus = settings.businessInfo.isCurrentlyOpen;
      
      // If status changed, update and emit event
      if (isOpen !== currentStatus) {
        settings.businessInfo.isCurrentlyOpen = isOpen;
        await settings.save();
        
        const status = settings.getBusinessStatus();
        io.emit('businessStatusChanged', status);
        
        logger.info(`Business status updated: ${isOpen ? 'OPEN' : 'CLOSED'} - ${status.reason}`);
      }
    }
    
    const duration = Date.now() - startTime;
    logger.performance('Business status check', duration);
    
  } catch (error) {
    logger.error('Error updating business status', error);
  }
};

// Update business status every minute (optimized interval)
const statusInterval = setInterval(updateBusinessStatus, 60000);

// Initial status check (delayed to allow DB connection)
setTimeout(updateBusinessStatus, 5000);

// Socket connection handling with optimization
io.on('connection', (socket) => {
  logger.socket('connection', `New client connected: ${socket.id}`);

  // Join rooms based on role
  socket.on('join', (data) => {
    try {
      const { userId, role } = data;

      if (userId) {
        // Join user-specific room
        socket.join(`user:${userId}`);

        // Join role-based room
        if (role) {
          socket.join(`role:${role}`);
        }

        logger.socket('join', `Socket ${socket.id} joined rooms for user ${userId}, role ${role}`);
      }
    } catch (error) {
      logger.error('Error in socket join', error);
    }
  });

  // Handle delivery agent status changes
  socket.on('delivery_status_change', async (data) => {
    const startTime = Date.now();
    
    try {
      logger.socket('delivery_status_change', `Received delivery status change for ${data.name}: ${data.isOnline ? 'online' : 'offline'}`);
      
      // Update the database with the new status
      const User = require('./models/User');
      await User.findByIdAndUpdate(
        data._id,
        {
          'deliveryDetails.isOnline': data.isOnline,
          'deliveryDetails.lastActiveTime': data.lastActiveTime || new Date()
        },
        { new: true }
      );
      
      logger.db('update', 'User', `Delivery status for ${data.name}`);
      
      // Emit to all admin users
      socket.to('role:admin').emit('delivery_status_update', data);
      socket.to('role:admin').emit('delivery_status_change', data);
      
      const duration = Date.now() - startTime;
      logger.performance('Delivery status update', duration);
      logger.socket('delivery_status_change', `Broadcasted delivery status update for ${data.name}`);
      
    } catch (error) {
      logger.error('Error handling delivery status change', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    logger.socket('disconnect', `Client disconnected: ${socket.id}, reason: ${reason}`);
  });

  // Handle socket errors
  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}`, error);
  });
});

// Graceful shutdown handling
const gracefulShutdown = () => {
  logger.info('Received shutdown signal, closing server gracefully...');
  
  // Clear intervals
  clearInterval(statusInterval);
  
  // Close server
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close Socket.IO
    io.close(() => {
      logger.info('Socket.IO server closed');
      process.exit(0);
    });
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Listen for shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at Promise', { reason, promise });
  gracefulShutdown();
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  logger.success(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  logger.info(`📊 Process ID: ${process.pid}`);
  logger.info(`💾 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);
});