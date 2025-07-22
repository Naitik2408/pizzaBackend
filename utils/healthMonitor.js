const healthStatus = {
  isHealthy: true,
  lastCheckTime: Date.now(),
  serviceStatus: {
    database: true,
    auth: true,
    api: true,
    notification: true
  },
  metrics: {
    responseTime: {
      avg: 0,
      samples: [],
      lastUpdate: Date.now()
    },
    errorRate: {
      count: 0,
      total: 0,
      lastUpdate: Date.now()
    }
  }
};

// Reset metrics at midnight
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    healthStatus.metrics.responseTime.avg = 0;
    healthStatus.metrics.responseTime.samples = [];
    healthStatus.metrics.errorRate.count = 0;
    healthStatus.metrics.errorRate.total = 0;
    healthStatus.metrics.responseTime.lastUpdate = Date.now();
    healthStatus.metrics.errorRate.lastUpdate = Date.now();
  }
}, 60000); // Check every minute

/**
 * Track API response time
 * @param {number} responseTime - Response time in ms
 */
const trackResponseTime = (responseTime) => {
  const { samples } = healthStatus.metrics.responseTime;
  samples.push(responseTime);
  
  // Keep only the last 100 samples
  if (samples.length > 100) {
    samples.shift();
  }
  
  // Calculate average
  healthStatus.metrics.responseTime.avg = 
    samples.reduce((sum, time) => sum + time, 0) / samples.length;
  
  healthStatus.metrics.responseTime.lastUpdate = Date.now();
};

/**
 * Track API request (success or error)
 * @param {boolean} isError - Whether the request resulted in an error
 */
const trackRequest = (isError = false) => {
  healthStatus.metrics.errorRate.total++;
  
  if (isError) {
    healthStatus.metrics.errorRate.count++;
  }
  
  healthStatus.metrics.errorRate.lastUpdate = Date.now();
};

/**
 * Update service status
 * @param {string} service - Service name
 * @param {boolean} isUp - Whether the service is up
 */
const updateServiceStatus = (service, isUp) => {
  if (healthStatus.serviceStatus.hasOwnProperty(service)) {
    healthStatus.serviceStatus[service] = isUp;
    
    // Update overall health status
    healthStatus.isHealthy = Object.values(healthStatus.serviceStatus).every(status => status);
    healthStatus.lastCheckTime = Date.now();
  }
};

/**
 * Get current health status
 * @returns {Object} Current health status
 */
const getHealthStatus = () => {
  return {
    ...healthStatus,
    uptime: process.uptime()
  };
};

module.exports = {
  healthStatus,
  trackResponseTime,
  trackRequest,
  updateServiceStatus,
  getHealthStatus
};
