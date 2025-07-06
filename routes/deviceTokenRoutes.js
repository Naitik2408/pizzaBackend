const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { registerDeviceToken, unregisterDeviceToken, clearAllDeviceTokens } = require('../controllers/deviceTokenController');

router.post('/register', protect, registerDeviceToken);
router.delete('/unregister', protect, unregisterDeviceToken);
router.delete('/clear-all', protect, clearAllDeviceTokens);

module.exports = router;