const nodemailer = require('nodemailer');
const { emailConfig } = require('../config'); // Import emailConfig from config.js

// Initialize Nodemailer transporter with error handling
let transporter;
try {
  if (!emailConfig || !emailConfig.host || !emailConfig.port || !emailConfig.auth) {
    throw new Error('Email configuration is incomplete or missing');
  }

  transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure || false, // Use TLS/SSL if specified
    auth: {
      user: emailConfig.auth.user,
      pass: emailConfig.auth.pass,
    },
  });
  console.log('Nodemailer transporter initialized successfully');
} catch (error) {
  console.error('Nodemailer initialization error:', error);
  transporter = null; // Fallback if email config fails
}

module.exports = {
  sendEmail: async (to, subject, text, html) => {
    if (!transporter) {
      console.error('Cannot send email: Transporter not initialized');
      return false;
    }

    try {
      const info = await transporter.sendMail({
        from: emailConfig.auth.user, // Sender address
        to,
        subject,
        text,
        html,
      });
      console.log('Email sent:', info.response);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  },
};