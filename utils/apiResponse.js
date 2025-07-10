// utils/apiResponse.js

/**
 * Standard API response format
 * @param {boolean} success - Whether the operation was successful
 * @param {string} message - Response message
 * @param {any} data - Response data
 * @returns {object} Formatted response object
 */
const apiResponse = (success, message, data = null) => {
  return {
    success,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

// Legacy success function for backward compatibility
const success = (res, data, message = 'Success') => {
  return res.status(200).json(apiResponse(true, message, data));
};

// Legacy error function for backward compatibility
const error = (res, message = 'Error', statusCode = 500) => {
  return res.status(statusCode).json(apiResponse(false, message, null));
};

module.exports = {
  apiResponse,
  success,
  error
};