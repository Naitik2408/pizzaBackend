const Order = require('../models/Order');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');
const Offer = require('../models/Offer');
const { emitAllDeliveryAgentsStatus } = require('../utils/socket');
// Import the getUserData function from userController
const { getUserData } = require('./userController');
// Import the assignDeliveryAgent function from orderController
const { assignDeliveryAgent: assignDeliveryAgentToOrder } = require('./orderController');

// Remove the duplicated function and create a wrapper that uses the orderController implementation
const assignDeliveryAgent = async (req, res) => {
  // Simply call the implementation from orderController
  return assignDeliveryAgentToOrder(req, res);
};

// Fetch dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Basic stats
    const totalUsers = await User.countDocuments({ role: 'customer' });
    const totalOrders = await Order.countDocuments();

    // Calculate total revenue from completed payments
    const totalRevenue = await Order.aggregate([
      { $match: { paymentStatus: 'Completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    // Get order status breakdown
    const deliveredOrdersCount = await Order.countDocuments({ status: 'Delivered' });
    const inProgressOrders = await Order.countDocuments({
      status: { $in: ['Pending', 'Preparing', 'Out for delivery'] }
    });
    const cancelledOrders = await Order.countDocuments({ status: 'Cancelled' });

    // Date calculations for revenue periods
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const previousDay = new Date(today);
    previousDay.setDate(previousDay.getDate() - 1);
    previousDay.setHours(0, 0, 0, 0);

    const previousWeekStart = new Date(oneWeekAgo);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    const previousMonthStart = new Date(oneMonthAgo);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

    // Today's revenue
    const todayRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          paymentStatus: 'Completed'
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' }, orders: { $sum: 1 } } },
    ]);

    // Previous day revenue
    const previousDayRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: previousDay, $lt: today },
          paymentStatus: 'Completed'
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' }, orders: { $sum: 1 } } },
    ]);

    // This week's revenue
    const weekRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: oneWeekAgo },
          paymentStatus: 'Completed'
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    // Previous week's revenue
    const previousWeekRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: previousWeekStart, $lt: oneWeekAgo },
          paymentStatus: 'Completed'
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    // This month's revenue
    const monthRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: oneMonthAgo },
          paymentStatus: 'Completed'
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    // Previous month's revenue
    const previousMonthRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: previousMonthStart, $lt: oneMonthAgo },
          paymentStatus: 'Completed'
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    // Calculate growth percentages
    const todayRevenueValue = todayRevenue[0]?.total || 0;
    const todayOrdersValue = todayRevenue[0]?.orders || 0;
    const previousDayRevenueValue = previousDayRevenue[0]?.total || 0;
    const previousDayOrdersValue = previousDayRevenue[0]?.orders || 0;
    
    const weekRevenueValue = weekRevenue[0]?.total || 0;
    const monthRevenueValue = monthRevenue[0]?.total || 0;
    const previousWeekRevenueValue = previousWeekRevenue[0]?.total || 0;
    const previousMonthRevenueValue = previousMonthRevenue[0]?.total || 0;
    
    const todayGrowth = previousDayRevenueValue > 0
      ? Math.round(((todayRevenueValue - previousDayRevenueValue) / previousDayRevenueValue) * 100)
      : 0;
      
    const todayOrdersGrowth = previousDayOrdersValue > 0
      ? Math.round(((todayOrdersValue - previousDayOrdersValue) / previousDayOrdersValue) * 100)
      : 0;
      
    const weekGrowth = previousWeekRevenueValue > 0
      ? Math.round(((weekRevenueValue - previousWeekRevenueValue) / previousWeekRevenueValue) * 100)
      : 0;
      
    const monthGrowth = previousMonthRevenueValue > 0
      ? Math.round(((monthRevenueValue - previousMonthRevenueValue) / previousMonthRevenueValue) * 100)
      : 0;

    // Get chart data (orders per day for the last week)
    const dailyOrdersData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: oneWeekAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Format chart labels and data for the last 7 days
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const chartLabels = [];
    const chartData = Array(7).fill(0); // Initialize with zeros

    // Go back 7 days and create labels
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      chartLabels.push(daysOfWeek[date.getDay()]);

      // Format date string to match the aggregation result format
      const dateString = date.toISOString().split('T')[0];

      // Find if we have data for this day
      const dayData = dailyOrdersData.find(item => item._id === dateString);
      if (dayData) {
        chartData[6 - i] = dayData.count;
      }
    }

    // Get popular items (most ordered in the last 30 days)
    const popularItems = await Order.aggregate([
      { $match: { createdAt: { $gte: oneMonthAgo } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          orders: { $sum: "$items.quantity" },
          // Calculate last week vs previous week for growth
          lastWeekOrders: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", oneWeekAgo] },
                "$items.quantity",
                0
              ]
            }
          },
          prevWeekOrders: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ["$createdAt", oneWeekAgo] },
                    { $gte: ["$createdAt", previousWeekStart] }
                  ]
                },
                "$items.quantity",
                0
              ]
            }
          }
        }
      },
      { $sort: { orders: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          name: "$_id",
          orders: 1,
          growth: {
            $cond: [
              { $eq: ["$prevWeekOrders", 0] },
              "+0%",
              {
                $concat: [
                  { $cond: [{ $gte: [{ $subtract: ["$lastWeekOrders", "$prevWeekOrders"] }, 0] }, "+", "-"] },
                  {
                    $toString: {
                      $abs: {
                        $round: {
                          $multiply: [
                            {
                              $divide: [
                                { $subtract: ["$lastWeekOrders", "$prevWeekOrders"] },
                                { $cond: [{ $eq: ["$prevWeekOrders", 0] }, 1, "$prevWeekOrders"] }
                              ]
                            },
                            100
                          ]
                        }
                      }
                    }
                  },
                  "%"
                ]
              }
            ]
          }
        }
      }
    ]);

    // Get quick stats
    const activeDeliveryAgents = await User.countDocuments({
      role: 'delivery'
    });

    const pendingDeliveries = await Order.countDocuments({
      status: 'Out for delivery'
    });

    // Calculate average delivery time (in minutes) based on status updates
    const deliveredOrdersWithTimeData = await Order.find({
      status: 'Delivered',
      createdAt: { $gte: oneMonthAgo },
      statusUpdates: {
        $elemMatch: { status: 'Delivered' }
      }
    });

    let totalDeliveryTime = 0;
    let countForAverage = 0;

    deliveredOrdersWithTimeData.forEach(order => {
      // Find the 'Out for delivery' status update
      const outForDeliveryUpdate = order.statusUpdates.find(update => update.status === 'Out for delivery');
      // Find the 'Delivered' status update
      const deliveredUpdate = order.statusUpdates.find(update => update.status === 'Delivered');

      if (outForDeliveryUpdate && deliveredUpdate) {
        const outForDeliveryTime = new Date(outForDeliveryUpdate.time).getTime();
        const deliveredTime = new Date(deliveredUpdate.time).getTime();

        // Calculate time difference in minutes
        const timeDiff = (deliveredTime - outForDeliveryTime) / (1000 * 60);

        // Only count if delivery time is reasonable (less than 3 hours)
        if (timeDiff > 0 && timeDiff < 180) {
          totalDeliveryTime += timeDiff;
          countForAverage++;
        }
      }
    });

    const avgDeliveryTime = countForAverage > 0 ? Math.round(totalDeliveryTime / countForAverage) : 0;

    // For customer rating - we're calculating from item ratings
    const menuItems = await MenuItem.find({}, 'rating ratingCount');
    let totalRating = 0;
    let totalRatingCount = 0;

    menuItems.forEach(item => {
      if (item.rating > 0 && item.ratingCount > 0) {
        totalRating += (item.rating * item.ratingCount);
        totalRatingCount += item.ratingCount;
      }
    });

    const customerRating = totalRatingCount > 0 ? (totalRating / totalRatingCount) : 4.7; // Default if no ratings

    // Assemble and return the complete dashboard data
    res.json({
      totalUsers,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      ordersByStatus: {
        delivered: deliveredOrdersCount,
        inProgress: inProgressOrders,
        cancelled: cancelledOrders,
      },
      revenueData: {
        today: todayRevenueValue,
        week: weekRevenueValue,
        month: monthRevenueValue,
        todayGrowth,
        weekGrowth,
        monthGrowth
      },
      ordersData: {
        today: todayOrdersValue,
        todayGrowth: todayOrdersGrowth
      },
      chartData: {
        labels: chartLabels,
        data: chartData
      },
      popularItems,
      quickStats: {
        activeDeliveryAgents,
        pendingDeliveries,
        avgDeliveryTime,
        customerRating
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      message: 'Error fetching dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Fetch daily dashboard statistics with per-day breakdown
const getDailyDashboardStats = async (req, res) => {
  try {
    const { days = 7 } = req.query; // Default to 7 days, can be customized
    const numDays = parseInt(days);

    // Calculate date range
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (numDays - 1));
    startDate.setHours(0, 0, 0, 0); // Start of the period

    // Get daily revenue data
    const dailyRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: today },
          paymentStatus: 'Completed'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          revenue: { $sum: '$amount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Get daily new customers
    const dailyNewCustomers = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: today },
          role: 'customer'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          newCustomers: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Get daily order status breakdown
    const dailyOrderStatus = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: today }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.date": 1 } }
    ]);

    // Create array of dates for the period
    const dateArray = [];
    for (let i = 0; i < numDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dateArray.push(date.toISOString().split('T')[0]);
    }

    // Format the data for each day
    const dailyStats = dateArray.map(dateStr => {
      const revenueData = dailyRevenue.find(item => item._id === dateStr);
      const customerData = dailyNewCustomers.find(item => item._id === dateStr);
      
      // Get order status for this day
      const dayOrderStatus = dailyOrderStatus.filter(item => item._id.date === dateStr);
      const statusBreakdown = {
        delivered: 0,
        preparing: 0,
        pending: 0,
        cancelled: 0,
        'out for delivery': 0
      };

      dayOrderStatus.forEach(item => {
        const status = item._id.status.toLowerCase();
        if (status === 'delivered') statusBreakdown.delivered = item.count;
        else if (status === 'preparing') statusBreakdown.preparing = item.count;
        else if (status === 'pending') statusBreakdown.pending = item.count;
        else if (status === 'cancelled') statusBreakdown.cancelled = item.count;
        else if (status === 'out for delivery') statusBreakdown['out for delivery'] = item.count;
      });

      return {
        date: dateStr,
        dayName: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: revenueData?.revenue || 0,
        orders: revenueData?.orders || 0,
        newCustomers: customerData?.newCustomers || 0,
        orderStatus: statusBreakdown,
        totalOrders: Object.values(statusBreakdown).reduce((sum, count) => sum + count, 0)
      };
    });

    // Calculate summary statistics
    const totalRevenue = dailyStats.reduce((sum, day) => sum + day.revenue, 0);
    const totalOrders = dailyStats.reduce((sum, day) => sum + day.orders, 0);
    const totalNewCustomers = dailyStats.reduce((sum, day) => sum + day.newCustomers, 0);
    const avgDailyRevenue = totalRevenue / numDays;
    const avgDailyOrders = totalOrders / numDays;

    res.json({
      success: true,
      data: {
        period: {
          days: numDays,
          startDate: startDate.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        },
        summary: {
          totalRevenue,
          totalOrders,
          totalNewCustomers,
          avgDailyRevenue: Math.round(avgDailyRevenue),
          avgDailyOrders: Math.round(avgDailyOrders)
        },
        dailyStats,
        chartData: {
          labels: dailyStats.map(day => day.dayName),
          revenue: dailyStats.map(day => day.revenue),
          orders: dailyStats.map(day => day.orders),
          newCustomers: dailyStats.map(day => day.newCustomers)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching daily dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching daily dashboard statistics',
      error: error.message
    });
  }
};

