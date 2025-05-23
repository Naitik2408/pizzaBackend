// utils/apiResponse.js
exports.success = (res, data, message = 'Success') => {
    return res.status(200).json({ success: true, message, data });
  };