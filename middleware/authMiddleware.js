const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');

// Updated protect middleware with proper error handling
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check if authorization header exists and has the correct format
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // If no token after Bearer, return error
      if (!token) {
        return res.status(401).json({
          message: 'Not authorized, token missing after Bearer prefix',
          orders: [] // Return empty array for orders endpoints
        });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      const user = await User.findById(decoded.id).select('-password');

      // If user not found in DB (might have been deleted)
      if (!user) {
        return res.status(401).json({
          message: 'User not found or deleted',
          orders: [] // Return empty array for orders endpoints
        });
      }

      // Set user in request object
      req.user = user;
      next();
    } catch (error) {
      console.error('Authentication error:', error);

      // Handle different JWT error types
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          message: 'Token expired, please login again',
          orders: [] // Return empty array for orders endpoints
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          message: 'Invalid token, please login again',
          orders: [] // Return empty array for orders endpoints
        });
      }

      // Generic error
      return res.status(401).json({
        message: 'Not authorized, authentication failed',
        orders: [] // Return empty array for orders endpoints
      });
    }
  } else {
    // No authorization header or incorrect format
    return res.status(401).json({
      message: 'Not authorized, no token provided',
      orders: [] // Return empty array for orders endpoints
    });
  }
});

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};


// Add this new middleware to restrict access for guest users
const requireRegisteredUser = (req, res, next) => {
  if (req.user && req.user.isGuest) {
    return res.status(403).json({
      message: 'This feature requires a registered account',
      requiresAccount: true
    });
  }
  next();
};


// Add this new middleware function
const delivery = (req, res, next) => {
  if (req.user && req.user.role === 'delivery') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as a delivery agent' });
  }
};

module.exports = { protect, admin, delivery, requireRegisteredUser };