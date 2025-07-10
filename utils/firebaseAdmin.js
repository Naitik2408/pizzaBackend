const admin = require('firebase-admin');
const path = require('path');

class FirebaseAdmin {
  constructor() {
    this.admin = null;
    this.initialized = false;
  }

  // Initialize Firebase Admin SDK
  initialize() {
    if (this.initialized) {
      return this.admin;
    }

    try {
      // Check if Firebase app already exists
      if (admin.apps.length > 0) {
        console.log('🔥 Firebase app already exists, using existing instance');
        this.admin = admin.apps[0];
        this.initialized = true;
        return this.admin;
      }

      // Path to your Firebase service account key
      const serviceAccountPath = path.join(__dirname, '../config/firebase-service-account.json');
      
      // Check if service account file exists
      const fs = require('fs');
      if (!fs.existsSync(serviceAccountPath)) {
        console.warn('🔥 Firebase service account file not found. Checking environment variables...');
        
        // Initialize with environment variables
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
          const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
          };

          this.admin = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.FIREBASE_PROJECT_ID,
          });
          
          console.log('✅ Firebase Admin initialized with environment variables');
          this.initialized = true;
        } else {
          console.error('❌ Firebase environment variables not set. Cannot initialize Firebase.');
          throw new Error('Firebase configuration missing: environment variables not set');
        }
      } else {
        // Initialize with service account file
        console.log('🔥 Loading service account file:', serviceAccountPath);
        const serviceAccount = require(serviceAccountPath);
        console.log('🔥 Service account loaded, project_id:', serviceAccount.project_id);
        
        this.admin = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
        });
        
        console.log('✅ Firebase Admin initialized with service account file');
        this.initialized = true;
      }

      return this.admin;
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n')[0]
      });
      throw new Error('Firebase initialization failed: ' + error.message);
    }
  }

  // Get Firebase Admin instance
  getAdmin() {
    if (!this.initialized) {
      return this.initialize();
    }
    return this.admin;
  }

  // Get Firebase App instance (for compatibility)
  getApp() {
    return this.getAdmin();
  }

  // Get messaging instance
  getMessaging() {
    const adminApp = this.getAdmin();
    return adminApp.messaging();
  }

  // Get configuration status
  getStatus() {
    if (!this.initialized) {
      return { initialized: false };
    }
    return {
      initialized: true,
      mode: 'Production'
    };
  }

  // Get Firestore instance
  getFirestore() {
    const adminApp = this.getAdmin();
    return adminApp.firestore();
  }
}

// Singleton instance
const firebaseAdmin = new FirebaseAdmin();

module.exports = firebaseAdmin;
