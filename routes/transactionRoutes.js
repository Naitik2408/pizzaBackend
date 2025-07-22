const express = require('express');
const router = express.Router();
const { protect, admin, delivery } = require('../middleware/authMiddleware');
const {
  createTransaction,
  getTransactions,
  getDeliveryTransactions,
  getTransactionById,
  getTransactionsByDateRange,
  createRazorpayOrder,
  verifyRazorpayPayment,
  createTransactionAfterOrder
} = require('../controllers/transactionController');

// Create transaction - delivery agent only
router.post('/', protect, delivery, createTransaction);

// Get all transactions - admin only
router.get('/', protect, admin, getTransactions);

// Get transactions by date range - admin only
router.get('/date-range', protect, admin, getTransactionsByDateRange);

// Add these routes:

// Create a Razorpay order
router.post('/create-razorpay-order', protect, createRazorpayOrder);

// Verify Razorpay payment
router.post('/verify-payment', protect, verifyRazorpayPayment);

// Create transaction after order is created (for online payments)
router.post('/create-after-order', protect, createTransactionAfterOrder);

// Get transactions by delivery agent - delivery agent access
router.get('/delivery', protect, delivery, getDeliveryTransactions);

// Get transaction by ID - admin only
router.get('/:id', protect, admin, getTransactionById);

module.exports = router;