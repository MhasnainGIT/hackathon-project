const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const patients = [
      { patientId: 'patient1', heartRate: 80, spO2: 98, timestamp: new Date().toISOString() },
      { patientId: 'patient2', heartRate: 85, spO2: 97, timestamp: new Date().toISOString() },
      { patientId: 'patient3', heartRate: 90, spO2: 96, timestamp: new Date().toISOString() },
    ];
    res.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:patientId/vitals', async (req, res) => {
  const { patientId } = req.params;
  try {
    const vitals = {
      patientId,
      heartRate: 80 + Math.floor(Math.random() * 20), // Random for demo
      spO2: 95 + Math.floor(Math.random() * 5), // Random for demo
      timestamp: new Date().toISOString(),
      prediction: 'Normal',
      activityLevel: 'Low',
      recoveryRate: '85%',
      anomalyScore: 0.2,
      isVerySerious: false,
    };
    res.json(vitals);
  } catch (error) {
    console.error('Error fetching patient vitals:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:patientId/forecast', async (req, res) => {
  const { patientId } = req.params;
  try {
    const forecast = {
      patientId,
      riskScore: 'Low',
      suggestion: 'Maintain regular health monitoring',
      days: 30,
    };
    res.json(forecast);
  } catch (error) {
    console.error('Error fetching patient forecast:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:patientId/schemes', async (req, res) => {
  const { patientId } = req.params;
  try {
    const scheme = {
      patientId,
      name: 'Health Insurance Plan',
      description: 'Comprehensive health coverage for chronic conditions',
      eligibility: 'Eligible based on current vitals',
    };
    res.json(scheme);
  } catch (error) {
    console.error('Error fetching patient schemes:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;