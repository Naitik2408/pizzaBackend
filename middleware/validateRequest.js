const { body, validationResult } = require('express-validator');

// Generic validation middleware
const validateRequest = () => {
  return (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  };
};

// Simple validation middleware for basic checks
const simpleValidateRequest = (schema) => {
  return (req, res, next) => {
    const { body: requestBody } = req;
    const errors = [];

    // Basic validation based on schema
    if (schema) {
      Object.keys(schema).forEach(field => {
        const rules = schema[field];
        const value = requestBody[field];

        if (rules.notEmpty && (!value || value.toString().trim() === '')) {
          errors.push({
            field,
            message: rules.errorMessage || `${field} is required`
          });
        }

        if (rules.isIn && value && !rules.isIn.options[0].includes(value)) {
          errors.push({
            field,
            message: rules.errorMessage || `${field} must be one of: ${rules.isIn.options[0].join(', ')}`
          });
        }
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    next();
  };
};

module.exports = {
  validateRequest
};