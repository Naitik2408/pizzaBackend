const Order = require('../models/Order');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const { processOrderPayment } = require('./transactionController');

// Utility function for fetching and formatting orders by query
// This can be used by all controllers that need to retrieve orders
const getOrdersByQuery = async (query, options = {}) => {
  const {
    pagination = false,
    page = 1,
    pageSize = 10,
    sort = { createdAt: -1 },
    formatType = 'default',
    populate = []
  } = options;

  let ordersQuery = Order.find(query);

  // Apply population if needed
  if (populate.length > 0) {
    populate.forEach(field => {
      ordersQuery = ordersQuery.populate(field.path, field.select);
    });
  }

  // Apply sorting
  ordersQuery = ordersQuery.sort(sort);

  // Apply pagination if requested
  if (pagination) {
    const skip = pageSize * (page - 1);
    ordersQuery = ordersQuery.skip(skip).limit(pageSize);
  }

  // Execute the query
  const orders = await ordersQuery;
  
  // Count total documents if pagination is requested
  let count = null;
  if (pagination) {
    count = await Order.countDocuments(query);
  }
  
  // Format orders based on requested format type
  const formattedOrders = orders.map(order => {
    // Base order format shared across all views
    const baseFormat = {
      id: order.orderNumber,
      _id: order._id,
      status: order.status,
      date: order.getFormattedDate(),
      time: order.time,
      createdAt: order.createdAt,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    };
    
    // Customer view format
    if (formatType === 'customer') {
      return {
        ...baseFormat,
        orderNumber: order.orderNumber,
        items: order.items.map(item => ({
          menuItemId: item.menuItemId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          size: item.size,
          foodType: item.foodType,
          image: item.image || '', // Added image field to customer view
          customizations: item.customizations || [],
          addOns: item.addOns || [],
          toppings: item.toppings || [],
          specialInstructions: item.specialInstructions || '',
          hasCustomizations: !!(
            (item.customizations && item.customizations.length) ||
            (item.addOns && item.addOns.length) ||
            (item.toppings && item.toppings.length) ||
            item.specialInstructions
          ),
          totalPrice: (item.totalItemPrice || item.price) * item.quantity
        })),
        fullAddress: order.fullAddress,
        address: order.address,
        deliveryAgent: order.deliveryAgent ? {
          _id: order.deliveryAgent,
          name: order.deliveryAgentName,
          phone: '' // This would need to come from populating the delivery agent
        } : null,
        statusUpdates: order.statusUpdates.map(update => ({
          status: update.status,
          time: update.time,
          note: update.note
        })),
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        notes: order.notes,
        subTotal: order.subTotal,
        tax: order.tax,
        deliveryFee: order.deliveryFee,
        discounts: order.discounts
      };
    }
    
    // Delivery agent view format
    else if (formatType === 'delivery') {
      return {
        ...baseFormat,
        customer: {
          name: order.customerName,
          contact: order.customerPhone
        },
        address: order.fullAddress,
        fullAddress: order.fullAddress,
        customerPhone: order.customerPhone,
        items: order.items.map(item => ({
          name: item.name || "Unnamed Item",
          quantity: item.quantity || 1,
          price: item.price || 0,
          size: item.size || "Regular",
          foodType: item.foodType || "Not Applicable",
          image: item.image || '' // Added image for delivery agents too
        })),
        totalItems: order.totalItemsCount || order.items.reduce((sum, item) => sum + (item.quantity || 1), 0),
        notes: order.notes || '',
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        // Add fields used in deliveryController
        totalPrice: order.amount,
        deliveryAddress: {
          street: order.address?.street || '',
          city: order.address?.city || '',
          country: order.address?.country || 'India',
          notes: order.address?.notes || order.notes || ''
        },
        pickupLocation: {
          name: order.restaurant?.name || 'Restaurant',
          address: order.restaurant?.address || 'Restaurant Address'
        },
        distance: order.distance || '2.5 km',
        statusUpdates: order.statusUpdates || []
      };
    }
    
    // Delivery agent completed orders format
    else if (formatType === 'deliveryCompleted') {
      // Calculate commission (20% of order amount)
      const commission = (order.amount * 0.2).toFixed(2);
      
      return {
        id: order.orderNumber || order._id,
        _id: order._id,
        date: order.createdAt.toISOString().split('T')[0],
        time: order.createdAt.toTimeString().split(' ')[0].slice(0, 5),
        customerName: order.customerName,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total: order.amount,
        commission: parseFloat(commission),
        deliveryDuration: order.deliveryDuration || '25 min',
        rating: order.rating || 5,
        feedback: order.feedback || '',
        customerImage: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=100'
      };
    }
    
    // Admin view format
    else if (formatType === 'admin') {
      return {
        ...baseFormat,
        customer: order.customerName,
        deliveryAgent: order.deliveryAgentName,
        items: order.items.map(item => ({
          name: item.name || "Unnamed Item",
          quantity: item.quantity || 1,
          price: item.price || 0,
          size: item.size || "Regular",
          foodType: item.foodType || "Not Applicable",
          image: item.image || '', // Added image field
          customizations: item.customizations || [],
          addOns: item.addOns || [],
          toppings: item.toppings || [],
          hasCustomizations: !!(
            (item.customizations && item.customizations.length) ||
            (item.addOns && item.addOns.length) ||
            (item.toppings && item.toppings.length) ||
            item.specialInstructions
          ),
          // Count total customizations
          customizationCount:
            (item.customizations ? item.customizations.length : 0) +
            (item.addOns ? item.addOns.length : 0) +
            (item.toppings ? item.toppings.length : 0) +
            (item.specialInstructions ? 1 : 0)
        })),
        totalItemsCount: order.totalItemsCount || order.items.reduce((sum, item) => sum + (item.quantity || 1), 0),
        address: order.fullAddress,
        customerPhone: order.customerPhone,
        notes: order.notes || ''
      };
    }
    
    // Admin detail view format
    else if (formatType === 'adminDetail') {
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        status: order.status,
        date: order.date,
        time: order.time || new Date(order.date).toLocaleTimeString(),
        amount: order.amount,
        items: order.items.map(item => ({
          name: item.name || "Unnamed Item",
          quantity: item.quantity || 1,
          price: item.price || 0,
          basePrice: item.basePrice || item.price || 0,
          size: item.size || "Regular",
          foodType: item.foodType || "Not Applicable",
          image: item.image || '', // Added image field
          customizations: Array.isArray(item.customizations) ? item.customizations : [],
          addOns: Array.isArray(item.addOns) ? item.addOns : [],
          toppings: Array.isArray(item.toppings) ? item.toppings : [],
          specialInstructions: item.specialInstructions || "",
          totalItemPrice: item.totalItemPrice || item.price || 0,
          menuItemId: item.menuItemId || "",
          // Calculate customization total
          customizationTotal: [
            ...(item.customizations || []),
            ...(item.addOns || []),
            ...(item.toppings || [])
          ].reduce((sum, customization) => sum + (customization.price || 0), 0)
        })),
        fullAddress: order.fullAddress,
        paymentMethod: order.paymentMethod || "Not specified",
        paymentStatus: order.paymentStatus || "Not specified",
        customerPhone: order.customerPhone || "Not available",
        notes: order.notes || "",
        deliveryAgentName: order.deliveryAgentName,
        statusUpdates: order.statusUpdates || [],
        subTotal: order.subTotal,
        tax: order.tax,
        deliveryFee: order.deliveryFee,
        discounts: order.discounts
      };
    }
    
    // Default format (minimal)
    else {
      return {
        ...baseFormat,
        customer: order.customerName,
        deliveryAgent: order.deliveryAgentName,
        totalItemsCount: order.totalItemsCount || order.items.reduce((sum, item) => sum + (item.quantity || 1), 0),
        address: order.fullAddress
      };
    }
  });
  
  // Return formatted result
  if (pagination) {
    return {
      orders: formattedOrders,
      page,
      pages: Math.ceil(count / pageSize),
      total: count
    };
  }
  
  return formattedOrders;
};

