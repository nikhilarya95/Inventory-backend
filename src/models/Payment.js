const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: [true, 'Transaction ID is required'],
    unique: true,
    trim: true
  },
  transactionDate: {
    type: Date,
    required: [true, 'Transaction date is required'],
    default: Date.now
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required']
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: [true, 'Bill is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  modeOfPayment: {
    type: String,
    required: [true, 'Mode of payment is required'],
    enum: ['Cash', 'UPI', 'Net Banking', 'Cheque', 'Card']
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
