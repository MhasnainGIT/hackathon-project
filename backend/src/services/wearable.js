const io = require('socket.io');
const redis = require('redis');
const admin = require('firebase-admin');
const emailService = require('./email'); // Import email service

const simulateWearableData = async (patientId) => {
  const activityLevels = ['sedentary', 'active', 'exercise'];
  const activity = activityLevels[Math.floor(Math.random() * activityLevels.length)];
  let heartRateBase, spO2Base, respirationRateBase, anomalyScore;

  const statusProbability = Math.random();
  if (statusProbability < 0.80) { // Normal (80%)
    heartRateBase = Math.floor(Math.random() * 30) + 60; // 60–90 bpm
    spO2Base = Math.floor(Math.random() * 10) + 95;     // 95–100%
    respirationRateBase = Math.floor(Math.random() * 8) + 12; // 12–20 breaths/min
    anomalyScore = Math.random() * 0.3;
  } else if (statusProbability < 0.95) { // Moderate (15%)
    heartRateBase = Math.floor(Math.random() * 40) + 90; // 90–130 bpm
    spO2Base = Math.floor(Math.random() * 10) + 90;      // 90–100%
    respirationRateBase = Math.floor(Math.random() * 10) + 20; // 20–30 breaths/min
    anomalyScore = Math.random() * 0.6 + 0.4;
  } else { // Critical (5%)
    heartRateBase = Math.floor(Math.random() * 40) + 110; // 110–150 bpm
    spO2Base = Math.floor(Math.random() * 10) + 80;       // 80–90%
    respirationRateBase = Math.floor(Math.random() * 15) + 25; // 25–40 breaths/min
    anomalyScore = Math.random() * 0.4 + 0.6;
  }

  if (activity === 'active') {
    heartRateBase += 10;
    respirationRateBase += 5;
  } else if (activity === 'exercise') {
    heartRateBase += 30;
    spO2Base = Math.max(spO2Base - 5, 80);
    respirationRateBase += 10;
  }

  const recoveryRate = Math.min(
    100,
    Math.max(
      0,
      80 - (anomalyScore * 100) + (spO2Base - 80) + (120 - heartRateBase)
    )
  );

  return {
    patientId,
    heartRate: Math.min(heartRateBase, 150),
    spO2: Math.max(spO2Base, 80),
    respirationRate: Math.min(respirationRateBase, 40),
    temperature: (Math.random() * 2 + 36).toFixed(1),
    activityLevel: activity,
    anomalyScore,
    prediction: anomalyScore > 0.7 ? 'Critical' : anomalyScore > 0.4 ? 'Moderate' : 'Normal',
    isVerySerious: anomalyScore > 0.7 && (heartRateBase > 130 || spO2Base < 88),
    timestamp: new Date().toISOString(),
    recoveryRate,
  };
};

const sendNotifications = async (patientId, vitals, io, redisClient, firebaseAdmin) => {
  const User = require('../models/User');
  const doctor = await User.findOne({ role: 'doctor' }).exec();
  if (!doctor) {
    console.warn('No doctor found for notifications. Using default notification logic.');
    return; // Skip notifications if no doctor is found, but continue simulation
  }

  // Use email service with fallback
  if (doctor.email && emailService) {
    const emailSent = await emailService.sendEmail(
      doctor.email,
      'Critical Health Alert',
      `Patient ${patientId} is in critical condition. Heart Rate: ${vitals.heartRate} bpm, SpO2: ${vitals.spO2}%.`,
      `<p>Patient ${patientId} is in critical condition. Heart Rate: ${vitals.heartRate} bpm, SpO2: ${vitals.spO2}%. Please review immediately.</p>`
    );
    if (!emailSent) {
      console.error(`Failed to send email to ${doctor.email} for Patient ${patientId}`);
    }
  }

  // Use Twilio and Firebase as in your original code (assume they’re configured correctly in config.js)
  if (doctor.phone) {
    try {
      const twilioClient = require('twilio')(require('../config').twilio.accountSid, require('../config').twilio.authToken);
      await twilioClient.messages.create({
        body: `Critical alert for Patient ${patientId}: Heart Rate ${vitals.heartRate} bpm, SpO2 ${vitals.spO2}%. Review immediately.`,
        from: require('../config').twilio.phoneNumber,
        to: doctor.phone,
      });
      console.log(`SMS sent to ${doctor.phone} for Patient ${patientId}`);
    } catch (error) {
      console.error('SMS sending failed:', error);
    }
  }

  if (doctor.fcmToken && firebaseAdmin) {
    try {
      await firebaseAdmin.messaging().send({
        token: doctor.fcmToken,
        notification: {
          title: 'Critical Health Alert',
          body: `Patient ${patientId} in critical condition. Heart Rate: ${vitals.heartRate}, SpO2: ${vitals.spO2}`,
        },
      });
      console.log(`Push notification sent to ${doctor.fcmToken} for Patient ${patientId}`);
    } catch (error) {
      console.error('Push notification failed:', error);
    }
  }
};

module.exports = {
  startSimulation: async (io, redisClient, firebaseAdmin) => {
    // Ensure emailService is initialized
    if (!emailService) {
      console.warn('Email service not initialized. Notifications will be skipped.');
    }

    // Simulation logic
    setInterval(async () => {
      const patients = ['patient1', 'patient2', 'patient3'];
      for (const patientId of patients) {
        const vitals = await simulateWearableData(patientId);
        io.emit('vitalsUpdate', vitals);

        if (vitals.isVerySerious) {
          io.emit('seriousAlarm', { patientId, vitals });
          await sendNotifications(patientId, vitals, io, redisClient, firebaseAdmin);
        }
      }
    }, 5000); // Emit vitals every 5 seconds
  },
};