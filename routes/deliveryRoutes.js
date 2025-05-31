const express = require('express');
const { protect, delivery } = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');
const { 
  // getAssignedOrders,
  getOrderDetails,
  // updateOrderStatus,
  getCompletedOrders,
  getDeliveryStats,
  getDeliveryDashboard, 
  getOrdersPendingPayment,
  updateOrderPayment
} = require('../controllers/deliveryController');

const router = express.Router();

// Get all orders assigned to the logged in delivery agent
router.get('/orders/assigned', protect, delivery, orderController.getAssignedDeliveryOrders);

// Get completed orders history
router.get('/orders/completed', protect, delivery, getCompletedOrders);

// Add this new route BEFORE the parameterized route
router.get('/orders/pending-payments', protect, delivery, getOrdersPendingPayment);

// Get specific order details
router.get('/orders/:id', protect, delivery, getOrderDetails);

// Update order status (pickup, on the way, delivered)
// router.put('/orders/:id/status', protect, delivery, updateOrderStatus);

// Add this new route
router.put('/orders/:id/payment', protect, delivery, updateOrderPayment);

// Get delivery agent stats
router.get('/stats', protect, delivery, getDeliveryStats);

// Get dashboard summary data
router.get('/dashboard', protect, delivery, getDeliveryDashboard);

module.exports = router;