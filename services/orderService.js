// services/orderService.js
exports.calculateTotal = (items) => {
    return items.reduce((total, item) => total + item.price, 0);
  };