const express = require('express');
const router = express.Router();
const { getHealthStatus } = require('../utils/healthMonitor');
const { getResponseTimePercentiles } = require('../middleware/performanceMonitor');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Simple health check endpoint that returns 200 OK
router.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Detailed health check with system status
router.get('/health', async (req, res) => {
  try {
    // Get current health status
    const health = getHealthStatus();
    
    // Get response time percentiles
    const responseTimePercentiles = getResponseTimePercentiles();
    
    // Check MongoDB connection
    const dbStatus = {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState
    };
    
    // Update service status
    health.serviceStatus.database = dbStatus.connected;
    
    // System resources
    const memoryUsage = process.memoryUsage();
    
    // Create health report
    const healthReport = {
      status: health.isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m ${Math.floor(process.uptime() % 60)}s`,
      services: health.serviceStatus,
      database: dbStatus,
      metrics: {
        responseTime: {
          avg: Math.round(health.metrics.responseTime.avg),
          ...responseTimePercentiles
        },
        errorRate: {
          rate: health.metrics.errorRate.total > 0 ? 
            (health.metrics.errorRate.count / health.metrics.errorRate.total * 100).toFixed(2) + '%' : '0%',
          count: health.metrics.errorRate.count,
          total: health.metrics.errorRate.total
        }
      },
      system: {
        memory: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
        },
        platform: process.platform,
        nodeVersion: process.version
      }
    };
    
    res.status(health.isHealthy ? 200 : 503).json(healthReport);
  } catch (error) {
    logger.error('Health check error', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to retrieve health status',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
