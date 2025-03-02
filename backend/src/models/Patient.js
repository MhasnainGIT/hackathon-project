const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  patientId: { type: String, unique: true, required: true },
  age: Number,
  gender: String,
  medicalHistory: [String],
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('Patient', patientSchema);