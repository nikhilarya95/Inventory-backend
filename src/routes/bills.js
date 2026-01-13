const express = require('express');
const { body, validationResult } = require('express-validator');
const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const Company = require('../models/Company');
const Stock = require('../models/Stock');
const { auth, authorize } = require('../middleware/auth');
const { generateBillId, calculatePercentage } = require('../utils/helpers');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const bills = await Bill.find({ isActive: true })
      .populate('customer')
      .populate('items.product')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(bills);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/customer/:customerId', auth, async (req, res) => {
  try {
    const bills = await Bill.find({
      customer: req.params.customerId,
      isActive: true,
      status: { $ne: 'Paid' }
    })
      .populate('customer')
      .sort({ billDate: 1 });
    res.json(bills);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('customer')
      .populate('items.product')
      .populate('createdBy', 'firstName lastName');

    if (!bill || !bill.isActive) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/check-credit/:customerId', auth, authorize('Admin', 'Manager', 'Sales Man'), async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const unpaidBills = await Bill.find({
      customer: req.params.customerId,
      isActive: true,
      status: { $ne: 'Paid' }
    }).sort({ billDate: 1 });

    const totalDue = unpaidBills.reduce((sum, bill) => sum + bill.dueAmount, 0);
    const totalBilled = unpaidBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const unpaidPercentage = totalBilled > 0 ? calculatePercentage(totalDue, totalBilled) : 0;

    const canCreateBill = unpaidPercentage < 75 && unpaidBills.length < 2;

    res.json({
      canCreateBill,
      unpaidBillsCount: unpaidBills.length,
      totalDue,
      unpaidPercentage: unpaidPercentage.toFixed(2),
      reason: !canCreateBill ?
        (unpaidPercentage >= 75 ? 'Customer has 75% or more unpaid dues' : 'Customer already has 2 unpaid bills')
        : null
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, authorize('Admin', 'Manager'), [
  body('customer').notEmpty().withMessage('Customer is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product').notEmpty().withMessage('Product is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.mrp').isFloat({ min: 0 }).withMessage('MRP is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const customer = await Customer.findById(req.body.customer);
    if (!customer || !customer.isActive) {
      return res.status(400).json({ message: 'Invalid customer' });
    }

    const unpaidBills = await Bill.find({
      customer: req.body.customer,
      isActive: true,
      status: { $ne: 'Paid' }
    });

    const totalDue = unpaidBills.reduce((sum, bill) => sum + bill.dueAmount, 0);
    const totalBilled = unpaidBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const unpaidPercentage = totalBilled > 0 ? calculatePercentage(totalDue, totalBilled) : 0;

    if (unpaidPercentage >= 75) {
      return res.status(400).json({
        message: 'Cannot create bill. Customer has 75% or more of total dues unpaid.'
      });
    }

    if (unpaidBills.length >= 2) {
      return res.status(400).json({
        message: 'Cannot create bill. Customer already has 2 unpaid bills.'
      });
    }

    const company = await Company.findOne();

    const billItems = req.body.items.map(item => {
      const discount = item.discount || 0;
      const amount = item.quantity * (item.mrp - (item.mrp * discount / 100));
      return {
        ...item,
        discount: discount,
        amount: amount
      };
    });

    const billId = generateBillId();
    const bill = new Bill({
      billId,
      billDate: req.body.billDate || new Date(),
      customer: customer._id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerGST: customer.gst,
      customerAddress: customer.address,
      companyName: company?.name || '',
      companyPhone: company?.phone || '',
      companyEmail: company?.email || '',
      companyGST: company?.gst || '',
      companyAddress: company?.address || '',
      items: billItems,
      order: req.body.order,
      createdBy: req.user._id
    });

    await bill.save();

    // customer.totalDue = (customer.totalDue || 0) + bill.totalAmount;
    // await customer.save();
    await Customer.findByIdAndUpdate(customer._id, {
      $inc: { totalDue: bill.totalAmount }
    });

    for (const item of req.body.items) {
      if (item.stock) {
        await Stock.findByIdAndUpdate(item.stock, {
          $inc: { quantity: -item.quantity }
        });
      }
    }

    await bill.populate('customer');
    await bill.populate('items.product');

    res.status(201).json({ message: 'Bill created successfully', bill });
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.billId;
    delete updates.createdBy;
    delete updates.paidAmount;
    delete updates.dueAmount;
    delete updates.status;

    const bill = await Bill.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    )
      .populate('customer')
      .populate('items.product');

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    res.json({ message: 'Bill updated successfully', bill });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    if (bill.paidAmount > 0) {
      return res.status(400).json({ message: 'Cannot delete bill with payments' });
    }

    bill.isActive = false;
    await bill.save();

    await Customer.findByIdAndUpdate(bill.customer, {
      $inc: { totalDue: -bill.totalAmount }
    });

    res.json({ message: 'Bill deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
