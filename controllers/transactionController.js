const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const asyncHandler = require('express-async-handler');
const Razorpay = require('razorpay');

/**
 * Central function for processing order payments and optionally creating transactions
 * @param {string} orderId - Order ID
 * @param {Object} paymentData - Payment data to update
 * @param {Object} user - User performing the action
 * @param {boolean} createTransactionRecord - Whether to create a transaction record
 * @returns {Promise<Object>} Updated order info and transaction if created
 */
const processOrderPayment = async (orderId, paymentData, user, createTransactionRecord = false) => {
  // Find the order
  const order = await Order.findById(orderId);

  if (!order) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }

  // Check permissions based on role
  let isAuthorized = false;
  let updatedBy = '';

  if (user.role === 'admin') {
    // Admins can update any order
    isAuthorized = true;
    updatedBy = 'admin';
  } else if (user.role === 'delivery') {
    // Delivery agents can only update orders assigned to them
    if (order.deliveryAgent && order.deliveryAgent.toString() === user._id.toString()) {
      isAuthorized = true;
      updatedBy = 'delivery agent';
    }
  } else if (user.role === 'customer') {
    // Customers can only update their own orders
    if (order.customer && order.customer.toString() === user._id.toString()) {
      isAuthorized = true;
      updatedBy = 'customer';
    }
  }

  if (!isAuthorized) {
    const error = new Error('Not authorized to update this order');
    error.statusCode = 403;
    throw error;
  }

  // Extract payment data
  const { paymentStatus, paymentMethod, paymentDetails, status, note, upiReference } = paymentData;

  // Update payment status
  if (paymentStatus) {
    order.paymentStatus = paymentStatus;
  }

  // Update payment method if provided
  if (paymentMethod) {
    order.paymentMethod = paymentMethod;
  }

  // Update payment details if provided
  if (paymentDetails) {
    order.paymentDetails = {
      ...order.paymentDetails,
      ...paymentDetails,
      updatedAt: new Date()
    };
  }

  // If status is provided and user is delivery agent or admin, update order status too
  if (status && ['Preparing', 'Out for delivery', 'Delivered'].includes(status) &&
    (user.role === 'delivery' || user.role === 'admin')) {
    order.status = status;
  }

  // Add a note to status updates
  const statusNote = note || `Payment status updated to ${paymentStatus} by ${updatedBy}${status ? ' and status updated to ' + status : ''}`;
  order.statusUpdates.push({
    status: order.status,
    time: Date.now(),
    note: statusNote
  });

  // Save the updated order
  const updatedOrder = await order.save();

  // Create transaction record if requested
  let transaction = null;
  if (createTransactionRecord) {
    transaction = await Transaction.create({
      order: order._id,
      orderNumber: order.orderNumber,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      upiDetails: {
        upiId: paymentData.upiId || 'naitikkumar2408-1@oksbi',
        merchantName: paymentData.merchantName || 'Pizza Shop',
        merchantCode: paymentData.merchantCode || 'PIZZASHP001',
        referenceNumber: upiReference || order.orderNumber,
      },
      confirmedBy: user._id,
      confirmedByName: user.name,
      customer: order.customer,
      customerName: order.customerName,
      notes: note || `Payment confirmed by ${updatedBy}`
    });
  }

  return {
    success: true,
    order: {
      id: updatedOrder.orderNumber,
      _id: updatedOrder._id,
      paymentStatus: updatedOrder.paymentStatus,
      paymentMethod: updatedOrder.paymentMethod,
      status: updatedOrder.status
    },
    transaction
  };
};

// @desc    Update order payment status (unified endpoint)
// @route   PUT /api/transactions/:orderId/payment
// @access  Private (with role-based permissions)
const updateOrderPayment = asyncHandler(async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const paymentData = {
      paymentStatus: req.body.paymentStatus,
      paymentMethod: req.body.paymentMethod,
      paymentDetails: req.body.paymentDetails,
      status: req.body.status,
      note: req.body.note,
      upiId: req.body.upiId,
      merchantName: req.body.merchantName,
      merchantCode: req.body.merchantCode,
      upiReference: req.body.upiReference
    };

    // Determine if we should create a transaction record
    // Create a transaction when payment is Completed for COD/UPI payments
    const createTransactionRecord = req.body.createTransaction ||
      (paymentData.paymentStatus === 'Completed' &&
        (req.user.role === 'delivery' &&
          (req.body.paymentMethod === 'Cash on Delivery' ||
            req.body.paymentMethod === 'UPI')));

    const result = await processOrderPayment(orderId, paymentData, req.user, createTransactionRecord);

    res.json(result);
  } catch (error) {
    console.error('Error updating payment status:', error);

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to update payment status';

    res.status(statusCode).json({ message });
  }
});


// Create these two new functions:

