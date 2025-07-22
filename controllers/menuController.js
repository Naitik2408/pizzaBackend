const MenuItem = require('../models/MenuItem');

// Enhanced getMenuItems with pagination, search, and performance optimizations
const getMenuItems = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      foodType, 
      size, 
      sizeType,
      search, 
      sortBy = 'popular',
      minPrice,
      maxPrice,
      popular,
      available = 'true' // Default to showing only available items
    } = req.query;

    // Build optimized query with indexes
    const query = {};
    const sort = {};

    // Search optimization with text search
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Category filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // Food type filter
    if (foodType && foodType !== 'All') {
      query.foodType = foodType;
    }

    // Available filter
    if (available !== 'all') {
      query.available = available === 'true';
    }

    // Popular filter
    if (popular === 'true') {
      query.popular = true;
    }

    // Size type filtering
    if (sizeType && ['single', 'multiple'].includes(sizeType)) {
      query.sizeType = sizeType;
    }

    // Size filtering
    if (size && size !== 'All' && size !== 'Not Applicable') {
      query.$or = [
        { 'sizeVariations.size': size },
        { size: size, sizeType: 'single' }
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice && !isNaN(parseFloat(minPrice))) {
        query.price.$gte = parseFloat(minPrice);
      }
      if (maxPrice && !isNaN(parseFloat(maxPrice))) {
        query.price.$lte = parseFloat(maxPrice);
      }
    }

    // Sort optimization
    switch (sortBy) {
      case 'priceAsc':
        sort.price = 1;
        break;
      case 'priceDesc':
        sort.price = -1;
        break;
      case 'rating':
        sort.rating = -1;
        sort.ratingCount = -1;
        break;
      case 'name':
        sort.name = 1;
        break;
      case 'newest':
        sort.createdAt = -1;
        break;
      case 'popular':
      default:
        sort.popular = -1;
        sort.rating = -1;
        sort.ratingCount = -1;
        break;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 50); // Max 50 items per page
    const skip = (pageNum - 1) * limitNum;

    // Optimized projection - only essential fields for list view
    const listProjection = {
      name: 1,
      description: 1,
      price: 1,
      category: 1,
      image: 1,
      foodType: 1,
      isVeg: 1,
      available: 1,
      popular: 1,
      rating: 1,
      ratingCount: 1,
      hasMultipleSizes: 1,
      hasAddOns: 1,
      size: 1,
      sizeVariations: 1,
      addOnGroups: 1,
      createdAt: 1,
      updatedAt: 1
    };

    // Execute queries in parallel for better performance
    const [items, total] = await Promise.all([
      MenuItem.find(query)
        .select(listProjection)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean() for 30-40% better performance
      MenuItem.countDocuments(query)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limitNum);
    const hasMore = pageNum < totalPages;
    const hasPrevious = pageNum > 1;

    res.json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: totalPages,
        hasMore,
        hasPrevious,
        isFirstPage: pageNum === 1,
        isLastPage: pageNum === totalPages
      },
      filters: {
        category,
        foodType,
        search,
        sortBy,
        minPrice,
        maxPrice,
        available
      }
    });
  } catch (error) {
    console.error('Error in getMenuItems:', error);
    res.status(500).json({ 
      message: error.message,
      items: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0, hasMore: false }
    });
  }
};

