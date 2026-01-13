const express = require('express');
const { body, validationResult } = require('express-validator');
const Stock = require('../models/Stock');
const Product = require('../models/Product');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const stock = await Stock.find({ isActive: true })
      .populate('product')
      .sort({ createdAt: -1 });
    res.json(stock);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/low-stock', auth, async (req, res) => {
  try {
    const lowStock = await Stock.find({ quantity: { $lt: 3 }, isActive: true })
      .populate('product');
    res.json(lowStock);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/by-product/:productId', auth, async (req, res) => {
  try {
    const stock = await Stock.find({
      product: req.params.productId,
      isActive: true,
      quantity: { $gt: 0 }
    }).populate('product');
    res.json(stock);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const stock = await Stock.findById(req.params.id).populate('product');
    if (!stock || !stock.isActive) {
      return res.status(404).json({ message: 'Stock not found' });
    }
    res.json(stock);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, authorize('Admin', 'Manager'), [
  body('product').notEmpty().withMessage('Product is required'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a positive number'),
  body('expiryDate').isISO8601().withMessage('Valid expiry date is required'),
  body('manufactureDate').isISO8601().withMessage('Valid manufacture date is required'),
  body('weight').isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
  body('mrp').isFloat({ min: 0 }).withMessage('MRP must be a positive number'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const product = await Product.findById(req.body.product);
    if (!product || !product.isActive) {
      return res.status(400).json({ message: 'Invalid product' });
    }

    const stock = new Stock(req.body);
    await stock.save();
    await stock.populate('product');

    res.status(201).json({ message: 'Stock added successfully', stock });
  } catch (error) {
    console.error('Create stock error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, authorize('Admin', 'Manager'), [
  body('quantity').optional().isInt({ min: 0 }),
  body('expiryDate').optional().isISO8601(),
  body('manufactureDate').optional().isISO8601(),
  body('weight').optional().isFloat({ min: 0 }),
  body('mrp').optional().isFloat({ min: 0 }),
  body('discount').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const stock = await Stock.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('product');

    if (!stock) {
      return res.status(404).json({ message: 'Stock not found' });
    }

    res.json({ message: 'Stock updated successfully', stock });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const stock = await Stock.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!stock) {
      return res.status(404).json({ message: 'Stock not found' });
    }

    res.json({ message: 'Stock deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


router.get('/product/:productId', auth, async (req, res) => {
  try {
    console.log('Fetching stock for product:', req.params.productId);
    const { productId } = req.params;
    const stocks = await Stock.find({ product: productId, quantity: { $gt: 0 }, isActive: true });
    res.json(stocks);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