// @desc    Place a new order
// @route   POST /api/orders
// @access  Private
const placeOrder = asyncHandler(async (req, res) => {
  const {
    items,
    amount,
    address,
    paymentMethod,
    paymentDetails,
    notes,
    subTotal,
    tax,
    deliveryFee,
    discounts
  } = req.body;

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error('No order items');
  }

  // Get user details for customer info
  const user = await User.findById(req.user._id);

  // Process items to ensure they have all required fields and calculate totals
  const processedItems = items.map(item => {
    // Extract the base price (before customizations)
    const basePrice = item.basePrice || item.price;
    let totalItemPrice = basePrice;

    // Process customizations into a standardized format
    let processedCustomizations = [];
    if (item.customizations) {
      // If customizations is already an array of objects
      if (Array.isArray(item.customizations)) {
        processedCustomizations = item.customizations.map(custom => ({
          name: custom.name || 'Unknown',
          option: custom.option || '',
          price: Number(custom.price || 0)
        }));

        // Add prices from customizations
        totalItemPrice += processedCustomizations.reduce((sum, custom) =>
          sum + (custom.price || 0), 0);
      }
      // If customizations is an object (legacy format)
      else if (typeof item.customizations === 'object') {
        processedCustomizations = Object.entries(item.customizations).map(([name, option]) => {
          // Handle string options and object options
          if (typeof option === 'string') {
            return { name, option, price: 0 };
          } else {
            const price = Number(option.price || 0);
            totalItemPrice += price;
            return {
              name,
              option: option.name || option.option || '',
              price
            };
          }
        });
      }
    }

    // Process add-ons into a standardized format
    let processedAddOns = [];
    if (item.addOns) {
      // If add-ons is already an array
      if (Array.isArray(item.addOns)) {
        processedAddOns = item.addOns.map(addon => ({
          name: addon.name || 'Unknown',
          option: addon.option || addon.name || '',
          price: Number(addon.price || 0)
        }));

        // Add prices from add-ons
        totalItemPrice += processedAddOns.reduce((sum, addon) =>
          sum + (addon.price || 0), 0);
      }
      // If add-ons is an object (possible legacy format)
      else if (typeof item.addOns === 'object') {
        processedAddOns = Object.entries(item.addOns).map(([id, addon]) => {
          const addonName = typeof addon === 'string' ? addon : addon.name;
          const addonPrice = typeof addon === 'string' ? 0 : Number(addon.price || 0);
          totalItemPrice += addonPrice;
          return {
            name: addonName,
            option: addonName,
            price: addonPrice
          };
        });
      }
    }

    // Process toppings if they exist
    let processedToppings = [];
    if (item.toppings) {
      if (Array.isArray(item.toppings)) {
        processedToppings = item.toppings.map(topping => ({
          name: topping.name || 'Unknown',
          option: topping.option || topping.name || '',
          price: Number(topping.price || 0)
        }));
        
        // Add prices from toppings
        totalItemPrice += processedToppings.reduce((sum, topping) => 
          sum + (topping.price || 0), 0);
      }
    }

    // Log the processed customizations for debugging
    console.log(`[${item.name}] Processed customizations:`, JSON.stringify(processedCustomizations));
    console.log(`[${item.name}] Processed add-ons:`, JSON.stringify(processedAddOns));
    console.log(`[${item.name}] Processed toppings:`, JSON.stringify(processedToppings));

    // Return the processed item with correct customization data
    return {
      menuItemId: item.id || item.menuItemId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      size: item.size || 'Medium',
      foodType: item.foodType || 'Not Applicable',
      image: item.image || '', // Store the image URL in the order
      basePrice: basePrice,
      totalItemPrice: totalItemPrice,
      customizations: processedCustomizations,
      addOns: processedAddOns,
      toppings: processedToppings,
      specialInstructions: item.specialInstructions || ''
    };
  });

  // Log the processed items for debugging
  console.log('Processed order items:', JSON.stringify(processedItems, null, 2));

  const order = new Order({
    customer: req.user._id,
    customerName: user.name,
    items: processedItems,
    amount,
    address,
    fullAddress: `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`,
    paymentMethod,
    paymentDetails,
    customerPhone: user.phone || req.body.customerPhone,
    notes,
    deliveryAgentName: 'Unassigned',
    subTotal: subTotal || processedItems.reduce((sum, item) => sum + (item.totalItemPrice * item.quantity), 0),
    tax,
    deliveryFee,
    discounts
  });

  const createdOrder = await order.save();
  res.status(201).json(createdOrder);
});

