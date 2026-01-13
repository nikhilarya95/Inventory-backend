const express = require('express');
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const { auth, authorize } = require('../middleware/auth');
const { generateCustomerId } = require('../utils/helpers');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const customers = await Customer.find({ isActive: true }).sort({ shopName: 1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    const customers = await Customer.find({
      isActive: true,
      $or: [
        { customerId: { $regex: q, $options: 'i' } },
        { shopName: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } }
      ]
    }).limit(10);

    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer || !customer.isActive) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, authorize('Admin', 'Manager'), [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email is required'),
  body('phone').matches(/^\d{10}$/).withMessage('Phone must be 10 digits'),
  body('shopName').trim().notEmpty().withMessage('Shop name is required'),
  body('address').trim().notEmpty().withMessage('Address is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const customerId = req.body.customerId || generateCustomerId();
    
const query = { $or: [{ customerId }] };
    if (req.body.email) {
      query.$or.push({ email: req.body.email.toLowerCase() });
    }
    const existingCustomer = await Customer.findOne(query);

    if (existingCustomer) {
      return res.status(400).json({ message: 'Customer ID or email already exists' });
    }

    const customer = new Customer({
      ...req.body,
      customerId
    });
    await customer.save();

    res.status(201).json({ message: 'Customer created successfully', customer });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, authorize('Admin', 'Manager'), [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email is required'),
  body('phone').optional().matches(/^\d{10}$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = { ...req.body };
    delete updates.customerId;

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ message: 'Customer updated successfully', customer });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
