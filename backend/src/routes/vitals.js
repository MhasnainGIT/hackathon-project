const express = require('express');
const router = express.Router();
const Vitals = require('../models/Vitals');

router.get('/patients', async (req, res) => {
  try {
    const vitals = await Vitals.find().sort({ timestamp: -1 }).limit(50);
    res.json(vitals);
  } catch (error) {
    console.error('Error fetching vitals:', error);
    res.status(500).json({ message: 'Server error fetching vitals' });
  }
});

router.get('/patients/:patientId/vitals', async (req, res) => {
  try {
    const vitals = await Vitals.find({ patientId: req.params.patientId }).sort({ timestamp: -1 }).limit(20);
    res.json(vitals);
  } catch (error) {
    console.error('Error fetching patient vitals:', error);
    res.status(500).json({ message: 'Server error fetching patient vitals' });
  }
});

module.exports = router;