// @desc    Get logged in user's orders
// @route   GET /api/orders/my-orders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  try {
    const query = { customer: req.user._id };
    const options = {
      formatType: 'customer',
      sort: { createdAt: -1 }
    };
    
    const formattedOrders = await getOrdersByQuery(query, options);
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// @desc    Get order by ID for logged in user
// @route   GET /api/orders/my-orders/:id
// @access  Private
const getMyOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Make sure the order belongs to the logged in user
  if (order.customer.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Format the order with detailed customization info
  const formattedOrder = {
    ...order.toObject(),
    items: order.items.map(item => {
      return {
        ...item,
        customizations: item.customizations || [],
        addOns: item.addOns || [],
        toppings: item.toppings || [],
        totalPrice: (item.totalItemPrice || item.price) * item.quantity,
        hasCustomizations: !!(
          (item.customizations && item.customizations.length) ||
          (item.addOns && item.addOns.length) ||
          (item.toppings && item.toppings.length) ||
          item.specialInstructions
        ),
        // Ensure image is included
        image: item.image || ''
      };
    })
  };

  res.json(formattedOrder);
});

// @desc    Cancel order by customer
// @route   PUT /api/orders/my-orders/:id/cancel
// @access  Private
const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Make sure the order belongs to the logged in user
  if (order.customer.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Check if order can be cancelled (only pending or preparing orders)
  if (order.status !== 'Pending' && order.status !== 'Preparing') {
    res.status(400);
    throw new Error('Order cannot be cancelled at this stage');
  }

  // Update status and add to status history
  order.status = 'Cancelled';
  order.statusUpdates.push({
    status: 'Cancelled',
    time: Date.now(),
    note: 'Cancelled by customer'
  });

  const updatedOrder = await order.save();

  res.json({
    success: true,
    order: {
      id: updatedOrder.orderNumber,
      _id: updatedOrder._id,
      status: updatedOrder.status
    }
  });
});

