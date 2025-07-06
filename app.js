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
const deviceTokenRoutes = require('./routes/deviceTokenRoutes');
const businessRoutes = require('./routes/businessRoutes');
const offerRoutes = require('./routes/offerRoutes')
const publicRoutes = require('./routes/publicRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
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
app.use('/api/device', deviceTokenRoutes);
app.use('/api/notifications', notificationRoutes); // FCM notification test routes

// Add test route for enhanced notifications
app.post('/api/test/notification', async (req, res) => {
  try {
    console.log('🧪 TEST: Enhanced notification request received');
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
    
    const { type, orderData } = req.body;
    
    if (type === 'test_enhanced') {
      console.log('🚨 Sending test enhanced notification...');
      
      // Import notifications here to avoid circular imports
      const { sendNewOrderNotification } = require('./utils/notifications');
      
      // Create a test order object
      const testOrder = {
        _id: orderData.orderId,
        orderNumber: orderData.orderNumber,
        customerName: orderData.customerName,
        amount: orderData.amount,
        items: [
          {
            name: 'Test Pizza',
            quantity: 1,
            price: orderData.amount
          }
        ],
        address: 'Test Address',
        customerPhone: '+1234567890',
        paymentMethod: 'Online',
        status: 'Pending'
      };
      
      const result = await sendNewOrderNotification(testOrder);
      
      console.log('✅ Test notification result:', result);
      
      res.json({
        success: true,
        message: 'Enhanced notification test sent successfully',
        result: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid test type'
      });
    }
  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Test notification failed',
      error: error.message
    });
  }
});

app.use(errorHandler);
module.exports = app;