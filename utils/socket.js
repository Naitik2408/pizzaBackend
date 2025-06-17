/**
 * Utility for Socket.IO operations
 */

/**
 * Emit delivery agent status update
 * @param {Object} io - Socket.IO instance
 * @param {Object} user - User document from MongoDB
 */
const emitDeliveryStatusUpdate = (io, user) => {
  if (!io || !user) return;
  
  try {
    // Format delivery agent data
    const deliveryAgentUpdate = {
      _id: user._id,
      name: user.name,
      isOnline: user.deliveryDetails?.isOnline || false,
      lastActiveTime: user.deliveryDetails?.lastActiveTime || null,
      vehicleType: user.deliveryDetails?.vehicleType || 'unknown'
    };

    // Emit to admin room
    io.to('role:admin').emit('delivery_status_update', deliveryAgentUpdate);
    
    // Emit to the specific user
    io.to(`user:${user._id}`).emit('status_changed', { 
      isOnline: user.deliveryDetails?.isOnline, 
      lastActiveTime: user.deliveryDetails?.lastActiveTime 
    });
    
    console.log(`Emitted delivery status update for ${user.name}`);
  } catch (error) {
    console.error('Socket emission error:', error);
  }
};

/**
 * Emit all delivery agents status at once
 * @param {Object} io - Socket.IO instance
 * @param {Array} agents - Array of delivery agent documents
 */
const emitAllDeliveryAgentsStatus = (io, agents) => {
  if (!io || !agents) return;
  
  try {
    const formattedAgents = agents.map(agent => ({
      _id: agent._id,
      name: agent.name,
      isOnline: agent.deliveryDetails?.isOnline || false,
      lastActiveTime: agent.deliveryDetails?.lastActiveTime || null,
      vehicleType: agent.deliveryDetails?.vehicleType || 'unknown'
    }));
    
    io.to('role:admin').emit('delivery_agents_status', formattedAgents);
  } catch (error) {
    console.error('Socket bulk emission error:', error);
  }
};

/**
 * Emit order status update
 * @param {Object} io - Socket.IO instance
 * @param {Object} order - Order document from MongoDB
 * @param {String} triggerType - What triggered the update: 'status_change', 'new_order', 'payment_update', 'cancelled', 'rated'
 * @param {Object} metadata - Additional metadata about the change
 */
const emitOrderStatusUpdate = (io, order, triggerType, metadata = {}) => {
  if (!io || !order) return;
  
  try {
    // Basic order update information
    const orderUpdate = {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      updatedAt: new Date(),
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      statusUpdates: order.statusUpdates,
      paymentStatus: order.paymentStatus,
      amount: order.amount,
      triggerType,
      customerName: order.customerName || metadata.customerName,
      ...metadata
    };
    
    // Emit to admin dashboard
    io.to('role:admin').emit('order_update', orderUpdate);
    
    // Emit to the customer who placed the order
    if (order.customer) {
      io.to(`user:${order.customer}`).emit('my_order_update', orderUpdate);
    }
    
    // Emit to assigned delivery agent if any
    if (order.deliveryAgent) {
      io.to(`user:${order.deliveryAgent}`).emit('assigned_order_update', orderUpdate);
    }
    
    // If it's a new order, broadcast with more detailed information
    if (triggerType === 'new_order') {
      // Prepare a more comprehensive data object for the orders list
      const newOrderData = {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt,
        date: new Date(order.createdAt).toLocaleDateString(),
        time: new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        customerName: order.customerName || 'New Customer',
        amount: order.amount,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        deliveryAddress: order.fullAddress || order.address,
        items: order.items?.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          _id: item._id
        })),
        id: order.orderNumber || order._id.toString().slice(-6),
        customer: order.customerName || 'New Customer',
        deliveryAgent: order.deliveryAgentName || 'Unassigned',
        customerPhone: order.customerPhone || '',
        address: order.fullAddress || order.address,
        notes: order.notes || ''
      };
      
      // Emit to delivery agents
      io.to('role:delivery').emit('new_order_placed', newOrderData);
      
      // IMPORTANT: Also emit to admins for orders page real-time updates
      io.to('role:admin').emit('new_order_placed', newOrderData);
      
      console.log(`Emitted new_order_placed to admin and delivery roles`);
    }

    console.log(`Emitted order update for order ${order.orderNumber || order._id}, type: ${triggerType}`);
  } catch (error) {
    console.error('Socket order emission error:', error);
  }
};

