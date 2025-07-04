const app = require('./app');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const BusinessSettings = require('./models/Business');
dotenv.config();

connectDB();

// Create HTTP server using Express app
const server = http.createServer(app);

// this is just to restart the server

// Initialize Socket.IO with CORS config
const io = socketIo(server, {
  cors: {
    origin: "*",  // In production, restrict this to your frontend URL
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  },
  // Add these lines for better WebSocket handling on various infrastructures:
  transports: ['websocket', 'polling'],
  allowEIO3: true,  // Allows compatibility mode with older clients
  pingTimeout: 30000 // Increase ping timeout for unreliable connections
});

// Add Socket.IO instance to app for controller access
app.set('io', io);

// Function to check and update business status
const updateBusinessStatus = async () => {
  try {
    const settings = await BusinessSettings.findOrCreate();
    
    // Only update if manual override is not active
    if (!settings.businessInfo.manualOverride.isActive) {
      const isOpen = settings.isBusinessOpen();
      const currentStatus = settings.businessInfo.isCurrentlyOpen;
      
      // If status changed, update and emit event
      if (isOpen !== currentStatus) {
        settings.businessInfo.isCurrentlyOpen = isOpen;
        await settings.save();
        
        const status = settings.getBusinessStatus();
        io.emit('businessStatusChanged', status);
        
        console.log(`Business status updated: ${isOpen ? 'OPEN' : 'CLOSED'} - ${status.reason}`);
      }
    }
  } catch (error) {
    console.error('Error updating business status:', error);
  }
};

// Update business status every minute
setInterval(updateBusinessStatus, 60000);

// Initial status check
setTimeout(updateBusinessStatus, 5000);

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Join rooms based on role
  socket.on('join', (data) => {
    const { userId, role } = data;

    if (userId) {
      // Join user-specific room
      socket.join(`user:${userId}`);

      // Join role-based room
      if (role) {
        socket.join(`role:${role}`);
      }

      console.log(`Socket ${socket.id} joined rooms for user ${userId}, role ${role}`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});