// Update addMenuItem to handle add-ons and customizations
const addMenuItem = async (req, res) => {
  const {
    name, description, price, category, image,
    available, popular, foodType, size,
    sizeVariations, sizeType, hasMultipleSizes,
    hasAddOns, addOnGroups
  } = req.body;

  try {
    const menuItemData = {
      name,
      description,
      price, // Base price
      category,
      image,
      available,
      popular,
      foodType,
      size: size || 'Medium', // Default size
      sizeType: sizeType || 'single', // Use the explicit sizeType
      // Add size variations if provided
      sizeVariations: sizeType === 'multiple' ? sizeVariations : []
    };

    // Add customization data if provided
    if (hasAddOns) {
      menuItemData.hasAddOns = hasAddOns;
      menuItemData.addOnGroups = addOnGroups || [];
    }

    const newMenuItem = new MenuItem(menuItemData);
    const savedMenuItem = await newMenuItem.save();
    res.status(201).json(savedMenuItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update editMenuItem to handle add-ons and customizations
const editMenuItem = async (req, res) => {
  const { id } = req.params;
  const {
    name, description, price, category, image,
    available, popular, foodType, size,
    sizeVariations, rating, sizeType, hasMultipleSizes,
    hasAddOns, addOnGroups
  } = req.body;

  try {
    // Prepare update object
    const updateData = {
      name, description, price, category, image,
      available, popular, foodType, size, rating,
      sizeType: sizeType || 'single'
    };

    // Add size variations if this is a multiple-size item
    if (sizeType === 'multiple' && sizeVariations) {
      updateData.sizeVariations = sizeVariations;
    } else {
      // If switching to single-size, clear variations
      updateData.sizeVariations = [];
    }

    // Add customization data if provided
    if (hasAddOns !== undefined) {
      updateData.hasAddOns = hasAddOns;
      if (hasAddOns && addOnGroups) {
        updateData.addOnGroups = addOnGroups;
      } else {
        updateData.addOnGroups = [];
      }
    }

    const updatedMenuItem = await MenuItem.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedMenuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    // Emit socket event for real-time updates if availability changed
    const io = req.app.get('io');
    if (io && available !== undefined) {
      io.emit('menuItemUpdated', {
        itemId: updatedMenuItem._id,
        available: updatedMenuItem.available,
        type: 'item'
      });
    }

    res.json(updatedMenuItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a menu item
const deleteMenuItem = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedMenuItem = await MenuItem.findByIdAndDelete(id);

    if (!deletedMenuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle availability for the entire item
const toggleAvailability = async (req, res) => {
  const { id } = req.params;

  try {
    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    menuItem.available = !menuItem.available;
    await menuItem.save();

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('menuItemUpdated', {
        itemId: menuItem._id,
        available: menuItem.available,
        type: 'item'
      });
    }

    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle availability for a specific size
const toggleSizeAvailability = async (req, res) => {
  const { id } = req.params;
  const { size } = req.body;

  try {
    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    if (!size) {
      return res.status(400).json({ message: 'Size is required' });
    }

    if (!menuItem.hasMultipleSizes) {
      return res.status(400).json({ message: 'This item does not have multiple sizes' });
    }

    // Find the size variation
    const sizeIndex = menuItem.sizeVariations.findIndex(
      variation => variation.size === size
    );

    if (sizeIndex === -1) {
      return res.status(404).json({ message: 'Size not found for this item' });
    }

    // Toggle the availability
    menuItem.sizeVariations[sizeIndex].available = !menuItem.sizeVariations[sizeIndex].available;
    await menuItem.save();

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('menuItemUpdated', {
        itemId: menuItem._id,
        sizeVariations: menuItem.sizeVariations,
        size: size,
        available: menuItem.sizeVariations[sizeIndex].available,
        type: 'size'
      });
    }

    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle availability for a specific add-on
const toggleAddOnAvailability = async (req, res) => {
  const { id } = req.params;
  const { groupId, addOnId } = req.body;

  try {
    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    if (!groupId || !addOnId) {
      return res.status(400).json({ message: 'Group ID and Add-on ID are required' });
    }

    if (!menuItem.hasAddOns) {
      return res.status(400).json({ message: 'This item does not have customizations' });
    }

    // Find the group and add-on
    const groupIndex = menuItem.addOnGroups.findIndex(group => group.id === groupId);
    
    if (groupIndex === -1) {
      return res.status(404).json({ message: 'Customization group not found' });
    }

    const addOnIndex = menuItem.addOnGroups[groupIndex].addOns.findIndex(
      addOn => addOn.id === addOnId
    );

    if (addOnIndex === -1) {
      return res.status(404).json({ message: 'Customization option not found' });
    }

    // Toggle the availability
    menuItem.addOnGroups[groupIndex].addOns[addOnIndex].available = 
      !menuItem.addOnGroups[groupIndex].addOns[addOnIndex].available;
    
    await menuItem.save();

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('menuItemUpdated', {
        itemId: menuItem._id,
        addOnGroups: menuItem.addOnGroups,
        groupId: groupId,
        addOnId: addOnId,
        available: menuItem.addOnGroups[groupIndex].addOns[addOnIndex].available,
        type: 'addon'
      });
    }

    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Rate a menu item
const rateMenuItem = async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;

  try {
    const menuItem = await MenuItem.findById(id);

    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    // Calculate new average rating
    const newRatingCount = menuItem.ratingCount + 1;
    const newRating = ((menuItem.rating * menuItem.ratingCount) + rating) / newRatingCount;

    // Update with new rating
    menuItem.rating = parseFloat(newRating.toFixed(1)); // Round to 1 decimal place
    menuItem.ratingCount = newRatingCount;

    await menuItem.save();

    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all available sizes
const getAvailableSizes = async (req, res) => {
  try {
    // Get all unique sizes used in items, both as primary size and in variations
    const singleSizesResult = await MenuItem.distinct('size', { sizeType: 'single' });
    const variationSizesResult = await MenuItem.distinct('sizeVariations.size');
    
    // Combine and deduplicate
    const allSizes = [...new Set([...singleSizesResult, ...variationSizesResult])];
    
    // Filter out 'Not Applicable'
    const availableSizes = allSizes.filter(size => size !== 'Not Applicable');
    
    res.json(availableSizes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get search suggestions for autocomplete
const getSearchSuggestions = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const searchRegex = new RegExp(query.trim(), 'i');

    // Get suggestions from menu items and categories
    const suggestions = await MenuItem.aggregate([
      {
        $match: {
          $or: [
            { name: searchRegex },
            { category: searchRegex },
            { description: searchRegex }
          ],
          available: true
        }
      },
      {
        $group: {
          _id: null,
          names: { $addToSet: '$name' },
          categories: { $addToSet: '$category' }
        }
      },
      {
        $project: {
          suggestions: {
            $slice: [
              {
                $filter: {
                  input: { $concatArrays: ['$names', '$categories'] },
                  cond: { $regexMatch: { input: '$$this', regex: searchRegex } }
                }
              },
              10
            ]
          }
        }
      }
    ]);

    const results = suggestions[0]?.suggestions || [];
    res.json({ suggestions: results });
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    res.status(500).json({ suggestions: [], message: error.message });
  }
};

// Get popular items for home screen
const getPopularItems = async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    
    const popularItems = await MenuItem.find({
      popular: true,
      available: true
    })
    .select('name description price image category foodType rating ratingCount')
    .sort({ rating: -1, ratingCount: -1 })
    .limit(parseInt(limit, 10))
    .lean();

    res.json(popularItems);
  } catch (error) {
    console.error('Error getting popular items:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get menu categories with item counts
const getMenuCategories = async (req, res) => {
  try {
    const categories = await MenuItem.aggregate([
      {
        $match: { available: true }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          hasVegOptions: { $sum: { $cond: [{ $eq: ['$foodType', 'Veg'] }, 1, 0] } },
          hasNonVegOptions: { $sum: { $cond: [{ $eq: ['$foodType', 'Non-Veg'] }, 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          count: 1,
          avgRating: { $round: ['$avgRating', 1] },
          hasVegOptions: { $gt: ['$hasVegOptions', 0] },
          hasNonVegOptions: { $gt: ['$hasNonVegOptions', 0] }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({ categories });
  } catch (error) {
    console.error('Error getting menu categories:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMenuItems,
  addMenuItem,
  editMenuItem,
  deleteMenuItem,
  toggleAvailability,
  toggleSizeAvailability,
  toggleAddOnAvailability, // New function
  rateMenuItem,
  getAvailableSizes,
  getSearchSuggestions,
  getPopularItems,
  getMenuCategories
};