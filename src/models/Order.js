const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  stock: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock'
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  expiryDate: {
    type: Date
  },
  mrp: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  subtotal: {
    type: Number,
    default: 0
  }
});

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: [true, 'Order ID is required'],
    unique: true,
    trim: true
  },
  orderDate: {
    type: Date,
    required: [true, 'Order date is required'],
    default: Date.now
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer is required']
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Billed', 'Cancelled'],
    default: 'Pending'
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

orderSchema.pre('save', function () {
  let total = 0;
  this.items.forEach(item => {
    const unitDiscountAmount = (item.mrp * (item.discount || 0)) / 100;
    item.discountAmount = unitDiscountAmount * item.quantity;
    const finalPrice = item.mrp - unitDiscountAmount;
    item.subtotal = item.quantity * finalPrice;
    total += item.subtotal;
  });
  this.totalAmount = total;
});

module.exports = mongoose.model('Order', orderSchema);