// @desc    Rate an order
// @route   POST /api/orders/my-orders/:id/rate
// @access  Private
const rateOrder = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  
  if (!rating || rating < 1 || rating > 5) {
    res.status(400);
    throw new Error('Rating must be between 1 and 5');
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Make sure the order belongs to the logged in user
  if (order.customer.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Check if order is delivered
  if (order.status !== 'Delivered') {
    res.status(400);
    throw new Error('Only delivered orders can be rated');
  }

  // Add rating to order
  order.rating = rating;
  order.reviewComment = comment || '';
  
  // Add note to status updates
  order.statusUpdates.push({
    status: order.status,
    time: Date.now(),
    note: `Order rated ${rating}/5 stars by customer`
  });

  const updatedOrder = await order.save();

  res.json({
    success: true,
    rating: updatedOrder.rating
  });
});

// @desc    Get all orders (admin)
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = asyncHandler(async (req, res) => {
  try {
    const pageSize = 10;
    const page = Number(req.query.page) || 1;
    
    const query = {};
    const options = {
      pagination: true,
      page,
      pageSize,
      formatType: 'admin',
      sort: { createdAt: -1 }
    };
    
    const result = await getOrdersByQuery(query, options);
    res.json(result);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// @desc    Get order by ID (admin)
// @route   GET /api/orders/:id
// @access  Private/Admin
const getOrderById = asyncHandler(async (req, res) => {
  try {
    const populate = [
      { path: 'customer', select: 'name email' },
      { path: 'deliveryAgent', select: 'name' }
    ];
    
    const options = {
      formatType: 'adminDetail',
      populate
    };
    
    const orders = await getOrdersByQuery({ _id: req.params.id }, options);
    
    if (!orders || orders.length === 0) {
      res.status(404);
      throw new Error('Order not found');
    }
    
    res.json(orders[0]);
  } catch (error) {
    console.error('Error fetching order details:', error);
    if (error.message === 'Order not found') {
      res.status(404).json({ message: 'Order not found' });
    } else {
      res.status(500).json({ message: 'Failed to fetch order details' });
    }
  }
});

// @desc    Update order status - UNIFIED FUNCTION
// @route   PUT /api/orders/:id/status
// @access  Private (with role-based permissions)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const orderId = req.params.id;
  const { status, note } = req.body;
  const userRole = req.user.role;
  const userId = req.user._id;

  try {
    // Find the order
    const order = await Order.findById(orderId);
    
    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    // Check permissions based on role
    if (userRole === 'customer') {
      // Customers can only cancel their own orders
      if (status !== 'Cancelled') {
        res.status(403);
        throw new Error('Customers can only cancel orders');
      }
      
      if (order.customer.toString() !== userId.toString()) {
        res.status(403);
        throw new Error('Not authorized to update this order');
      }
      
      // Check if order is in a cancellable state
      if (order.status !== 'Pending' && order.status !== 'Preparing') {
        res.status(400);
        throw new Error('Order cannot be cancelled at this stage');
      }
    } 
    else if (userRole === 'delivery') {
      // Delivery agents can only update orders assigned to them
      if (order.deliveryAgent?.toString() !== userId.toString()) {
        res.status(403);
        throw new Error('Not authorized - this order is not assigned to you');
      }
      
      // Delivery agents can only update to specific statuses
      const allowedStatuses = ['Out for delivery', 'Delivered'];
      if (!allowedStatuses.includes(status)) {
        res.status(400);
        throw new Error('Delivery agents can only update to Out for delivery or Delivered status');
      }
      
      // If setting to Delivered, check if payment is completed for COD orders
      if (status === 'Delivered' && order.paymentMethod === 'Cash on Delivery' && order.paymentStatus !== 'Completed') {
        res.status(400);
        throw new Error('Payment must be completed before marking the order as delivered');
      }
    }
    // Admin and restaurant roles can update to any status

    // Update the order status
    order.status = status;

    // Add status update to history with appropriate note
    const statusNote = note || `Status updated to ${status} by ${userRole}`;
    order.statusUpdates.push({
      status,
      time: Date.now(),
      note: statusNote
    });

    // Special handling for specific statuses
    if (status === 'Out for delivery' && !order.estimatedDeliveryTime) {
      // Set estimated delivery time to 30 minutes from now when going out for delivery
      const estimatedTime = new Date();
      estimatedTime.setMinutes(estimatedTime.getMinutes() + 30);
      order.estimatedDeliveryTime = estimatedTime;
    }

    // Save the updated order
    const updatedOrder = await order.save();

    // Log the status change
    console.log(`Order ${orderId} status updated to ${status} by ${userRole} ${req.user.name}`);

    // Return appropriate success response
    res.json({
      success: true,
      order: {
        id: updatedOrder.orderNumber,
        _id: updatedOrder._id,
        status: updatedOrder.status,
        estimatedDeliveryTime: updatedOrder.estimatedDeliveryTime,
        statusUpdates: updatedOrder.statusUpdates
      }
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    
    // Return a specific error code and message
    if (error.message.includes('Not authorized') || error.message.includes('can only')) {
      res.status(403).json({ message: error.message });
    } else if (error.message.includes('Order not found')) {
      res.status(404).json({ message: 'Order not found' });
    } else if (error.message.includes('cannot be cancelled') || error.message.includes('must be completed')) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Failed to update order status' });
    }
  }
});

// @desc    Assign delivery agent to order
// @route   PUT /api/orders/:id/delivery-agent
// @access  Private/Admin
const assignDeliveryAgent = asyncHandler(async (req, res) => {
  const { deliveryAgentId, deliveryAgentName } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // If setting to unassigned
  if (deliveryAgentName === 'Unassigned') {
    order.deliveryAgent = null;
    order.deliveryAgentName = 'Unassigned';

    // Add note to status updates
    order.statusUpdates.push({
      status: order.status,
      time: Date.now(),
      note: 'Delivery agent unassigned'
    });
  } else {
    // Verify the delivery agent exists
    const agent = await User.findById(deliveryAgentId);

    if (!agent) {
      res.status(400);
      throw new Error('Delivery agent not found');
    }

    // Check if the agent is available (isOnline)
    if (agent.role === 'delivery' && agent.deliveryDetails) {
      if (!agent.deliveryDetails.isOnline) {
        res.status(400);
        throw new Error('Delivery agent is currently offline');
      }

      if (agent.deliveryDetails.status !== 'approved') {
        res.status(400);
        throw new Error('Delivery agent is not approved');
      }
    }

    order.deliveryAgent = deliveryAgentId;
    order.deliveryAgentName = deliveryAgentName || agent.name;

    // Add note to status updates
    order.statusUpdates.push({
      status: order.status,
      time: Date.now(),
      note: `Assigned to ${order.deliveryAgentName}`
    });
  }

  const updatedOrder = await order.save();

  res.json({
    success: true,
    order: {
      id: updatedOrder.orderNumber,
      _id: updatedOrder._id,
      deliveryAgent: updatedOrder.deliveryAgentName
    }
  });
});

// @desc    Update order payment status - this is now a wrapper for the central function
// @route   PUT /api/orders/:id/payment
// @access  Private (with role-based permissions)
const updateOrderPayment = asyncHandler(async (req, res) => {
  try {
    const orderId = req.params.id;
    const paymentData = {
      paymentStatus: req.body.paymentStatus,
      paymentMethod: req.body.paymentMethod,
      paymentDetails: req.body.paymentDetails,
      status: req.body.status,
      note: req.body.note
    };
    
    // We don't create a transaction record by default in the order route
    const createTransactionRecord = false;
    
    // Call the central payment processing function in transactionController
    const result = await processOrderPayment(orderId, paymentData, req.user, createTransactionRecord);
    
    res.json(result);
  } catch (error) {
    console.error('Error updating payment status:', error);
    
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to update payment status';
    
    res.status(statusCode).json({ message });
  }
});

// @desc    Filter orders
// @route   GET /api/orders/filter
// @access  Private/Admin
const filterOrders = asyncHandler(async (req, res) => {
  try {
    const { status, date, deliveryAgent } = req.query;
    const filterOptions = {};
    
    if (status) {
      filterOptions.status = status;
    }
    
    if (date) {
      // Convert date string to Date object range for the whole day
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      filterOptions.date = { $gte: startDate, $lte: endDate };
    }
    
    if (deliveryAgent) {
      if (deliveryAgent === 'Unassigned') {
        filterOptions.deliveryAgentName = 'Unassigned';
      } else {
        filterOptions.deliveryAgentName = deliveryAgent;
      }
    }
    
    const pageSize = 10;
    const page = Number(req.query.page) || 1;
    
    const options = {
      pagination: true,
      page,
      pageSize,
      formatType: 'admin',
      sort: { createdAt: -1 }
    };
    
    const result = await getOrdersByQuery(filterOptions, options);
    res.json(result);
  } catch (error) {
    console.error('Error filtering orders:', error);
    res.status(500).json({ message: 'Failed to filter orders' });
  }
});

// @desc    Search orders
// @route   GET /api/orders/search
// @access  Private/Admin
const searchOrders = asyncHandler(async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Search by order number, customer name, or item name
    const searchQuery = {
      $or: [
        { orderNumber: { $regex: query, $options: 'i' } },
        { customerName: { $regex: query, $options: 'i' } },
        { 'items.name': { $regex: query, $options: 'i' } }
      ]
    };
    
    const options = {
      pagination: false,
      formatType: 'admin',
      sort: { createdAt: -1 },
      limit: 20
    };
    
    const formattedOrders = await getOrdersByQuery(searchQuery, options);
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error searching orders:', error);
    res.status(500).json({ message: 'Failed to search orders' });
  }
});

