module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/healthsync',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
  firebaseConfig: process.env.FIREBASE_CONFIG || '{}',
  passkey: {
    rpName: 'HealthSync AI',
    rpId: 'localhost',
    origin: 'http://localhost:3000',
  },
  emailConfig: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com', // Example: Gmail SMTP
    port: process.env.EMAIL_PORT || 587, // TLS port for Gmail
    secure: process.env.EMAIL_SECURE || false, // false for TLS, true for SSL
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com', // Your email
      pass: process.env.EMAIL_PASS || 'your-email-password', // Your email password or app-specific password
    },
  },
};