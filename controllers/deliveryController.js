const Order = require('../models/Order');
const asyncHandler = require('express-async-handler');

// @desc    Get orders assigned to the delivery agent
// @route   GET /api/delivery/orders/assigned
// @access  Private/Delivery
// const getAssignedOrders = asyncHandler(async (req, res) => {
//     const orders = await Order.find({
//         deliveryAgent: req.user._id,
//         status: { $nin: ['Delivered', 'Cancelled'] } // Changed from 'DELIVERED', 'CANCELLED' to match model
//     }).sort({ createdAt: -1 });

//     // Format orders for frontend
//     const formattedOrders = orders.map(order => ({
//         id: order.orderNumber || order._id,
//         _id: order._id,
//         customer: {
//             name: order.customerName,
//             contact: order.customerPhone
//         },
//         items: order.items.map(item => ({
//             name: item.name,
//             quantity: item.quantity,
//             price: item.price
//         })),
//         totalPrice: order.amount,
//         deliveryAddress: {
//             street: order.address.street,
//             city: order.address.city,
//             country: order.address.country || 'Poland',
//             notes: order.address.notes || order.notes
//         },
//         pickupLocation: {
//             name: order.restaurant?.name || 'Restaurant',
//             address: order.restaurant?.address || 'Restaurant Address'
//         },
//         estimatedDeliveryTime: order.estimatedDeliveryTime || '20-30 min',
//         status: order.status,
//         distance: order.distance || '2.5 km',
//         date: order.createdAt
//     }));

//     res.json(formattedOrders);
// });

// @desc    Get completed orders for delivery agent
// @route   GET /api/delivery/orders/completed
// @access  Private/Delivery
const getCompletedOrders = asyncHandler(async (req, res) => {
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

    const orders = await Order.find({
        deliveryAgent: req.user._id,
        status: 'Delivered',
        ...dateFilter
    }).sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => {
        // Calculate commission (20% of order amount)
        const commission = (order.amount * 0.2).toFixed(2);

        return {
            id: order.orderNumber || order._id,
            _id: order._id, // Include MongoDB ID for reference
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
    });

    res.json(formattedOrders);
});

// @desc    Get order details
// @route   GET /api/delivery/orders/:id
// @access  Private/Delivery
const getOrderDetails = asyncHandler(async (req, res) => {
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

    // Format order for frontend
    const formattedOrder = {
        id: order.orderNumber || order._id,
        customer: {
            name: order.customerName,
            contact: order.customerPhone
        },
        items: order.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
        })),
        totalPrice: order.amount,
        deliveryAddress: {
            street: order.address.street,
            city: order.address.city,
            country: order.address.country || 'Poland',
            notes: order.address.notes || order.notes
        },
        pickupLocation: {
            name: order.restaurant?.name || 'Restaurant',
            address: order.restaurant?.address || 'Restaurant Address'
        },
        estimatedDeliveryTime: order.estimatedDeliveryTime || '20-30 min',
        status: order.status,
        distance: order.distance || '2.5 km',
        date: order.createdAt,
        statusUpdates: order.statusUpdates || []
    };

    res.json(formattedOrder);
});

// @desc    Update order status
// @route   PUT /api/delivery/orders/:id/status
// @access  Private/Delivery
// const updateOrderStatus = async (req, res) => {
//     const { id } = req.params;
//     const { status, note } = req.body;

//     try {
//         // Check if the order exists
//         const order = await Order.findById(id);
//         if (!order) {
//             return res.status(404).json({ message: 'Order not found' });
//         }

//         // Check if this order is assigned to the current delivery agent
//         if (!order.deliveryAgent || order.deliveryAgent.toString() !== req.user._id.toString()) {
//             return res.status(403).json({ message: 'Not authorized to update this order' });
//         }

//         // Validate the status is one of the allowed values
//         const validStatuses = ['Preparing', 'Out for delivery', 'Delivered'];
//         if (!validStatuses.includes(status)) {
//             return res.status(400).json({ message: 'Invalid status value' });
//         }

//         // Update the order status
//         order.status = status;

//         // Add status update entry
//         order.statusUpdates.push({
//             status,
//             time: new Date(),
//             note: note || `Status updated to ${status} by delivery agent`
//         });

//         const updatedOrder = await order.save();

//         console.log(`Order ${id} status updated to ${status} by delivery agent ${req.user.name}`);

//         res.json({
//             success: true,
//             message: 'Order status updated successfully',
//             order: {
//                 _id: updatedOrder._id,
//                 status: updatedOrder.status,
//                 statusUpdates: updatedOrder.statusUpdates
//             }
//         });
//     } catch (error) {
//         console.error('Error updating order status:', error);
//         res.status(500).json({ message: 'Failed to update order status' });
//     }
// };

