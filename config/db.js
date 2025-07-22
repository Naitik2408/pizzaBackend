const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    // Simplified, compatible connection options - removed problematic bufferMaxEntries
    const options = {
      // Connection pool settings
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      
      // Performance optimizations (compatible with current MongoDB driver)
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
    };

    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    
    logger.success(`MongoDB connected: ${conn.connection.host}`);
    
    // Connection event listeners
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connection established');
    });
    
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
  } catch (err) {
    logger.error('MongoDB connection failed', err);
    process.exit(1);
  }
};

module.exports = connectDB;