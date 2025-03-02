const admin = require('firebase-admin');
const { firebaseConfig } = require('../config');

let firebaseApp;

// Check if the app is already initialized to avoid duplicates
if (!admin.apps.length) {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(firebaseConfig)),
  });
} else {
  firebaseApp = admin.apps[0]; // Use the existing default app
}

module.exports = firebaseApp;