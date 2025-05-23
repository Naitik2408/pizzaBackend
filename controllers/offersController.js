const Offer = require('../models/Offer');
const asyncHandler = require('express-async-handler');

// @desc    Get all public active offers
// @route   GET /api/offers
// @access  Public
exports.getPublicOffers = asyncHandler(async (req, res) => {
  // Get current date
  const now = new Date();
  
  // Find all active offers that are valid for the current date
  const offers = await Offer.find({
    active: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now }
  }).sort({ createdAt: -1 });
  
  res.json(offers);
});

// @desc    Get offer by code
// @route   GET /api/offers/code/:code
// @access  Public
exports.getOfferByCode = asyncHandler(async (req, res) => {
  const { code } = req.params;
  
  // Find offer by code (case insensitive)
  const offer = await Offer.findOne({ 
    code: code.toUpperCase(),
    active: true
  });
  
  if (!offer) {
    return res.status(404).json({ message: 'Offer not found or inactive' });
  }
  
  // Check if offer is valid
  const now = new Date();
  if (now < offer.validFrom || now > offer.validUntil) {
    return res.status(400).json({ message: 'Offer has expired or not yet active' });
  }
  
  // Check usage limit
  if (offer.usageLimit !== null && offer.usageCount >= offer.usageLimit) {
    return res.status(400).json({ message: 'Offer usage limit reached' });
  }
  
  res.json(offer);
});

// @desc    Apply offer to an order
// @route   POST /api/offers/apply
// @access  Private
exports.applyOffer = asyncHandler(async (req, res) => {
  const { code, orderAmount, items } = req.body;
  
  if (!code || !orderAmount) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  
  // Find offer by code
  const offer = await Offer.findOne({ 
    code: code.toUpperCase(),
    active: true
  });
  
  if (!offer) {
    return res.status(404).json({ message: 'Offer not found or inactive' });
  }
  
  // Check if offer is valid
  const now = new Date();
  if (now < offer.validFrom || now > offer.validUntil) {
    return res.status(400).json({ message: 'Offer has expired or not yet active' });
  }
  
  // Check minimum order value
  if (orderAmount < offer.minOrderValue) {
    return res.status(400).json({ 
      message: `Minimum order amount is ₹${offer.minOrderValue}` 
    });
  }
  
  // Check usage limit
  if (offer.usageLimit !== null && offer.usageCount >= offer.usageLimit) {
    return res.status(400).json({ message: 'Offer usage limit reached' });
  }

  // Check if offer is restricted to specific users
  if (offer.restrictedToUsers && offer.restrictedToUsers.length > 0) {
    if (!offer.restrictedToUsers.includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'This offer is not available for your account' });
    }
  }

  // Check if offer is for new users only
  if (offer.isNewUserOffer) {
    // Implementation depends on your specific business logic
    // For example, check if user has previous orders
    const hasOrders = false; // Replace with actual check
    if (hasOrders) {
      return res.status(403).json({ message: 'This offer is only for new users' });
    }
  }
  
  // Calculate discount
  let discount = 0;
  
  if (offer.discountType === 'percentage') {
    discount = (orderAmount * offer.discountValue) / 100;
    
    // Apply maximum discount if specified
    if (offer.maxDiscountAmount !== null && discount > offer.maxDiscountAmount) {
      discount = offer.maxDiscountAmount;
    }
  } else {
    // Fixed discount
    discount = offer.discountValue;
  }
  
  // Ensure discount isn't more than order amount
  if (discount > orderAmount) {
    discount = orderAmount;
  }
  
  // Return the calculated discount
  res.json({
    offer: {
      code: offer.code,
      title: offer.title,
      discountType: offer.discountType,
      discountValue: offer.discountValue
    },
    discount: discount.toFixed(2),
    finalAmount: (orderAmount - discount).toFixed(2)
  });
});

// @desc    Validate if an offer can be applied
// @route   POST /api/offers/validate
// @access  Private
exports.validateOffer = asyncHandler(async (req, res) => {
  const { code, orderAmount } = req.body;
  
  if (!code) {
    return res.status(400).json({ message: 'Offer code is required' });
  }
  
  // Find offer by code
  const offer = await Offer.findOne({ 
    code: code.toUpperCase(),
    active: true
  });
  
  if (!offer) {
    return res.status(404).json({ message: 'Invalid offer code' });
  }
  
  // Check if offer is valid
  const now = new Date();
  if (now < offer.validFrom || now > offer.validUntil) {
    return res.status(400).json({ message: 'This offer has expired' });
  }
  
  // Check minimum order value if orderAmount is provided
  if (orderAmount && orderAmount < offer.minOrderValue) {
    return res.status(400).json({ 
      valid: false,
      message: `Minimum order amount is ₹${offer.minOrderValue}`,
      minOrderValue: offer.minOrderValue
    });
  }
  
  // Check usage limit
  if (offer.usageLimit !== null && offer.usageCount >= offer.usageLimit) {
    return res.status(400).json({ message: 'This offer is no longer available' });
  }
  
  // Return offer details
  res.json({
    valid: true,
    offer: {
      code: offer.code,
      title: offer.title,
      description: offer.description,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      minOrderValue: offer.minOrderValue,
      maxDiscountAmount: offer.maxDiscountAmount
    }
  });
});