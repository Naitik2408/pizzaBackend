const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { registerDeviceToken, unregisterDeviceToken } = require('../controllers/deviceTokenController');

router.post('/register', protect, registerDeviceToken);
router.delete('/unregister', protect, unregisterDeviceToken);

module.exports = router;