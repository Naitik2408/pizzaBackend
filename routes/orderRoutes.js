const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect, admin, delivery } = require('../middleware/authMiddleware');

// Customer routes
router.post('/', protect, orderController.placeOrder);
router.get('/my-orders', protect, orderController.getMyOrders);
router.get('/my-orders/:id', protect, orderController.getMyOrderById);
router.put('/my-orders/:id/cancel', protect, orderController.cancelMyOrder);
router.post('/my-orders/:id/rate', protect, orderController.rateOrder);
router.put('/my-orders/:id/payment', protect, orderController.updateOrderPayment);

// Admin routes
router.get('/', protect, admin, orderController.getOrders);
router.get('/filter', protect, admin, orderController.filterOrders);
router.get('/search', protect, admin, orderController.searchOrders);
router.get('/assigned/:agentId', protect, admin, orderController.getAssignedOrders);
router.get('/:id', protect, admin, orderController.getOrderById);

// Unified order status update route - works for all roles with permissions handled internally
router.put('/:id/status', protect, orderController.updateOrderStatus);

// Admin-only routes
router.put('/:id/delivery-agent', protect, admin, orderController.assignDeliveryAgent);
router.put('/:id/payment', protect, admin, orderController.updateOrderPayment);

// Delivery agent routes
router.get('/delivery', protect, delivery, orderController.getDeliveryOrders);
router.get('/delivery/:id', protect, delivery, orderController.getDeliveryOrderById);

// Delivery agent payment update - pointing to unified payment function
router.put('/delivery/:id/payment', protect, delivery, orderController.updateOrderPayment);

module.exports = router;