// CENTRALIZED DELIVERY FUNCTIONS
// These functions consolidate functionality from deliveryController.js

// @desc    Get orders assigned to the delivery agent
// @route   GET /api/orders/delivery/assigned
// @access  Private/Delivery
const getAssignedDeliveryOrders = asyncHandler(async (req, res) => {
  try {
    const query = {
      deliveryAgent: req.user._id,
      status: { $nin: ['Delivered', 'Cancelled'] }
    };
    
    const options = {
      formatType: 'delivery',
      sort: { createdAt: -1 }
    };
    
    const formattedOrders = await getOrdersByQuery(query, options);
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching assigned delivery orders:', error);
    res.status(500).json({ message: 'Failed to fetch assigned orders' });
  }
});

// @desc    Get completed orders for delivery agent
// @route   GET /api/orders/delivery/completed
// @access  Private/Delivery
const getCompletedDeliveryOrders = asyncHandler(async (req, res) => {
  try {
    // Get query parameters for filtering
    const { startDate, endDate } = req.query;
    let dateFilter = {};

    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }

    const query = {
      deliveryAgent: req.user._id,
      status: 'Delivered',
      ...dateFilter
    };
    
    const options = {
      formatType: 'deliveryCompleted',
      sort: { createdAt: -1 }
    };
    
    const formattedOrders = await getOrdersByQuery(query, options);
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching completed delivery orders:', error);
    res.status(500).json({ message: 'Failed to fetch completed orders' });
  }
});

