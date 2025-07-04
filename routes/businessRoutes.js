const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { 
  getBusinessSettings, 
  updateBusinessSettings,
  getBusinessProfile,
  updateBusinessStatus,
  clearBusinessStatusOverride
} = require('../controllers/businessController');

// Base route is /api/admin/settings
router.route('/')
  .get(getBusinessSettings)
  .put(protect, admin, updateBusinessSettings);

// Business status management
router.route('/business-status')
  .put(protect, admin, updateBusinessStatus);

router.route('/business-status/override')
  .delete(protect, admin, clearBusinessStatusOverride);

module.exports = router;