const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ brandName: 1, productName: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/brands', auth, async (req, res) => {
  try {
    const brands = await Product.distinct('brandName', { isActive: true });
    res.json(brands.sort());
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/by-brand/:brandName', auth, async (req, res) => {
  try {
    const products = await Product.find({ 
      brandName: req.params.brandName, 
      isActive: true 
    }).sort({ productName: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, authorize('Admin'), [
  body('brandName').trim().notEmpty().withMessage('Brand name is required'),
  body('productName').trim().notEmpty().withMessage('Product name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const existingProduct = await Product.findOne({
      brandName: req.body.brandName,
      productName: req.body.productName
    });

    if (existingProduct) {
      if (!existingProduct.isActive) {
        existingProduct.isActive = true;
        existingProduct.hsnNumber = req.body.hsnNumber;
        await existingProduct.save();
        return res.json({ message: 'Product reactivated', product: existingProduct });
      }
      return res.status(400).json({ message: 'Product already exists' });
    }

    const product = new Product(req.body);
    await product.save();

    res.status(201).json({ message: 'Product created successfully', product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, authorize('Admin'), [
  body('brandName').optional().trim().notEmpty(),
  body('productName').optional().trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product updated successfully', product });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, authorize('Admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
