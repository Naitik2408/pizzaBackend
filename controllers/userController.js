const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { emitDeliveryStatusUpdate } = require('../utils/socket');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

/**
 * Get user data with configurable detail levels based on permission
 * @param {Object} user - The user object from the database
 * @param {String} requestType - The type of request: 'self', 'admin', or 'basic'
 * @returns {Object} Formatted user data object
 */
const getUserData = (user, requestType = 'basic') => {
  if (!user) return null;

  // Base user data that's safe for any permission level
  const baseUserData = {
    _id: user._id || user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  // For delivery partners, include role-specific details
  if (user.role === 'delivery' && user.deliveryDetails) {
    // Basic delivery info for listings
    const deliveryBaseInfo = {
      vehicleType: user.deliveryDetails.vehicleType || 'Not specified',
      isOnline: user.deliveryDetails.isOnline || false,
      isVerified: user.deliveryDetails.isVerified || false,
      status: user.deliveryDetails.status || 'pending'
    };

    // Admin view includes sensitive verification documents
    const adminDeliveryInfo = {
      ...deliveryBaseInfo,
      aadharCard: user.deliveryDetails.aadharCard,
      drivingLicense: user.deliveryDetails.drivingLicense,
      verificationNotes: user.deliveryDetails.verificationNotes,
      lastActiveTime: user.deliveryDetails.lastActiveTime
    };

    // Decide what level of delivery details to include
    switch (requestType) {
      case 'admin':
        return {
          ...baseUserData,
          deliveryDetails: adminDeliveryInfo
        };
      case 'self':
        return {
          ...baseUserData,
          deliveryDetails: {
            ...adminDeliveryInfo,
            // May exclude some sensitive internal notes
            verificationNotes: user.deliveryDetails.status === 'rejected' ?
              user.deliveryDetails.verificationNotes : undefined
          }
        };
      default:
        return {
          ...baseUserData,
          deliveryDetails: deliveryBaseInfo
        };
    }
  }

  // For customers, include address data only for self or admin
  if (user.role === 'customer') {
    switch (requestType) {
      case 'admin':
      case 'self':
        return {
          ...baseUserData,
          addresses: user.addresses || []
        };
      default:
        return baseUserData;
    }
  }

  // For admin users, just return the base data
  return baseUserData;
};

// Register user
const registerUser = async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    // Delivery partner specific fields
    vehicleType,
    aadharCard,
    drivingLicense
  } = req.body;

  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user data object
    const userData = {
      name,
      email,
      password,
      role: role || 'customer'
    };

    // If registering as a delivery partner, add the delivery details
    if (role === 'delivery') {
      // Validate required delivery partner fields
      if (!vehicleType) {
        return res.status(400).json({ message: 'Vehicle type is required for delivery partners' });
      }

      if (!aadharCard) {
        return res.status(400).json({ message: 'Aadhar Card document is required for delivery partners' });
      }

      if (!drivingLicense) {
        return res.status(400).json({ message: 'Driving License document is required for delivery partners' });
      }

      // Add delivery details
      userData.deliveryDetails = {
        vehicleType,
        aadharCard,
        drivingLicense,
        isVerified: false,
        status: 'pending',
        isOnline: false
      };
    }

    // Create the user
    const user = await User.create(userData);

    if (user) {
      // Different response based on user role
      if (role === 'delivery') {
        res.status(201).json({
          message: 'Delivery partner application submitted successfully. We will review your documents and contact you soon.',
          status: 'pending',
          _id: user.id
        });
      } else {
        // Regular customer registration response
        res.status(201).json({
          _id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user.id),
        });
      }
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Login user with delivery partner status check
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // For delivery partners, check application status
    if (user.role === 'delivery') {
      // Check application status
      if (user.deliveryDetails.status === 'pending') {
        return res.status(403).json({
          message: 'Your application is under review. Please check back later.',
          status: 'pending'
        });
      }

      if (user.deliveryDetails.status === 'rejected') {
        return res.status(403).json({
          message: 'Your application was not approved. Please contact support for more information.',
          status: 'rejected',
          reason: user.deliveryDetails.verificationNotes
        });
      }
    }

    // Use getUserData function to format response consistently
    const userData = getUserData(user, 'self');

    // Login successful - add token to the response
    res.json({
      ...userData,
      token: generateToken(user.id),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Logout user
const logoutUser = async (req, res) => {
  try {
    // If delivery partner, set their status to offline when logging out
    if (req.user && req.user.role === 'delivery') {
      const user = await User.findById(req.user.id);
      if (user && user.deliveryDetails && user.deliveryDetails.isOnline) {
        user.deliveryDetails.isOnline = false;
        await user.save();
      }
    }

    // Invalidate the token (optional: implement token blacklist logic here)
    res.status(200).json({ message: 'User logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user profile with delivery details if applicable - using the unified function
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Use the new function with 'self' permission level
    const userData = getUserData(user, 'self');
    res.json(userData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get public profile data for a user
const getUserPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // For regular users, only provide basic public info
    // For self or admins, provide more details
    const isSelf = req.user && req.user.id === userId;
    const isAdmin = req.user && req.user.role === 'admin';

    const requestType = isAdmin ? 'admin' : (isSelf ? 'self' : 'basic');
    const userData = getUserData(user, requestType);

    res.json(userData);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
};

// Get delivery partner application status
const getDeliveryPartnerStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'delivery') {
      return res.status(400).json({ message: 'Not a delivery partner account' });
    }

    // Use self permission level to get all relevant info
    const userData = getUserData(user, 'self');
    res.json(userData.deliveryDetails);
  } catch (error) {
    console.error('Status retrieval error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Toggle delivery partner online status
const toggleDeliveryStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;

    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ message: 'Invalid status value. Must be true or false.' });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'delivery') {
      return res.status(400).json({ message: 'Only delivery partners can update online status' });
    }

    // Check if delivery partner is approved
    if (user.deliveryDetails.status !== 'approved') {
      return res.status(403).json({ message: 'You must be an approved delivery partner to go online' });
    }

    // Update online status
    user.deliveryDetails.isOnline = isOnline;
    if (isOnline) {
      user.deliveryDetails.lastActiveTime = new Date();
    }
    await user.save();

    // Get Socket.IO instance and emit update
    const io = req.app.get('io');
    emitDeliveryStatusUpdate(io, user);

    return res.status(200).json({
      message: `Status updated. You are now ${isOnline ? 'online' : 'offline'}.`,
      isOnline
    });
  } catch (error) {
    console.error('Toggle status error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// Get all addresses for a user
const getUserAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a new address
const addUserAddress = async (req, res) => {
  const { name, phone, addressLine1, addressLine2, city, state, zipCode, isDefault } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If the new address is default, unset any existing default
    if (isDefault) {
      user.addresses.forEach(address => {
        address.isDefault = false;
      });
    }

    // If this is the first address, make it default regardless
    const setDefault = isDefault || user.addresses.length === 0;

    // Create new address
    const newAddress = {
      name,
      phone,
      addressLine1,
      addressLine2: addressLine2 || '',
      city,
      state,
      zipCode,
      isDefault: setDefault
    };

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an address
const updateUserAddress = async (req, res) => {
  const { addressId } = req.params;
  const { name, phone, addressLine1, addressLine2, city, state, zipCode, isDefault } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the address to update
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // If making this address default, update others
    if (isDefault && !address.isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }

    // Update address fields
    address.name = name;
    address.phone = phone;
    address.addressLine1 = addressLine1;
    address.addressLine2 = addressLine2 || '';
    address.city = city;
    address.state = state;
    address.zipCode = zipCode;
    address.isDefault = isDefault;

    await user.save();

    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete an address
const deleteUserAddress = async (req, res) => {
  const { addressId } = req.params;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the address to remove
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // Check if we're removing a default address
    const wasDefault = address.isDefault;

    // Remove the address
    address.remove();

    // If we removed the default address and there are other addresses, make one default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Set an address as default
const setDefaultAddress = async (req, res) => {
  const { addressId } = req.params;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the address to set as default
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // Update all addresses to not be default
    user.addresses.forEach(addr => {
      addr.isDefault = false;
    });

    // Set the specified address as default
    address.isDefault = true;

    await user.save();

    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createGuestToken = async (req, res) => {
  try {
    // Generate a unique guest ID
    const guestId = `guest-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    // Create a JWT token with minimal information and appropriate expiration
    const token = jwt.sign(
      {
        id: guestId,
        role: 'customer',
        isGuest: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '48h' }
    );

    // Optional: Log basic analytics without storing user data
    console.log(`Guest token generated: ${guestId} from IP: ${req.ip}`);

    // Return minimal info needed for guest experience
    return res.status(200).json({
      token,
      role: 'customer',
      name: 'Guest User',
      email: 'guest@example.com',
    });
  } catch (error) {
    console.error('Guest token error:', error);
    return res.status(500).json({ message: 'Failed to generate guest token' });
  }
};

// Add these to the exports
module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
  setDefaultAddress,
  createGuestToken,
  getDeliveryPartnerStatus,
  toggleDeliveryStatus,
  getUserPublicProfile,
  getUserData // Export this to use in adminController
};