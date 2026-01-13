const express = require('express');
const Order = require('../models/Order');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Stock = require('../models/Stock');
const Product = require('../models/Product');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', auth, async (req, res) => {
  try {
    const [
      totalProducts,
      totalCustomers,
      totalOrders,
      totalBills,
      lowStockCount
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Customer.countDocuments({ isActive: true }),
      Order.countDocuments({ isActive: true }),
      Bill.countDocuments({ isActive: true }),
      Stock.countDocuments({ quantity: { $lt: 3 }, isActive: true })
    ]);

    const bills = await Bill.find({ isActive: true });
    const totalRevenue = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const totalDue = bills.reduce((sum, bill) => sum + bill.dueAmount, 0);
    const totalPaid = bills.reduce((sum, bill) => sum + bill.paidAmount, 0);

    res.json({
      totalProducts,
      totalCustomers,
      totalOrders,
      totalBills,
      lowStockCount,
      totalRevenue,
      totalDue,
      totalPaid
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/top-selling', auth, async (req, res) => {
  try {
    const topProducts = await Bill.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalValue: { $sum: '$items.amount' }
        }
      },
      { $sort: { totalValue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          _id: 1,
          brandName: '$product.brandName',
          productName: '$product.productName',
          totalQuantity: 1,
          totalValue: 1
        }
      }
    ]);

    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/low-performing', auth, async (req, res) => {
  try {
    const allProducts = await Product.find({ isActive: true });
    
    const salesData = await Bill.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalQuantity: { $sum: '$items.quantity' },
          totalValue: { $sum: '$items.amount' }
        }
      }
    ]);

    const salesMap = new Map(salesData.map(item => [item._id.toString(), item]));

    const lowPerforming = allProducts
      .map(product => {
        const sales = salesMap.get(product._id.toString());
        return {
          _id: product._id,
          brandName: product.brandName,
          productName: product.productName,
          totalQuantity: sales?.totalQuantity || 0,
          totalValue: sales?.totalValue || 0
        };
      })
      .sort((a, b) => a.totalValue - b.totalValue)
      .slice(0, 10);

    res.json(lowPerforming);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/payment-frequency', auth, async (req, res) => {
  try {
    const paymentStats = await Payment.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$customer',
          paymentCount: { $sum: 1 },
          totalPaid: { $sum: '$amount' },
          lastPayment: { $max: '$transactionDate' }
        }
      },
      { $sort: { paymentCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: '$customer' },
      {
        $project: {
          _id: 1,
          customerName: { $concat: ['$customer.firstName', ' ', '$customer.lastName'] },
          shopName: '$customer.shopName',
          paymentCount: 1,
          totalPaid: 1,
          lastPayment: 1
        }
      }
    ]);

    res.json(paymentStats);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/recent-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ isActive: true })
      .populate('customer', 'firstName lastName shopName')
      .sort({ createdAt: -1 })
      .limit(5);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/recent-payments', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ isActive: true })
      .populate('customer', 'firstName lastName shopName')
      .populate('bill', 'billId')
      .sort({ createdAt: -1 })
      .limit(5);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
