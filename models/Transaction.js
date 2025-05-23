const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  orderNumber: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['Cash on Delivery', 'UPI', 'Card', 'Online'],
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
    default: 'Completed'
  },
  upiDetails: {
    upiId: {
      type: String,
      default: null
    },
    merchantName: {
      type: String,
      default: null
    },
    merchantCode: {
      type: String,
      default: null
    },
    referenceNumber: {
      type: String,
      default: null
    }
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  confirmedByName: {
    type: String,
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customerName: {
    type: String,
    required: true
  },
  notes: {
    type: String
  },
  transactionDate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Add indexes for faster queries
transactionSchema.index({ order: 1 });
transactionSchema.index({ confirmedBy: 1 });
transactionSchema.index({ customer: 1 });
transactionSchema.index({ transactionDate: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ orderNumber: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;