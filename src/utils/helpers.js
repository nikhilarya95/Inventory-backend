const generateId = (prefix) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}${random}`.toUpperCase();
};

const generateOrderId = () => generateId('ORD');
const generateBillId = () => generateId('BILL');
const generateTransactionId = () => generateId('TXN');
const generateCustomerId = () => generateId('CUST');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};

const calculatePercentage = (part, whole) => {
  if (whole === 0) return 0;
  return (part / whole) * 100;
};

module.exports = {
  generateId,
  generateOrderId,
  generateBillId,
  generateTransactionId,
  generateCustomerId,
  formatCurrency,
  calculatePercentage
};
