const mongoose = require('mongoose');

const vitalsSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  heartRate: { type: Number, required: true },
  spO2: { type: Number, required: true },
  respirationRate: { type: Number, required: true },
  temperature: { type: Number, required: true },
  activityLevel: { type: String, enum: ['sedentary', 'active', 'exercise'], required: true },
  anomalyScore: { type: Number, required: true },
  prediction: { type: String, enum: ['Normal', 'Moderate', 'Critical'], required: true },
  isVerySerious: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
  recoveryRate: { type: Number, default: 0 },
});

vitalsSchema.index({ patientId: 1, timestamp: -1 });

module.exports = mongoose.model('Vitals', vitalsSchema);