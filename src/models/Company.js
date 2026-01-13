const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Company address is required'],
    trim: true
  },
  gst: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Owner contact number is required'],
    match: [/^\d{10}$/, 'Phone number must be 10 digits']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  logo: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', companySchema);
