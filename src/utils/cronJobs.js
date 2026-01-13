const cron = require('node-cron');
const Stock = require('../models/Stock');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Bill = require('../models/Bill');
const emailService = require('./emailService');

const checkLowStock = async () => {
  try {
    console.log('Running low stock check...');

    const lowStockItems = await Stock.find({
      quantity: { $lt: 3 },
      isActive: true
    }).populate('product');

    if (lowStockItems.length === 0) {
      console.log('No low stock items found');
      return;
    }

    const admins = await User.find({
      roles: 'Admin',
      isActive: true
    });

    for (const admin of admins) {
      if (admin.email) {
        const result = await emailService.sendLowStockAlert(admin.email, lowStockItems);
        console.log(`Low stock alert sent to ${admin.email}:`, result);
      }
    }
  } catch (error) {
    console.error('Low stock check error:', error);
  }
};

const sendOrderReminders = async () => {
  try {
    console.log('Running order reminder check...');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOrders = await Order.find({
      isActive: true,
      orderDate: { $gte: thirtyDaysAgo }
    }).distinct('customer');

    const customers = await Customer.find({
      isActive: true,
      _id: { $nin: recentOrders }
    });

    if (customers.length === 0) {
      console.log('No customers need order reminders');
      return;
    }

    const salesMen = await User.find({
      roles: 'Sales Man',
      isActive: true
    });

    for (const salesMan of salesMen) {
      if (salesMan.email) {
        const result = await emailService.sendOrderReminder(salesMan.email, customers);
        console.log(`Order reminder sent to ${salesMan.email}:`, result);
      }
    }
  } catch (error) {
    console.error('Order reminder error:', error);
  }
};

const checkCustomerDues = async () => {
  try {
    console.log('Running customer dues check...');

    // 1. Get stats for ALL customers who have any unpaid or partial bills
    const customerDebtStats = await Bill.aggregate([
      {
        $match: {
          isActive: true,
          status: { $in: ['Unpaid', 'Partial'] },
          dueAmount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$customer',
          billCount: { $sum: 1 },
          totalBillAmount: { $sum: '$totalAmount' },
          totalBillDue: { $sum: '$dueAmount' }
        }
      },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customerInfo'
        }
      },
      { $unwind: '$customerInfo' },
      { $match: { 'customerInfo.isActive': true } }
    ]);

    // 2. Get all active customers to ensure those with 0 bills are included
    const allCustomers = await Customer.find({ isActive: true });

    // 3. Map stats for quick lookup
    const statsMap = new Map();
    customerDebtStats.forEach(s => statsMap.set(s._id.toString(), s));

    const highRiskCustomers = [];
    const regularCustomers = [];
    const eligibleCustomers = [];

    console.log('--- Customers Eligibility Summary ---');
    for (const customer of allCustomers) {
      const stat = statsMap.get(customer._id.toString()) || { billCount: 0, totalBillAmount: 0, totalBillDue: 0 };
      const billCount = stat.billCount;
      const totalAmount = stat.totalBillAmount || 0;
      const totalDue = stat.totalBillDue;

      // New Calculation:
      const paidAmount = totalAmount - totalDue;
      const paidPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 100;
      const duePercentage = totalAmount > 0 ? (totalDue / totalAmount) * 100 : 0;

      const customerData = {
        ...customer.toObject(),
        billCount,
        totalDue,
        totalAmount,
        paidAmount,
        paidPercentage: paidPercentage.toFixed(1),
        duePercentage: duePercentage.toFixed(1)
      };

      eligibleCustomers.push(customerData);

      // Categorization:
      // High Priority: > 2 Bills OR Paid < 75% of Total Amount
      // Regular (Eligible): 0-2 Bills AND Paid >= 75% of Total
      if (billCount > 2 || paidPercentage < 75) {
        highRiskCustomers.push(customerData);
        console.log(`- [HIGH PRIORITY] ${customer.shopName}: Bills: ${billCount}, Paid: ₹${paidAmount.toFixed(2)} / ₹${totalAmount.toFixed(2)} (${paidPercentage.toFixed(1)}% Paid)`);
      } else {
        regularCustomers.push(customerData);
        console.log(`- [ELIGIBLE] ${customer.shopName}: Bills: ${billCount}, Paid: ₹${paidAmount.toFixed(2)} / ₹${totalAmount.toFixed(2)} (${paidPercentage.toFixed(1)}% Paid)`);
      }
    }
    console.log('---------------------------');

    if (regularCustomers.length === 0) {
      console.log('No eligible regular customers found to notify');
      return;
    }

    // Get salesmen to send alerts
    const salesMen = await User.find({
      roles: 'Sales Man',
      isActive: true
    });

    for (const salesMan of salesMen) {
      if (salesMan.email) {
        // Send ONLY the list of regular (eligible) customers as requested
        const result = await emailService.sendCustomerDueAlert(
          salesMan.email,
          regularCustomers
        );
        console.log(`Eligible customer alert sent to ${salesMan.email}:`, result);
      }
    }
  } catch (error) {
    console.error('Customer dues check error:', error);
  }
};

const initCronJobs = () => {
  // cron.schedule('0 9 * * *', checkLowStock);

  // cron.schedule('0 8 * * *', sendOrderReminders);

  // Run customer dues check every 5 minutes
  // cron.schedule('*/1 * * * *', checkCustomerDues);

  console.log('Cron jobs initialized');
};

module.exports = { initCronJobs, checkLowStock, sendOrderReminders, checkCustomerDues };
//  cron.schedule('*/1 * * * *', checkCustomerDues);