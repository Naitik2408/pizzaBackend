const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const {
  // getOrders,
  // updateOrderStatus,
  assignDeliveryAgent,
  getDashboardStats,
  getDailyDashboardStats, // Add this new function
  getDeliveryAgents,
  getAllUsers,          // Add these new controller functions
  updateUserRole,
  getOffers,
  createOffer,
  getOfferById,
  updateOffer,
  deleteOffer,
  getUserById,
  updateDeliveryVerification
} = require('../controllers/adminController');

const router = express.Router();

// Fetch all orders
// router.get('/orders', protect, admin, getOrders);

// Update order status
// router.put('/orders/:id/status', protect, admin, updateOrderStatus);

// Assign delivery agent
router.put('/orders/:id/assign-agent', protect, admin, assignDeliveryAgent);

// Fetch dashboard statistics
router.get('/stats', protect, admin, getDashboardStats);

// Fetch daily dashboard statistics with per-day breakdown
router.get('/stats/daily', protect, admin, getDailyDashboardStats);

// Add this route to get all delivery agents
router.get('/delivery-agents', protect, admin, getDeliveryAgents);

// User management routes
router.get('/users', protect, admin, getAllUsers);
router.put('/users/:id/role', protect, admin, updateUserRole);
// Add these routes to fetch individual user details and update verification status
router.get('/users/:id', protect, admin, getUserById);
router.put('/users/:id/verification', protect, admin, updateDeliveryVerification);


// Add these to adminRoutes.js
// filepath: /home/naitik2408/Contribution/pizza/pizzabackend/routes/adminRoutes.js

// Offers management routes
router.get('/offers', protect, admin, getOffers);
router.post('/offers', protect, admin, createOffer);
router.get('/offers/:id', protect, admin, getOfferById);
router.put('/offers/:id', protect, admin, updateOffer);
router.delete('/offers/:id', protect, admin, deleteOffer);

module.exports = router;