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
  console.log('processOrderPayment called with:', { orderId, paymentMethod: paymentData.paymentMethod, createTransactionRecord });
  
  // Find the order - check if orderId is a valid ObjectId format first
  let order = null;
  const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(orderId);
  
  if (isValidObjectId) {
    console.log('Searching order by ObjectId:', orderId);
    order = await Order.findById(orderId).catch(() => null);
  }
  
  if (!order) {
    console.log('Order not found by ID, trying orderNumber:', orderId);
    // Try to find by orderNumber
    order = await Order.findOne({ orderNumber: orderId });
  }

  if (!order) {
    console.error('Order not found with ID or orderNumber:', orderId);
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }

  console.log('Found order:', { id: order._id, orderNumber: order.orderNumber });

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
    console.log('Creating transaction with payment method:', order.paymentMethod);
    
    const transactionData = {
      order: order._id,
      orderNumber: order.orderNumber,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      confirmedBy: user._id,
      confirmedByName: user.name,
      customer: order.customer,
      customerName: order.customerName,
      notes: note || `Payment confirmed by ${updatedBy}`
    };

    // Add payment-specific details based on method
    if (order.paymentMethod === 'Online' && paymentData.paymentDetails) {
      // For Razorpay payments
      transactionData.razorpayDetails = {
        paymentId: paymentData.paymentDetails.razorpay_payment_id,
        orderId: paymentData.paymentDetails.razorpay_order_id,
        signature: paymentData.paymentDetails.razorpay_signature,
        verificationStatus: paymentData.paymentDetails.verificationStatus || 'Verified'
      };
    } else if (order.paymentMethod === 'UPI' || order.paymentMethod === 'Cash on Delivery') {
      // For UPI/COD payments
      transactionData.upiDetails = {
        upiId: paymentData.upiId || 'naitikkumar2408-1@oksbi',
        merchantName: paymentData.merchantName || 'Pizza Shop',
        merchantCode: paymentData.merchantCode || 'PIZZASHP001',
        referenceNumber: upiReference || order.orderNumber,
      };
    }

    console.log('Creating transaction with data:', transactionData);
    transaction = await Transaction.create(transactionData);
    console.log('Transaction created successfully:', transaction._id);
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
      // Return verification success with payment details for later transaction creation
      return res.json({ 
        verified: true,
        paymentDetails: {
          razorpay_payment_id,
          razorpay_order_id,
          razorpay_signature,
          verificationStatus: 'Verified'
        }
      });
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

// @desc    Create transaction after order is created (for online payments)
// @route   POST /api/transactions/create-after-order
// @access  Private
const createTransactionAfterOrder = asyncHandler(async (req, res) => {
  try {
    const { orderId, razorpayDetails } = req.body;
    
    console.log('Creating transaction for orderId:', orderId);
    console.log('Razorpay details received:', razorpayDetails);

    if (!orderId || !razorpayDetails) {
      console.error('Missing required fields:', { orderId: !!orderId, razorpayDetails: !!razorpayDetails });
      return res.status(400).json({ message: 'Order ID and Razorpay details are required' });
    }

    // Create transaction record using the processOrderPayment function
    const paymentData = {
      paymentStatus: 'Completed',
      paymentMethod: 'Online',
      paymentDetails: razorpayDetails,
      note: 'Online payment via Razorpay'
    };

    console.log('Processing payment with data:', paymentData);

    const result = await processOrderPayment(
      orderId,
      paymentData,
      req.user,
      true // Create a transaction record
    );

    console.log('Transaction creation result:', result);

    res.json({ success: true, transaction: result.transaction });
  } catch (error) {
    console.error("Error creating transaction after order:", error);
    res.status(500).json({
      message: "Failed to create transaction record",
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
  createTransactionAfterOrder,

  // Transaction retrieval functions
  getTransactions,
  getDeliveryTransactions,
  getTransactionById,
  getTransactionsByDateRange
};