// Get all delivery agents
const getDeliveryAgents = async (req, res) => {
  try {
    const agents = await User.find({
      role: 'delivery',
      'deliveryDetails.status': 'approved'
    }).select('name email deliveryDetails createdAt');

    // Get Socket.IO instance
    const io = req.app.get('io');

    // Emit current status to all admins
    emitAllDeliveryAgentsStatus(io, agents);

    res.json(agents);
  } catch (error) {
    console.error('Error retrieving delivery agents:', error);
    res.status(500).json({ message: 'Failed to retrieve delivery agents' });
  }
};

// Get all orders assigned to the logged in delivery agent
const getAssignedOrders = async (req, res) => {
  try {
    const userId = req.user._id; // Get the current delivery agent's ID
    console.log(`Finding orders assigned to delivery agent ID: ${userId}`);

    // Find orders assigned to this delivery agent
    // Include all statuses except 'Cancelled' (optionally filter out 'Delivered' too if you want)
    const orders = await Order.find({
      deliveryAgent: userId,
      status: { $nin: ['Cancelled'] }
    }).sort({ date: -1 });

    console.log(`Found ${orders.length} assigned orders for agent ID: ${userId}`);

    // If debugging, log the first order's details
    if (orders.length > 0) {
      console.log('Sample order details:', {
        id: orders[0]._id,
        status: orders[0].status,
        deliveryAgentId: orders[0].deliveryAgent,
        deliveryAgentName: orders[0].deliveryAgentName
      });
    }

    res.json(orders);
  } catch (error) {
    console.error('Error fetching assigned orders:', error);
    res.status(500).json({ message: 'Failed to fetch assigned orders' });
  }
};

