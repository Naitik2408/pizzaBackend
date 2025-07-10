const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  registerDeviceToken,
  getUserDeviceTokens,
  deleteDeviceToken,
  updateTokenActivity,
  cleanupOldTokens,
} = require('../controllers/deviceTokenController');
const { protect: authMiddleware } = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');

// Validation rules
const registerTokenValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token is required')
    .isString()
    .withMessage('Token must be a string'),
  body('deviceId')
    .notEmpty()
    .withMessage('Device ID is required')
    .isString()
    .withMessage('Device ID must be a string'),
  body('platform')
    .isIn(['android', 'ios'])
    .withMessage('Platform must be android or ios'),
];

// @route   POST /api/device-tokens
// @desc    Register device token
// @access  Private
router.post('/', authMiddleware, registerTokenValidation, validateRequest(), registerDeviceToken);

// @route   GET /api/device-tokens
// @desc    Get user's device tokens
// @access  Private
router.get('/', authMiddleware, getUserDeviceTokens);

// @route   DELETE /api/device-tokens/:tokenId
// @desc    Delete device token
// @access  Private
router.delete('/:tokenId', authMiddleware, deleteDeviceToken);

// @route   PUT /api/device-tokens/:tokenId/activity
// @desc    Update token activity
// @access  Private
router.put('/:tokenId/activity', authMiddleware, updateTokenActivity);

// @route   DELETE /api/device-tokens/cleanup
// @desc    Clean up old tokens (Admin only)
// @access  Private/Admin
router.delete('/cleanup', authMiddleware, cleanupOldTokens);

module.exports = router;
