// Test script to check user view endpoint
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const testUserView = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if there are any users
    const users = await User.find({ isActive: true }).select('-password');
    console.log(`Found ${users.length} active users:`);
    
    users.forEach(user => {
      console.log(`- ID: ${user._id}, Name: ${user.firstName} ${user.lastName}, Email: ${user.email}, Roles: ${user.roles}`);
    });

    // Test specific user lookup
    if (users.length > 0) {
      const testUser = await User.findById(users[0]._id).select('-password');
      console.log('\nTest user lookup by ID:');
      console.log(testUser);
    }

    await mongoose.disconnect();
    console.log('\nTest completed');
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
};

testUserView();
