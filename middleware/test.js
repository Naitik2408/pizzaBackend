// Request inspection middleware
const requestInspector = (req, res, next) => {
    console.log('\n====== REQUEST INSPECTOR ======');
    console.log('Time:', new Date().toISOString());
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    if (req.method !== 'GET') {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    
    // Track the original send and json methods
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Override the send method to log response data
    res.send = function(body) {
      console.log('\n====== RESPONSE INSPECTOR ======');
      console.log('Status:', res.statusCode);
      console.log('Response Headers:', JSON.stringify(res._headers, null, 2));
      console.log('Body:', typeof body === 'string' ? body : JSON.stringify(body, null, 2));
      return originalSend.apply(this, arguments);
    };
    
    // Override the json method to log response data
    res.json = function(body) {
      console.log('\n====== RESPONSE INSPECTOR ======');
      console.log('Status:', res.statusCode);
      console.log('Response Headers:', JSON.stringify(res._headers, null, 2));
      console.log('Body (JSON):', JSON.stringify(body, null, 2));
      return originalJson.apply(this, arguments);
    };
    
    next();
  };
  
  module.exports = requestInspector;