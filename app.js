// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const morgan = require('morgan');
// const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const menuRoutes = require('./routes/menuRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const transactionRoutes = require('./routes/transactionRoutes'); // Add this line
const businessRoutes = require('./routes/businessRoutes');
const offerRoutes = require('./routes/offerRoutes')
const publicRoutes = require('./routes/publicRoutes');
const deviceTokenRoutes = require('./routes/deviceTokenRoutes');
const firebaseNotificationRoutes = require('./routes/firebaseNotificationRoutes');
const errorHandler = require('./middleware/errorHandler');

app.use(express.json());
app.use(morgan('dev'));
app.use(cors());

app.get('/', (req, res) => {
  res.send('Welcome to the Pizza API');
});

// Public routes (no auth required)
app.use('/api', publicRoutes);

// app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/transactions', transactionRoutes); // Add this line
app.use('/api/offers', offerRoutes);
app.use('/api/settings', businessRoutes);
app.use('/api/device-tokens', deviceTokenRoutes);
app.use('/api/notifications', firebaseNotificationRoutes);

app.use(errorHandler);
module.exports = app;