// Performance monitoring middleware
const logger = require('../utils/logger');
const { trackResponseTime, trackRequest } = require('../utils/healthMonitor');

/**
 * Calculate percentile from array of numbers
 * @param {Array<number>} values - Array of numbers
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} - Percentile value
 */
const calculatePercentile = (values, percentile) => {
  if (!values.length) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
};

// Store recent response times for percentile calculations
const responseTimeSamples = {
  values: [],
  maxSamples: 1000
};

/**
 * Add sample to response time tracking
 * @param {number} value - Response time in ms
 */
const addResponseTimeSample = (value) => {
  responseTimeSamples.values.push(value);
  
  // Keep sample size bounded
  if (responseTimeSamples.values.length > responseTimeSamples.maxSamples) {
    responseTimeSamples.values.shift();
  }
};

/**
 * Get response time percentiles
 * @returns {Object} - Percentiles object
 */
const getResponseTimePercentiles = () => {
  return {
    p50: calculatePercentile(responseTimeSamples.values, 50),
    p90: calculatePercentile(responseTimeSamples.values, 90),
    p95: calculatePercentile(responseTimeSamples.values, 95),
    p99: calculatePercentile(responseTimeSamples.values, 99),
    samples: responseTimeSamples.values.length
  };
};

const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // Capture original end function
  const originalEnd = res.end;

  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
    
    // Track for health monitoring
    trackResponseTime(duration);
    trackRequest(res.statusCode >= 400);
    
    // Add to response time samples
    addResponseTimeSample(duration);
    
    // Log performance metrics
    logger.performance(
      `${req.method} ${req.originalUrl}`,
      duration,
      {
        statusCode: res.statusCode,
        memoryDelta: `${Math.round(memoryDelta / 1024)}KB`,
        userAgent: req.get('User-Agent')?.substring(0, 50),
        ip: req.ip || req.connection.remoteAddress
      }
    );

    // Log slow requests in production
    if (duration > 2000) {
      const slowRequestInfo = {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent')?.substring(0, 50),
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
      };
      
      logger.warn('Slow request detected', slowRequestInfo);
    }

    // Call original end function
    originalEnd.apply(res, args);
  };

  next();
};

// Export both the middleware and utility functions
module.exports = {
  performanceMonitor,
  getResponseTimePercentiles
};
