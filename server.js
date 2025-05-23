const app = require('./app');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
dotenv.config();

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://192.168.194.48:${PORT}`);
});