// @desc    Get delivery agent statistics
// @route   GET /api/orders/delivery/stats
// @access  Private/Delivery
const getDeliveryStats = asyncHandler(async (req, res) => {
  try {
    // Get query parameters for date range
    const { period } = req.query; // 'today', 'week', 'month'

    let dateFilter = {};
    const now = new Date();

    if (period === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'week') {
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { $gte: lastWeek } };
    } else if (period === 'month') {
      const lastMonth = new Date(now);
      lastMonth.setMonth(now.getMonth() - 1);
      dateFilter = { createdAt: { $gte: lastMonth } };
    }

    // Total completed deliveries
    const totalDeliveries = await Order.countDocuments({
      deliveryAgent: req.user._id,
      status: 'Delivered',
      ...dateFilter
    });

    // Total earnings (commission)
    const earningsData = await Order.find({
      deliveryAgent: req.user._id,
      status: 'Delivered',
      ...dateFilter
    });

    let totalEarnings = 0;
    earningsData.forEach(order => {
      totalEarnings += (order.amount * 0.2); // 20% commission
    });

    // Average delivery time
    const deliveriesWithTime = earningsData.filter(order => order.deliveryDuration);
    let avgDeliveryTime = 0;

    if (deliveriesWithTime.length > 0) {
      const totalMinutes = deliveriesWithTime.reduce((acc, order) => {
        const minutes = parseInt(order.deliveryDuration);
        return isNaN(minutes) ? acc : acc + minutes;
      }, 0);
      avgDeliveryTime = Math.round(totalMinutes / deliveriesWithTime.length);
    }

    // Customer satisfaction (average rating)
    const ratingsData = earningsData.filter(order => order.rating);
    let avgRating = 0;

    if (ratingsData.length > 0) {
      const totalRating = ratingsData.reduce((acc, order) => acc + order.rating, 0);
      avgRating = (totalRating / ratingsData.length).toFixed(1);
    }

    // Current active deliveries
    const activeDeliveries = await Order.countDocuments({
      deliveryAgent: req.user._id,
      status: { $in: ['Pending', 'Preparing', 'Out for delivery'] }
    });

    res.json({
      totalDeliveries,
      totalEarnings: totalEarnings.toFixed(2),
      avgDeliveryTime: `${avgDeliveryTime} min`,
      avgRating,
      activeDeliveries
    });
  } catch (error) {
    console.error('Error fetching delivery stats:', error);
    res.status(500).json({ message: 'Failed to fetch delivery statistics' });
  }
});

