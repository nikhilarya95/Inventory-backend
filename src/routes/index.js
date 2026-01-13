const express = require('express');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const productRoutes = require('./products');
const stockRoutes = require('./stock');
const customerRoutes = require('./customers');
const orderRoutes = require('./orders');
const billRoutes = require('./bills');
const paymentRoutes = require('./payments');
const companyRoutes = require('./company');
const dashboardRoutes = require('./dashboard');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/stock', stockRoutes);
router.use('/customers', customerRoutes);
router.use('/orders', orderRoutes);
router.use('/bills', billRoutes);
router.use('/payments', paymentRoutes);
router.use('/company', companyRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
