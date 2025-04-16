    require('dotenv').config();
    const express = require('express');
    const { Server } = require('socket.io');
    const nodemailer = require('nodemailer');
    const app = express();

    const port = 5000;

    // Socket.IO setup
    const server = app.listen(port, () => console.log(`Server running on port ${port}`));
    const io = new Server(server, {
    cors: { origin: 'http://localhost:3000', methods: ['GET', 'POST'] },
    });

    io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
    socket.on('notifyDoctor', (data) => {
        sendEmail(data.patientId, data.doctorEmail);
    });
    });

    // Email configuration
    const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // e.g., your-email@gmail.com
        pass: process.env.EMAIL_PASS, // App Password or password
    },
    });

    const sendEmail = async (patientId, doctorEmail) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: doctorEmail || 'doctor@example.com',
        subject: `Urgent: Patient ${patientId} Update`,
        text: `Dear Doctor,\n\nAn update is available for Patient ${patientId}. Please check the dashboard for details.\n\nBest,\nMedSync AI Team`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${doctorEmail} for Patient ${patientId}`);
    } catch (error) {
        console.error(`Failed to send email to ${doctorEmail} for Patient ${patientId}`, error);
    }
    };

    // Example API endpoint (optional)
    app.get('/api/test-email', (req, res) => {
    sendEmail('patient1', 'doctor@example.com');
    res.send('Email test initiated');
    });