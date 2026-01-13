const express = require('express');
const { body, validationResult } = require('express-validator');
const Payment = require('../models/Payment');
const Bill = require('../models/Bill');
const Customer = require('../models/Customer');
const { auth, authorize } = require('../middleware/auth');
const { generateTransactionId } = require('../utils/helpers');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ isActive: true })
      .populate('customer')
      .populate('bill')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/customer/:customerId', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ 
      customer: req.params.customerId, 
      isActive: true 
    })
    .populate('bill')
    .sort({ transactionDate: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('customer')
      .populate('bill')
      .populate('createdBy', 'firstName lastName');
    
    if (!payment || !payment.isActive) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, authorize('Admin', 'Sales Man'), [
  body('customer').notEmpty().withMessage('Customer is required'),
  body('bill').notEmpty().withMessage('Bill is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('modeOfPayment').isIn(['Cash', 'UPI', 'Net Banking', 'Cheque', 'Card'])
    .withMessage('Please select mode of Payment'),
    body('transactionDate').optional().custom((value) => {
    if (value && new Date(value) > new Date()) {
      throw new Error('Transaction date cannot be in the future');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const bill = await Bill.findById(req.body.bill);
    if (!bill || !bill.isActive) {
      return res.status(400).json({ message: 'Invalid bill' });
    }

    const unpaidBills = await Bill.find({
      customer: req.body.customer,
      isActive: true,
      status: { $ne: 'Paid' }
    }).sort({ billDate: 1 });

    if (unpaidBills.length > 1) {
      const firstUnpaidBill = unpaidBills[0];
      if (firstUnpaidBill._id.toString() !== req.body.bill && firstUnpaidBill.status !== 'Paid') {
        return res.status(400).json({ 
          message: 'Payment for this bill cannot be accepted until the first bill is fully paid.',
          firstBillId: firstUnpaidBill.billId
        });
      }
    }

    if (req.body.amount > bill.dueAmount) {
      return res.status(400).json({ 
        message: `Amount exceeds due amount. Maximum payable: ${bill.dueAmount}` 
      });
    }

    const transactionId = generateTransactionId();
    const payment = new Payment({
      transactionId,
      transactionDate: req.body.transactionDate || new Date(),
      customer: req.body.customer,
      bill: req.body.bill,
      amount: req.body.amount,
      modeOfPayment: req.body.modeOfPayment,
      notes: req.body.notes,
      createdBy: req.user._id
    });

    await payment.save();

    bill.paidAmount += req.body.amount;
    bill.dueAmount = bill.totalAmount - bill.paidAmount;
    bill.status = bill.dueAmount <= 0 ? 'Paid' : 'Partial';
    await bill.save();

    await Customer.findByIdAndUpdate(req.body.customer, {
      $inc: { totalDue: -req.body.amount }
    });

    await payment.populate('customer');
    await payment.populate('bill');

    res.status(201).json({ message: 'Payment recorded successfully', payment });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, authorize('Admin', 'Sales Man'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment || !payment.isActive) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const updates = { ...req.body };
    delete updates.transactionId;
    delete updates.createdBy;
    delete updates.customer;
    delete updates.bill;
    delete updates.amount;

    const updatedPayment = await Payment.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    )
    .populate('customer')
    .populate('bill');

    res.json({ message: 'Payment updated successfully', payment: updatedPayment });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, authorize('Admin', 'Sales Man'), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment || !payment.isActive) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const bill = await Bill.findById(payment.bill);
    if (bill) {
      bill.paidAmount -= payment.amount;
      bill.dueAmount = bill.totalAmount - bill.paidAmount;
      bill.status = bill.paidAmount <= 0 ? 'Unpaid' : (bill.dueAmount <= 0 ? 'Paid' : 'Partial');
      await bill.save();
    }

    await Customer.findByIdAndUpdate(payment.customer, {
      $inc: { totalDue: payment.amount }
    });

    payment.isActive = false;
    await payment.save();

    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
