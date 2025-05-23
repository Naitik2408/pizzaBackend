const express = require('express');
const { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  logoutUser,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
  setDefaultAddress,
  createGuestToken,
  getDeliveryPartnerStatus,
  toggleDeliveryStatus,
  getUserPublicProfile // Add this new function
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// Auth routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getUserProfile);
router.post('/logout', protect, logoutUser);
router.post('/guest-token', createGuestToken);

// Add new route for getting public profile by ID
router.get('/profile/:userId', protect, getUserPublicProfile);

// Address routes
router.get('/addresses', protect, getUserAddresses);
router.post('/addresses', protect, addUserAddress);
router.put('/addresses/:addressId', protect, updateUserAddress);
router.delete('/addresses/:addressId', protect, deleteUserAddress);
router.put('/addresses/:addressId/default', protect, setDefaultAddress);

// Delivery partner routes
router.get('/delivery/status', protect, getDeliveryPartnerStatus);
router.put('/delivery/status/toggle', protect, toggleDeliveryStatus);

module.exports = router;