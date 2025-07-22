const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getMenuItems,
  getSearchSuggestions,
  getPopularItems,
  getMenuCategories,
  addMenuItem,
  editMenuItem,
  deleteMenuItem,
  toggleAvailability,
  toggleSizeAvailability,
  toggleAddOnAvailability,
  rateMenuItem,
  getAvailableSizes
} = require('../controllers/menuController');

const router = express.Router();

// Public routes
router.get('/', getMenuItems);
router.get('/search/suggestions', getSearchSuggestions);
router.get('/popular', getPopularItems);
router.get('/categories', getMenuCategories);
router.get('/sizes', getAvailableSizes);

// Admin routes
router.post('/', protect, admin, addMenuItem);
router.put('/:id', protect, admin, editMenuItem);
router.delete('/:id', protect, admin, deleteMenuItem);
router.put('/:id/toggle-availability', protect, admin, toggleAvailability);
router.put('/:id/toggle-size-availability', protect, admin, toggleSizeAvailability);
router.put('/:id/toggle-addon-availability', protect, admin, toggleAddOnAvailability);

// User routes
router.post('/:id/rate', protect, rateMenuItem);

module.exports = router;