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
    businessInfo,
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
      businessInfo,
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

// @desc    Get business profile (public info)
// @route   GET /api/business/profile
// @access  Public
const getBusinessProfile = asyncHandler(async (req, res) => {
  const settings = await BusinessSettings.findOrCreate();
  const status = settings.getBusinessStatus();
  
  res.status(200).json({
    name: settings.businessInfo.name,
    address: settings.businessInfo.address,
    phone: settings.businessInfo.phone,
    email: settings.businessInfo.email,
    hours: settings.businessInfo.hours,
    isCurrentlyOpen: settings.businessInfo.isCurrentlyOpen,
    manualOverride: settings.businessInfo.manualOverride,
    status: status
  });
});

// @desc    Update business status (manual override)
// @route   PUT /api/admin/business-status
// @access  Private/Admin
const updateBusinessStatus = asyncHandler(async (req, res) => {
  const { isOpen, reason } = req.body;
  
  const settings = await BusinessSettings.findOrCreate();
  settings.businessInfo.manualOverride = {
    isActive: true,
    status: isOpen,
    reason: reason || ''
  };
  settings.businessInfo.isCurrentlyOpen = isOpen;
  await settings.save();
  
  // Emit socket event for real-time updates
  const io = req.app.get('io');
  if (io) {
    io.emit('businessStatusChanged', {
      isOpen,
      reason,
      manualOverride: true
    });
  }
  
  res.status(200).json({
    message: 'Business status updated',
    status: settings.getBusinessStatus()
  });
});

// @desc    Clear manual override (return to schedule)
// @route   DELETE /api/admin/business-status/override
// @access  Private/Admin
const clearBusinessStatusOverride = asyncHandler(async (req, res) => {
  const settings = await BusinessSettings.findOrCreate();
  settings.businessInfo.manualOverride = {
    isActive: false,
    status: true,
    reason: ''
  };
  
  const isOpen = settings.isBusinessOpen();
  settings.businessInfo.isCurrentlyOpen = isOpen;
  await settings.save();
  
  // Emit socket event for real-time updates
  const io = req.app.get('io');
  if (io) {
    const status = settings.getBusinessStatus();
    io.emit('businessStatusChanged', status);
  }
  
  res.status(200).json({
    message: 'Manual override cleared',
    status: settings.getBusinessStatus()
  });
});

// @desc    Update business info and settings together
// @route   PUT /api/business/full
// @access  Private/Admin
const updateBusinessInfoAndSettings = asyncHandler(async (req, res) => {
  const { businessInfo, settings } = req.body;
  
  if (!businessInfo || !settings) {
    res.status(400);
    throw new Error('Both business info and settings are required');
  }
  
  // Get current settings
  const currentSettings = await BusinessSettings.findOrCreate();
  
  // Update business info
  if (businessInfo.name !== undefined) currentSettings.businessInfo.name = businessInfo.name;
  if (businessInfo.address !== undefined) currentSettings.businessInfo.address = businessInfo.address;
  if (businessInfo.phone !== undefined) currentSettings.businessInfo.phone = businessInfo.phone;
  if (businessInfo.email !== undefined) currentSettings.businessInfo.email = businessInfo.email;
  if (businessInfo.isCurrentlyOpen !== undefined) {
    currentSettings.businessInfo.isCurrentlyOpen = businessInfo.isCurrentlyOpen;
  }
  if (businessInfo.manualOverride !== undefined) {
    currentSettings.businessInfo.manualOverride = businessInfo.manualOverride;
  }
  
  // Update settings
  if (settings.upiId !== undefined) currentSettings.upiId = settings.upiId;
  if (settings.bankDetails !== undefined) currentSettings.bankDetails = settings.bankDetails;
  if (settings.deliveryCharges !== undefined) currentSettings.deliveryCharges = settings.deliveryCharges;
  if (settings.taxSettings !== undefined) currentSettings.taxSettings = settings.taxSettings;
  if (settings.minimumOrderValue !== undefined) currentSettings.minimumOrderValue = settings.minimumOrderValue;
  
  // Save updated settings
  await currentSettings.save();
  
  // Emit socket event for business status changes if status changed
  const io = req.app.get('io');
  if (io && businessInfo.isCurrentlyOpen !== undefined) {
    const status = currentSettings.getBusinessStatus();
    io.emit('businessStatusChanged', status);
  }
  
  res.status(200).json({
    message: 'Business info and settings updated successfully',
    businessInfo: currentSettings.businessInfo,
    settings: {
      upiId: currentSettings.upiId,
      bankDetails: currentSettings.bankDetails,
      deliveryCharges: currentSettings.deliveryCharges,
      taxSettings: currentSettings.taxSettings,
      minimumOrderValue: currentSettings.minimumOrderValue
    }
  });
});

module.exports = {
  getBusinessSettings,
  updateBusinessSettings,
  getBusinessProfile,
  updateBusinessStatus,
  clearBusinessStatusOverride,
  updateBusinessInfoAndSettings
};