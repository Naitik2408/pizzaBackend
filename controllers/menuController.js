const MenuItem = require('../models/MenuItem');

// Update getMenuItems to support sizeType filtering
const getMenuItems = async (req, res) => {
  try {
    const { category, foodType, size, sizeType } = req.query;

    // Build the query object
    const query = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    if (foodType && foodType !== 'All') {
      query.foodType = foodType;
    }

    // Add sizeType filtering
    if (sizeType && ['single', 'multiple'].includes(sizeType)) {
      query.sizeType = sizeType;
    }

    // Filter by size if specified
    if (size && size !== 'All' && size !== 'Not Applicable') {
      query.$or = [
        // Match items with this size in size variations
        { 'sizeVariations.size': size },
        // Or match single-size items with this size
        { size: size, sizeType: 'single' }
      ];
    }

    const menuItems = await MenuItem.find(query);
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

module.exports = {
  getMenuItems,
  addMenuItem,
  editMenuItem,
  deleteMenuItem,
  toggleAvailability,
  toggleSizeAvailability,
  toggleAddOnAvailability, // New function
  rateMenuItem,
  getAvailableSizes
};