const BusinessSettings = require('../models/Business');
const asyncHandler = require('express-async-handler');

// @desc    Get business settings
// @route   GET /api/admin/settings
// @access  Private/Admin
const getBusinessSettings = asyncHandler(async (req, res) => {
  const settings = await BusinessSettings.findOrCreate();
  res.status(200).json(settings);
});

// @desc    Update business settings
// @route   PUT /api/admin/settings
// @access  Private/Admin
const updateBusinessSettings = asyncHandler(async (req, res) => {
  // Validate request data
  const {
    upiId,
    bankDetails,
    deliveryCharges,
    taxSettings,
    minimumOrderValue
  } = req.body;
  
  // Simple validation - add more detailed validation as needed
  if (!upiId) {
    res.status(400);
    throw new Error('UPI ID is required');
  }
  
  if (!bankDetails || !bankDetails.accountName || !bankDetails.accountNumber || 
      !bankDetails.ifscCode || !bankDetails.bankName) {
    res.status(400);
    throw new Error('All bank details are required');
  }
  
  // Update settings
  const updatedSettings = await BusinessSettings.findOrCreate(
    {
      upiId,
      bankDetails,
      deliveryCharges,
      taxSettings,
      minimumOrderValue,
    },
    req.user._id
  );
  
  res.status(200).json(updatedSettings);
});

module.exports = {
  getBusinessSettings,
  updateBusinessSettings
};