// Get all users - updated to use getUserData
const getAllUsers = async (req, res) => {
  try {
    // Exclude password field for security
    const users = await User.find().select('-password');

    // Use the shared function to format each user with admin permissions
    const formattedUsers = users.map(user => getUserData(user, 'admin'));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    // Validate role
    if (!['customer', 'delivery', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    // Check if user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent removing the last admin
    if (user.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot change role: This is the last admin user'
        });
      }
    }

    // Update user role
    user.role = role;
    await user.save();

    // Return updated user using getUserData for consistent formatting
    const updatedUser = await User.findById(id).select('-password');
    res.json(getUserData(updatedUser, 'admin'));
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
};

// Get all offers
const getOffers = async (req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.json(offers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ message: 'Failed to fetch offers' });
  }
};

// Get single offer by ID
const getOfferById = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    res.json(offer);
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({ message: 'Failed to fetch offer' });
  }
};

// Create new offer
const createOffer = async (req, res) => {
  try {
    // Check if code already exists
    const existingOffer = await Offer.findOne({ code: req.body.code.toUpperCase() });
    if (existingOffer) {
      return res.status(400).json({ message: 'An offer with this code already exists' });
    }

    // Create the offer
    const offer = new Offer({
      ...req.body,
      code: req.body.code.toUpperCase(),
    });

    const createdOffer = await offer.save();
    res.status(201).json(createdOffer);
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({
      message: 'Failed to create offer',
      error: error.message
    });
  }
};