/**
 * Emit delivery agent assignment update
 * @param {Object} io - Socket.IO instance
 * @param {Object} order - Order document from MongoDB
 * @param {Object} metadata - Additional metadata about the assignment
 */
const emitDeliveryAgentAssignment = (io, order, metadata = {}) => {
  if (!io || !order) return;
  
  try {
    const assignmentUpdate = {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      deliveryAgent: order.deliveryAgent,
      deliveryAgentName: order.deliveryAgentName,
      updatedAt: new Date(),
      statusUpdates: order.statusUpdates,
      ...metadata
    };
    
    // Emit to admin dashboard
    io.to('role:admin').emit('delivery_assignment_update', assignmentUpdate);
    
    // Also emit as an order update to ensure orders list gets updated
    io.to('role:admin').emit('order_update', {
      ...assignmentUpdate,
      triggerType: 'delivery_assignment'
    });
    
    // Emit to the customer who placed the order
    if (order.customer) {
      io.to(`user:${order.customer}`).emit('my_delivery_assignment', {
        _id: order._id,
        orderNumber: order.orderNumber,
        deliveryAgentName: order.deliveryAgentName,
        updatedAt: new Date()
      });
    }
    
    // Emit to the previously assigned delivery agent (if there was one)
    const previousAgentId = metadata.previousAssignment?.deliveryAgentId;
    if (previousAgentId && previousAgentId.toString() !== order.deliveryAgent?.toString()) {
      io.to(`user:${previousAgentId}`).emit('order_unassigned', {
        _id: order._id,
        orderNumber: order.orderNumber
      });
    }
    
    // Emit to newly assigned delivery agent
    if (order.deliveryAgent) {
      io.to(`user:${order.deliveryAgent}`).emit('new_order_assigned', {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        customerName: order.customerName,
        address: order.fullAddress,
        amount: order.amount,
        items: order.items.slice(0, 3).map(item => ({
          name: item.name,
          quantity: item.quantity
        })),
        totalItems: order.items.length,
        assignedAt: new Date()
      });
    }
    
    console.log(`Emitted delivery assignment update for order ${order.orderNumber || order._id} to ${order.deliveryAgentName || 'Unassigned'}`);
  } catch (error) {
    console.error('Socket delivery assignment emission error:', error);
  }
};

/**
 * Emit payment status update
 * @param {Object} io - Socket.IO instance
 * @param {Object} order - Order document from MongoDB
 */
const emitPaymentUpdate = (io, order) => {
  if (!io || !order) return;
  
  try {
    const paymentUpdate = {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      updatedAt: new Date(),
      triggerType: 'payment_update'
    };
    
    // Emit to admin dashboard
    io.to('role:admin').emit('order_update', paymentUpdate);
    
    // Also emit specific payment event to admin for revenue tracking

    // just to restart the server
    io.to('role:admin').emit('payment_received', paymentUpdate);
    
    // Emit to the customer who placed the order
    if (order.customer) {
      io.to(`user:${order.customer}`).emit('my_payment_update', paymentUpdate);
    }
    
    console.log(`Emitted payment update for order ${order.orderNumber || order._id}, status: ${order.paymentStatus}`);
  } catch (error) {
    console.error('Socket payment emission error:', error);
  }
};

module.exports = {
  emitDeliveryStatusUpdate,
  emitAllDeliveryAgentsStatus,
  emitOrderStatusUpdate,
  emitDeliveryAgentAssignment,
  emitPaymentUpdate
};