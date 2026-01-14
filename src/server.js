require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const routes = require('./routes');
const { initCronJobs } = require('./utils/cronJobs');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
// app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all API requests
app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.log('Request body:', req.body);
  next();
});

app.use('/api', routes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ roles: { $in: ['Admin'] } });
    if (!adminExists) {
      const admin = new User({
        firstName: 'Admin',
        lastName: 'User',
        username: 'admin',
        email: 'admin@example.com',
        phone: '0000000000',
        password: 'admin123',
        roles: ['Admin'],
        address: 'System Admin'
      });
      await admin.save();
      console.log('Default admin created: username=admin, password=admin123');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
};

const startServer = async () => {
  try {
    await connectDB();
    await createDefaultAdmin();
    initCronJobs();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
