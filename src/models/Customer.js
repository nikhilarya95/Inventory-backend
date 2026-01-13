const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  customerId: {
    type: String,
    required: [true, 'Customer ID is required'],
    unique: true,
    trim: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: false,
    unique: false,
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        return !v || /^\w+([.-]?\w+)@\w+([.-]?\w+)(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email'
    }
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^\d{10}$/, 'Phone number must be 10 digits']
  },
  shopName: {
    type: String,
    required: [true, 'Shop name is required'],
    trim: true
  },
  gst: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  creditLimit: {
    type: Number,
    default: 0
  },
  totalDue: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Customer', customerSchema);
