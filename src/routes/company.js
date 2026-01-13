const express = require('express');
const { body, validationResult } = require('express-validator');
const Company = require('../models/Company');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    let company = await Company.findOne();
    if (!company) {
      company = await Company.create({
        name: 'Your Company Name',
        address: 'Company Address',
        phone: '0000000000',
        gst: '',
        email: ''
      });
    }
    res.json(company);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/', auth, authorize('Admin'), [
  body('name').optional().trim().notEmpty().withMessage('Company name is required'),
  body('address').optional().trim().notEmpty().withMessage('Address is required'),
  body('phone').optional().matches(/^\d{10}$/).withMessage('Phone must be 10 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let company = await Company.findOne();
    if (!company) {
      company = new Company(req.body);
    } else {
      Object.assign(company, req.body);
    }

    await company.save();
    res.json({ message: 'Company information updated', company });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
