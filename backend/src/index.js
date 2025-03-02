const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const redis = require('redis');
const admin = require('firebase-admin');
const { Server } = require('socket.io');
const wearableService = require('./services/wearable'); // Import wearable service
const authRoutes = require('./routes/auth');
const { mongoUri, redisUrl, firebaseConfig } = require('./config');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Redis connection
const redisClient = redis.createClient({ url: redisUrl });
redisClient.on('error', err => console.error('Redis error:', err));
redisClient.connect()
  .then(() => console.log('Redis connected'))
  .catch(err => console.error('Redis connection error:', err));

// Firebase Admin initialization
try {
  const firebaseConfigObj = JSON.parse(firebaseConfig);
  if (!firebaseConfigObj.project_id || typeof firebaseConfigObj.project_id !== 'string') {
    throw new Error('Firebase config must contain a valid "project_id" string');
  }
  admin.initializeApp({
    credential: admin.credential.cert(firebaseConfigObj),
  });
  console.log('Firebase Admin initialized');
} catch (error) {
  console.error('Firebase Admin initialization error:', error.message);
  // Optionally, continue without Firebase if it's not critical
  // process.exit(1); // Uncomment to exit if Firebase config is invalid, or comment out to skip Firebase
}

// Create HTTP server
const server = http.createServer(app);

// Function to check if port 5000 is available and fail if not
const checkPort = (port) => {
  return new Promise((resolve, reject) => {
    const testServer = http.createServer();
    testServer.listen(port, () => {
      testServer.close(() => resolve(port));
    });
    testServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please free port 5000 or choose a different port.`);
        reject(err);
      } else {
        reject(err);
      }
    });
  });
};

// Force use of port 5000
const PORT = 5000;
checkPort(PORT)
  .then((port) => {
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    // Initialize Socket.IO with port 5000
    const io = new Server(server, {
      cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
      },
    });

    // Handle the root route (GET /) to return a simple response
    app.get('/', (req, res) => {
      res.status(200).send('HealthSync AI Backend is running');
    });

    // Socket.IO event handlers
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('chatMessage', async (msg) => {
        try {
          const { room, message } = msg;
          io.to(room).emit('chatMessage', { room, message, timestamp: new Date().toISOString(), user: socket.id });
          await redisClient.setEx(`message:${room}:${socket.id}`, 3600, JSON.stringify({ room, message, timestamp: new Date().toISOString(), user: socket.id }));
        } catch (error) {
          console.error('Chat message error:', error);
        }
      });

      socket.on('addPatient', (data) => {
        try {
          const { patientId } = data;
          io.emit('patientAdded', { patientId, timestamp: new Date().toISOString() });
        } catch (error) {
          console.error('Add patient error:', error);
        }
      });

      socket.on('removePatient', (data) => {
        try {
          const { patientId } = data;
          io.emit('patientRemoved', { patientId, timestamp: new Date().toISOString() });
        } catch (error) {
          console.error('Remove patient error:', error);
        }
      });

      socket.on('setThreshold', (data) => {
        try {
          const { patientId, thresholds } = data;
          io.emit('thresholdUpdated', { patientId, thresholds, timestamp: new Date().toISOString() });
        } catch (error) {
          console.error('Set threshold error:', error);
        }
      });

      socket.on('updateScore', async (data) => {
        try {
          const { username, points } = data;
          io.emit('scoreUpdated', { username, points, timestamp: new Date().toISOString() });
          await redisClient.setEx(`score:${username}`, 3600, JSON.stringify({ username, points, timestamp: new Date().toISOString() }));
        } catch (error) {
          console.error('Update score error:', error);
        }
      });

      socket.on('createPost', async (data) => {
        try {
          const { author, content, imageUrl, communityId } = data;
          const post = { id: `post${Date.now()}`, author, content, imageUrl, likes: 0, comments: [], timestamp: new Date().toISOString() };
          io.to(communityId).emit('newPost', { post });
          await redisClient.setEx(`post:${post.id}`, 86400, JSON.stringify(post));
        } catch (error) {
          console.error('Create post error:', error);
        }
      });

      socket.on('likePost', async (data) => {
        try {
          const { postId, user } = data;
          io.emit('postLiked', { postId, user, timestamp: new Date().toISOString() });
          const post = JSON.parse(await redisClient.get(`post:${postId}`) || '{}');
          if (post) {
            post.likes += 1;
            await redisClient.setEx(`post:${postId}`, 86400, JSON.stringify(post));
          }
        } catch (error) {
          console.error('Like post error:', error);
        }
      });

      socket.on('commentPost', async (data) => {
        try {
          const { postId, user, comment } = data;
          io.emit('postCommented', { postId, user, comment, timestamp: new Date().toISOString() });
          const post = JSON.parse(await redisClient.get(`post:${postId}`) || '{}');
          if (post) {
            post.comments.push(`${user}: ${comment}`);
            await redisClient.setEx(`post:${postId}`, 86400, JSON.stringify(post));
          }
        } catch (error) {
          console.error('Comment post error:', error);
        }
      });

      socket.on('connectDoctor', async (data) => {
        try {
          const { from, to } = data;
          io.emit('connectionUpdated', { from, to, timestamp: new Date().toISOString() });
          await redisClient.setEx(`connection:${from}:${to}`, 86400, JSON.stringify({ from, to, timestamp: new Date().toISOString() }));
        } catch (error) {
          console.error('Connect doctor error:', error);
        }
      });

      socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
    });

    // Routes
    app.use('/auth', authRoutes);

    // Start wearable simulation after server and io are fully initialized
    wearableService.startSimulation(io, redisClient, admin).catch(err => {
      console.error('Error starting wearable simulation:', err);
    });
  })
  .catch(err => {
    console.error('Failed to start server: Port 5000 is in use. Please free port 5000 or update the port in config.');
    process.exit(1); // Exit if port 5000 is not available
  });