// @desc    Get delivery dashboard summary
// @route   GET /api/orders/delivery/dashboard
// @access  Private/Delivery
const getDeliveryDashboard = asyncHandler(async (req, res) => {
  try {
    // Active orders
    const activeOrders = await Order.find({
      deliveryAgent: req.user._id,
      status: { $in: ['Pending', 'Preparing', 'Out for delivery'] }
    }).sort({ createdAt: -1 });

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayDeliveries = await Order.countDocuments({
      deliveryAgent: req.user._id,
      status: 'Delivered',
      createdAt: { $gte: today }
    });

    // Today's earnings
    const todayOrders = await Order.find({
      deliveryAgent: req.user._id,
      status: 'Delivered',
      createdAt: { $gte: today }
    });

    let todayEarnings = 0;
    todayOrders.forEach(order => {
      todayEarnings += (order.amount * 0.2); // 20% commission
    });

    // Recent completed deliveries (last 5)
    const recentDeliveries = await Order.find({
      deliveryAgent: req.user._id,
      status: 'Delivered'
    }).sort({ createdAt: -1 }).limit(5);

    const formattedActive = activeOrders.map(order => ({
      id: order.orderNumber || order._id,
      _id: order._id,
      customer: order.customerName,
      address: order.fullAddress || `${order.address?.street || ''}, ${order.address?.city || ''}`,
      amount: order.amount,
      status: order.status,
      time: order.createdAt.toTimeString().split(' ')[0].slice(0, 5)
    }));

    const formattedRecent = recentDeliveries.map(order => ({
      id: order.orderNumber || order._id,
      _id: order._id, 
      customer: order.customerName,
      date: order.createdAt.toISOString().split('T')[0],
      amount: order.amount,
      commission: (order.amount * 0.2).toFixed(2),
      rating: order.rating || 5
    }));

    res.json({
      activeCount: activeOrders.length,
      todayDeliveries,
      todayEarnings: todayEarnings.toFixed(2),
      activeOrders: formattedActive,
      recentDeliveries: formattedRecent
    });
  } catch (error) {
    console.error('Error fetching delivery dashboard:', error);
    res.status(500).json({ message: 'Failed to fetch delivery dashboard' });
  }
});

