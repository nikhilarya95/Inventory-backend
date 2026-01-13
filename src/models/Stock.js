const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required']
  },
  manufactureDate: {
    type: Date,
    required: [true, 'Manufacture date is required']
  },
  weight: {
    type: Number,
    required: [true, 'Weight is required'],
    min: [0, 'Weight cannot be negative']
  },
  weightUnit: {
    type: String,
    enum: ['g', 'kg', 'ml', 'l'],
    default: 'kg'
  },
  mrp: {
    type: Number,
    required: [true, 'MRP is required'],
    min: [0, 'MRP cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  batchNumber: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Stock', stockSchema);
