const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, authorize('Admin'), async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, authorize('Admin'), async (req, res) => {
  try {
    console.log('User view API hit - ID:', req.params.id);
    console.log('Request headers:', req.headers);
    console.log('Request user:', req.user);

    const user = await User.findById(req.params.id).select('-password');
    console.log('Found user:', user ? 'YES' : 'NO');

    if (!user) {
      console.log('User not found, sending 404');
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Sending user data:', user);
    res.json(user);
  } catch (error) {
    console.error('User view API error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, authorize('Admin'), [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').matches(/^\d{10}$/).withMessage('Phone must be 10 digits'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('roles').isArray({ min: 1 }).withMessage('At least one role is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const existingUser = await User.findOne({
      $or: [{ username: req.body.username.toLowerCase() }, { email: req.body.email.toLowerCase() }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    const user = new User(req.body);
    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: { ...user.toObject(), password: undefined }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', auth, authorize('Admin'), [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('username').optional().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('phone').optional().matches(/^\d{10}$/),
  body('roles').optional().isArray({ min: 1 }),
  body('password').optional().isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    console.log('Update body:', req.body);
    const { firstName, lastName, username, email, phone, roles, aadharNumber, address, password } = req.body;

    console.log('Searching for user to update:', req.params.id);
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields if provided
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (roles) user.roles = roles;
    if (aadharNumber !== undefined) user.aadharNumber = aadharNumber;
    if (address !== undefined) user.address = address;

    // Handle username update checks
    if (username && username.toLowerCase() !== user.username.toLowerCase()) {
      const existingUser = await User.findOne({ username: username.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      user.username = username.toLowerCase();
    }

    // Handle email update checks
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      user.email = email.toLowerCase();
    }

    // Handle password update
    if (password) {
      user.password = password; // Hashing is handled by pre-save hook
    }

    console.log('Final user object before save:', user.toObject());
    console.log('Calling user.save()...');
    await user.save();
    console.log('user.save() success!');

    res.json({ message: 'User updated successfully', user: { ...user.toObject(), password: undefined } });
  } catch (error) {
    console.error('Update user error details:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

router.delete('/:id', auth, authorize('Admin'), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
