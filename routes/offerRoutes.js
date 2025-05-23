const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  getPublicOffers, 
  getOfferByCode, 
  applyOffer,
  validateOffer
} = require('../controllers/offersController');

// Public routes
router.get('/', getPublicOffers); // Get all public active offers
router.get('/code/:code', getOfferByCode); // Get offer details by code

// Protected routes (require login)
router.post('/apply', protect, applyOffer); // Apply offer to cart/order
router.post('/validate', protect, validateOffer); // Validate if offer can be applied

module.exports = router;