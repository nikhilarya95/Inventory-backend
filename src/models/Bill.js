const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  hsnNumber: {
    type: String,
    trim: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productDetails: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  mrp: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  amount: {
    type: Number,
    required: true
  }
});

const billSchema = new mongoose.Schema({
  billId: {
    type: String,
    required: [true, 'Bill ID is required'],
    unique: true,
    trim: true
  },
  billDate: {
    type: Date,
    required: [true, 'Bill date is required'],
    default: Date.now
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required']
  },
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  customerGST: String,
  customerAddress: String,
  companyName: String,
  companyPhone: String,
  companyEmail: String,
  companyGST: String,
  companyAddress: String,
  items: [billItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  dueAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Unpaid', 'Partial', 'Paid'],
    default: 'Unpaid'
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
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

billSchema.pre('save', function () {
  this.totalAmount = this.items.reduce((sum, item) => sum + item.amount, 0);
  this.dueAmount = this.totalAmount - this.paidAmount;
  if (this.dueAmount <= 0) {
    this.status = 'Paid';
  } else if (this.paidAmount > 0) {
    this.status = 'Partial';
  } else {
    this.status = 'Unpaid';
  }

});

module.exports = mongoose.model('Bill', billSchema);