// @desc    Get delivery agent statistics
// @route   GET /api/delivery/stats
// @access  Private/Delivery
const getDeliveryStats = asyncHandler(async (req, res) => {
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
        status: 'Delivered', // Changed from 'DELIVERED'
        ...dateFilter
    });

    // Total earnings (commission)
    const earningsData = await Order.find({
        deliveryAgent: req.user._id,
        status: 'Delivered', // Changed from 'DELIVERED'
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

    // Current active deliveries - update status values to match model
    const activeDeliveries = await Order.countDocuments({
        deliveryAgent: req.user._id,
        status: { $in: ['Pending', 'Preparing', 'Out for delivery'] } // Changed from ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY']
    });

    res.json({
        totalDeliveries,
        totalEarnings: totalEarnings.toFixed(2),
        avgDeliveryTime: `${avgDeliveryTime} min`,
        avgRating,
        activeDeliveries
    });
});

// @desc    Get delivery dashboard summary
// @route   GET /api/delivery/dashboard
// @access  Private/Delivery
const getDeliveryDashboard = asyncHandler(async (req, res) => {
    // Active orders - update status values to match model
    const activeOrders = await Order.find({
        deliveryAgent: req.user._id,
        status: { $in: ['Pending', 'Preparing', 'Out for delivery'] } // Changed from ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY']
    }).sort({ createdAt: -1 });

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayDeliveries = await Order.countDocuments({
        deliveryAgent: req.user._id,
        status: 'Delivered', // Changed from 'DELIVERED'
        createdAt: { $gte: today }
    });

    // Today's earnings
    const todayOrders = await Order.find({
        deliveryAgent: req.user._id,
        status: 'Delivered', // Changed from 'DELIVERED'
        createdAt: { $gte: today }
    });

    let todayEarnings = 0;
    todayOrders.forEach(order => {
        todayEarnings += (order.amount * 0.2); // 20% commission
    });

    // Recent completed deliveries (last 5)
    const recentDeliveries = await Order.find({
        deliveryAgent: req.user._id,
        status: 'Delivered' // Changed from 'DELIVERED'
    }).sort({ createdAt: -1 }).limit(5);

    const formattedActive = activeOrders.map(order => ({
        id: order.orderNumber || order._id,
        customer: order.customerName,
        address: `${order.address.street}, ${order.address.city}`,
        amount: order.amount,
        status: order.status,
        time: order.createdAt.toTimeString().split(' ')[0].slice(0, 5)
    }));

    const formattedRecent = recentDeliveries.map(order => ({
        id: order.orderNumber || order._id,
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
});


// @desc    Get orders with pending COD payments assigned to the delivery agent
// @route   GET /api/delivery/orders/pending-payments
// @access  Private/Delivery
const getOrdersPendingPayment = asyncHandler(async (req, res) => {
    const orders = await Order.find({
        deliveryAgent: req.user._id,
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'Pending',
        status: { $in: ['Out for delivery', 'Delivered'] }
    }).sort({ createdAt: -1 });

    // Format orders for frontend
    const formattedOrders = orders.map(order => ({
        id: order.orderNumber || order._id,
        _id: order._id,
        amount: order.amount,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        date: order.createdAt.toISOString().split('T')[0],
        time: order.time || order.createdAt.toTimeString().split(' ')[0].slice(0, 5)
    }));

    res.json(formattedOrders);
});


// @desc    Update order payment status
// @route   PUT /api/delivery/orders/:id/payment
// @access  Private/Delivery
// Update in deliveryController.js
const updateOrderPayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { paymentStatus, status, note } = req.body;

    try {
        // Find the order
        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if this order is assigned to the current delivery agent
        if (!order.deliveryAgent || order.deliveryAgent.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this order' });
        }

        // Update payment status
        order.paymentStatus = paymentStatus || 'Completed';

        // If status is provided, update the order status too
        if (status && ['Preparing', 'Out for delivery', 'Delivered'].includes(status)) {
            order.status = status;
        }

        // Add status update for payment and delivery if applicable
        order.statusUpdates.push({
            status: order.status,
            time: new Date(),
            note: note || `Payment ${paymentStatus || 'Completed'}${status ? ' and status updated to ' + status : ''}`
        });

        const updatedOrder = await order.save();

        res.json({
            success: true,
            message: 'Payment status updated successfully',
            order: {
                _id: updatedOrder._id,
                paymentStatus: updatedOrder.paymentStatus,
                status: updatedOrder.status
            }
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ message: 'Failed to update payment status' });
    }
});


// Don't forget to add this to the module.exports
module.exports = {
    // getAssignedOrders,
    getCompletedOrders,
    getOrderDetails,
    // updateOrderStatus,
    getDeliveryStats,
    getDeliveryDashboard,
    getOrdersPendingPayment,
    updateOrderPayment
};