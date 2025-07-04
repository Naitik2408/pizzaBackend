const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { 
  getBusinessProfile,
  updateBusinessInfoAndSettings
} = require('../controllers/businessController');

// Public business profile endpoint
router.get('/business/profile', getBusinessProfile);

// Protected business update endpoint
router.put('/business/full', protect, admin, updateBusinessInfoAndSettings);

module.exports = router;
