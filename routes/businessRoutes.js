const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { 
  getBusinessSettings, 
  updateBusinessSettings
} = require('../controllers/businessController');

// Base route is /api/admin/settings
router.route('/')
  .get(getBusinessSettings)
  .put(protect, admin, updateBusinessSettings);

module.exports = router;