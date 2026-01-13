const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    console.log('Auth middleware - Request URL:', req.originalUrl);
    console.log('Auth middleware - Authorization header:', req.header('Authorization'));
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('Auth middleware - No token provided');
      return res.status(401).json({ message: 'Authentication required' });
    }

    console.log('Auth middleware - Token found:', token.substring(0, 20) + '...');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('Auth middleware - Token decoded, user ID:', decoded.userId);
    
    const user = await User.findById(decoded.userId).select('-password');
    console.log('Auth middleware - User found:', user ? 'YES' : 'NO');
    
    if (!user || !user.isActive) {
      console.log('Auth middleware - User not found or inactive');
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    console.log('Auth middleware - User authenticated:', user.firstName, user.roles);
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware - Error:', error.message);
    res.status(401).json({ message: 'Invalid token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const hasRole = req.user.roles.some(role => roles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

module.exports = { auth, authorize };