// @desc    Get order details for delivery agent
// @route   GET /api/orders/delivery/details/:id
// @access  Private/Delivery
const getDeliveryOrderDetails = asyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    // Check if order belongs to the delivery agent
    if (order.deliveryAgent && order.deliveryAgent.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized to access this order');
    }

    // Use getOrdersByQuery for consistent formatting
    const orders = await getOrdersByQuery(
      { _id: order._id },
      { formatType: 'delivery' }
    );
    
    if (orders && orders.length > 0) {
      res.json(orders[0]);
    } else {
      res.status(404).json({ message: 'Order not found after formatting' });
    }
  } catch (error) {
    console.error('Error fetching delivery order details:', error);
    if (error.message.includes('Not authorized')) {
      res.status(403).json({ message: error.message });
    } else if (error.message.includes('Order not found')) {
      res.status(404).json({ message: 'Order not found' });
    } else {
      res.status(500).json({ message: 'Failed to fetch order details' });
    }
  }
});

// @desc    Get orders with pending COD payments assigned to the delivery agent
// @route   GET /api/orders/delivery/pending-payments
// @access  Private/Delivery
const getOrdersPendingPayment = asyncHandler(async (req, res) => {
  try {
    const query = {
      deliveryAgent: req.user._id,
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'Pending',
      status: { $in: ['Out for delivery', 'Delivered'] }
    };
    
    const orders = await Order.find(query).sort({ createdAt: -1 });

    // Format orders for frontend
    const formattedOrders = orders.map(order => ({
      id: order.orderNumber,
      _id: order._id,
      amount: order.amount,
      customerName: order.customerName,
      date: order.createdAt.toISOString().split('T')[0],
      time: order.time || order.createdAt.toTimeString().split(' ')[0].slice(0, 5)
    }));

    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching pending payment orders:', error);
    res.status(500).json({ message: 'Failed to fetch pending payment orders' });
  }
});

// @desc    Get all orders assigned to delivery agent (legacy function name)
// @route   GET /api/orders/delivery
// @access  Private/Delivery
const getDeliveryOrders = asyncHandler(async (req, res) => {
  return getAssignedDeliveryOrders(req, res);
});

// @desc    Get assigned orders for specific agent (for admin view) - legacy name
// @route   GET /api/orders/assigned/:agentId
// @access  Private/Admin
const getAssignedOrders = asyncHandler(async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Validate agent exists
    const agent = await User.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: 'Delivery agent not found' });
    }
    
    const query = {
      deliveryAgent: agentId,
      status: { $in: ['Preparing', 'Out for delivery'] }
    };
    
    const options = {
      formatType: 'admin',
      sort: { createdAt: -1 }
    };
    
    const formattedOrders = await getOrdersByQuery(query, options);
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching assigned orders:', error);
    res.status(500).json({ message: 'Failed to fetch assigned orders' });
  }
});

// @desc    Get delivery order by ID (legacy function name)
// @route   GET /api/orders/delivery/:id
// @access  Private/Delivery
const getDeliveryOrderById = asyncHandler(async (req, res) => {
  return getDeliveryOrderDetails(req, res);
});

// Export all functions - organized by feature area
module.exports = {
  // Order query utility
  getOrdersByQuery,
  
  // Customer-facing order functions
  placeOrder,
  getMyOrders,
  getMyOrderById,
  cancelMyOrder,
  rateOrder,
  
  // Admin order management
  getOrders,
  getOrderById,
  filterOrders,
  searchOrders,
  
  // Unified status and payment functions
  updateOrderStatus,
  updateOrderPayment,  // Now just a wrapper around processOrderPayment
  assignDeliveryAgent,
  
  // Delivery agent functions - consolidated from deliveryController
  getDeliveryOrders,
  getDeliveryOrderById,
  getAssignedOrders,
  getAssignedDeliveryOrders,
  getCompletedDeliveryOrders,
  getDeliveryOrderDetails,
  getDeliveryStats,
  getDeliveryDashboard,
  getOrdersPendingPayment
};