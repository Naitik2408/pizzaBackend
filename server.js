const app = require('./app');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
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