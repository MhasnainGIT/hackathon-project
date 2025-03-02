const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String }, // Optional if using passkey
  email: { type: String, required: true, unique: true },
  role: { type: String, default: 'doctor' },
  score: { type: Number, default: 0 },
  experienceYears: { type: Number, default: 0 },
  specialties: [{ type: String }],
  rating: { type: Number, default: 0 },
  location: { type: String, default: 'India' },
  connections: [{ type: String }],
  fcmToken: { type: String },
  phone: { type: String },
  publicKey: { type: String }, // For passkey (WebAuthn public key, stored as base64)
  challenge: { type: String }, // Temporary challenge for passkey authentication
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema); 