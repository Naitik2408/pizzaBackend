const express = require('express');
const router = express.Router();
const { protect, admin, delivery } = require('../middleware/authMiddleware');
const {
  createTransaction,
  getTransactions,
  getDeliveryTransactions,
  getTransactionById,
  getTransactionsByDateRange
} = require('../controllers/transactionController');

// Create transaction - delivery agent only
router.post('/', protect, delivery, createTransaction);

// Get all transactions - admin only
router.get('/', protect, admin, getTransactions);

// Get transactions by date range - admin only
router.get('/date-range', protect, admin, getTransactionsByDateRange);

// Get transactions by delivery agent - delivery agent access
router.get('/delivery', protect, delivery, getDeliveryTransactions);

// Get transaction by ID - admin only
router.get('/:id', protect, admin, getTransactionById);

module.exports = router;