// @desc    Create a Razorpay order
// @route   POST /api/transactions/create-razorpay-order
// @access  Private
const createRazorpayOrder = asyncHandler(async (req, res) => {
  try {
    const { amount, currency, receipt } = req.body;

    // Initialize Razorpay instance
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const options = {
      amount: amount, // amount in smallest currency unit (paise)
      currency: currency || 'INR',
      receipt: receipt || `receipt_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        purpose: "Food Order"
      }
    };

    const order = await instance.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({
      message: "Could not create payment order",
      error: error.message
    });
  }
});

// @desc    Verify Razorpay payment
// @route   POST /api/transactions/verify-payment
// @access  Private
const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    // Generate signature for verification
    const crypto = require('crypto');
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    // Verify signature
    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Create a transaction record and update order
      // This uses your existing function with payment details
      const paymentData = {
        paymentStatus: 'Completed',
        paymentMethod: 'Online',
        paymentDetails: {
          razorpay_payment_id,
          razorpay_order_id,
          razorpay_signature,
          verificationStatus: 'Verified'
        },
        note: 'Payment verified through Razorpay'
      };

      // Extract orderId from custom notes if available
      // Or you can pass orderId in request body
      let orderId = req.body.orderId;
      if (!orderId) {
        // Get order details from Razorpay to find your internal orderId
        const instance = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const razorpayOrder = await instance.orders.fetch(razorpay_order_id);
        // You could store orderId in notes during order creation
        if (razorpayOrder.notes && razorpayOrder.notes.orderId) {
          orderId = razorpayOrder.notes.orderId;
        }
      }

      if (orderId) {
        // Use your existing function to process the payment
        const result = await processOrderPayment(
          orderId,
          paymentData,
          req.user,
          true // Create a transaction record
        );
        return res.json({ verified: true, ...result });
      } else {
        // If no orderId is found, just return verification status
        return res.json({ verified: true });
      }
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      message: "Payment verification failed",
      error: error.message
    });
  }
});




// @desc    Create a transaction record (legacy support)
// @route   POST /api/transactions
// @access  Private/Delivery
const createTransaction = asyncHandler(async (req, res) => {
  try {
    const { orderId, upiReference, notes } = req.body;

    // Use the unified function with payment completion
    const paymentData = {
      paymentStatus: 'Completed',
      note: notes,
      upiReference
    };

    // Always create transaction record for this endpoint
    const result = await processOrderPayment(orderId, paymentData, req.user, true);

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating transaction:', error);

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to create transaction';

    res.status(statusCode).json({ message });
  }
});

// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private/Admin
const getTransactions = asyncHandler(async (req, res) => {
  const pageSize = 10;
  const page = Number(req.query.page) || 1;

  const count = await Transaction.countDocuments({});
  const transactions = await Transaction.find({})
    .sort({ createdAt: -1 })
    .skip(pageSize * (page - 1))
    .limit(pageSize);

  res.json({
    transactions,
    page,
    pages: Math.ceil(count / pageSize),
    total: count
  });
});

// @desc    Get transactions by delivery agent
// @route   GET /api/transactions/delivery
// @access  Private/Delivery
const getDeliveryTransactions = asyncHandler(async (req, res) => {
  const pageSize = 10;
  const page = Number(req.query.page) || 1;

  const count = await Transaction.countDocuments({ confirmedBy: req.user._id });
  const transactions = await Transaction.find({ confirmedBy: req.user._id })
    .sort({ createdAt: -1 })
    .skip(pageSize * (page - 1))
    .limit(pageSize);

  res.json({
    transactions,
    page,
    pages: Math.ceil(count / pageSize),
    total: count
  });
});

// @desc    Get transaction details
// @route   GET /api/transactions/:id
// @access  Private/Admin
const getTransactionById = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id)
    .populate('order', 'orderNumber status items amount')
    .populate('confirmedBy', 'name email')
    .populate('customer', 'name email');

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  res.json(transaction);
});

// @desc    Get transactions by date range
// @route   GET /api/transactions/date-range
// @access  Private/Admin
const getTransactionsByDateRange = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    res.status(400);
    throw new Error('Start date and end date are required');
  }

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const transactions = await Transaction.find({
    transactionDate: { $gte: start, $lte: end }
  }).sort({ transactionDate: 1 });

  // Calculate total amount
  const totalAmount = transactions.reduce((sum, transaction) => {
    return sum + transaction.amount;
  }, 0);

  res.json({
    transactions,
    totalAmount,
    count: transactions.length,
    dateRange: {
      from: start,
      to: end
    }
  });
});

module.exports = {
  // Core functions
  processOrderPayment,
  updateOrderPayment,
  createTransaction,

  // Razorpay-specific functions
  createRazorpayOrder,
  verifyRazorpayPayment,

  // Transaction retrieval functions
  getTransactions,
  getDeliveryTransactions,
  getTransactionById,
  getTransactionsByDateRange
};