// Update offer
const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;

    // If updating code, check if new code already exists elsewhere
    if (req.body.code) {
      const codeExists = await Offer.findOne({
        code: req.body.code.toUpperCase(),
        _id: { $ne: id }
      });

      if (codeExists) {
        return res.status(400).json({ message: 'An offer with this code already exists' });
      }

      // Ensure code is uppercase
      req.body.code = req.body.code.toUpperCase();
    }

    const updatedOffer = await Offer.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedOffer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    res.json(updatedOffer);
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({ message: 'Failed to update offer' });
  }
};

// Delete offer
const deleteOffer = async (req, res) => {
  try {
    const deletedOffer = await Offer.findByIdAndDelete(req.params.id);

    if (!deletedOffer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    res.json({ message: 'Offer removed', success: true });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ message: 'Failed to delete offer' });
  }
};

// Get user by ID - updated to use getUserData
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Use the shared getUserData function with admin permissions
    const userData = getUserData(user, 'admin');
    return res.json(userData);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'Failed to fetch user details' });
  }
};

// Update delivery partner verification status - updated to use getUserData
const updateDeliveryVerification = async (req, res) => {
  try {
    const { status, verificationNotes } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'delivery') {
      return res.status(400).json({ message: 'User is not a delivery partner' });
    }

    // Update verification status
    user.deliveryDetails.status = status;
    user.deliveryDetails.isVerified = status === 'approved';

    // Add verification notes if provided
    if (verificationNotes) {
      user.deliveryDetails.verificationNotes = verificationNotes;
    }

    await user.save();

    // Use the shared function to return consistent user data
    const userData = getUserData(user, 'admin');
    res.json(userData);
  } catch (error) {
    console.error('Error updating verification status:', error);
    res.status(500).json({ message: 'Failed to update verification status' });
  }
};

// Update the module exports to include the unified assignDeliveryAgent function
module.exports = {
  assignDeliveryAgent,
  getDashboardStats,
  getDailyDashboardStats,
  getDeliveryAgents,
  getAssignedOrders,
  getAllUsers,
  updateUserRole,
  getOffers,
  getOfferById,
  createOffer,
  updateOffer,
  deleteOffer,
  updateDeliveryVerification,
  getUserById
};