# 🔥 Firebase Service Account Configuration

To enable push notifications, you need to create a Firebase service account key:

## 1. Go to Firebase Console
- Visit https://console.firebase.google.com/
- Select your project or create a new one

## 2. Generate Service Account Key
- Go to Project Settings → Service accounts
- Click "Generate new private key"
- Download the JSON file

## 3. Place the Service Account Key
- Save the downloaded file as `firebase-service-account.json`
- Place it in the `pizzabackend/config/` directory

## 4. Alternative: Environment Variables
If you don't want to use a file, you can set these environment variables:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
```

## 5. Frontend Firebase Config
Update the Firebase config in `pizzafrontend/src/config/firebase.ts` with your project's configuration:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

## Security Note
- Never commit the service account file to version control
- Add `firebase-service-account.json` to your `.gitignore`
- Use environment variables in production
