const firebaseAdmin = require('../utils/firebaseAdmin');

async function getFirebaseAccessToken() {
  try {
    const app = firebaseAdmin.getApp();
    const accessToken = await app.options.credential.getAccessToken();
    
    console.log('🔑 Firebase Access Token:', accessToken.access_token);
    
    return accessToken.access_token;
  } catch (error) {
    console.error('❌ Error getting Firebase access token:', error);
    return null;
  }
}

module.exports = { getFirebaseAccessToken };
