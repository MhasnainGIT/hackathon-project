const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { passkey } = require('../config');

exports.register = async (req, res) => {
    try {
      console.log('Registration attempt with:', req.body);
      const { username, password, email, usePasskey } = req.body;
      if (!username || !password || !email) {
        return res.status(400).json({ message: 'Username, password, and email are required' });
      }
  
      const existingUser = await User.findOne({ $or: [{ username }, { email }] }).exec();
      if (existingUser) {
        return res.status(400).json({ message: 'Username or email already exists' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ 
        username, 
        password: hashedPassword, 
        email, 
        role: 'doctor', 
        publicKey: usePasskey ? null : undefined, 
        challenge: null 
      });
      await user.save();
  
      const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'your-secure-jwt-secret-here', { expiresIn: '1h' });
      res.status(201).json({ token, user: { username: user.username, role: user.role } });
    } catch (error) {
      console.error('Registration error:', error);
      if (error.name === 'MongoError' || error.name === 'MongooseError') {
        return res.status(500).json({ message: 'Database error during registration' });
      }
      res.status(500).json({ message: 'Server error during registration' });
    }
  };

exports.login = async (req, res) => {
  try {
    console.log('Login attempt with:', req.body);
    const { username, password, usePasskey } = req.body;
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const user = await User.findOne({ username }).exec();
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (usePasskey) {
      if (!user.publicKey) {
        return res.status(400).json({ message: 'Passkey not registered for this user' });
      }
      // Redirect to passkey login flow
      return res.status(200).json({ redirect: '/auth/login/passkey/start', username });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Password not set for this user; use passkey' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'your-secure-jwt-secret-here', { expiresIn: '1h' });
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

exports.registerPasskeyStart = async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username }).exec();
    if (!user) return res.status(400).json({ message: 'User not found' });

    const options = generateRegistrationOptions({
      rpName: passkey.rpName,
      rpId: passkey.rpId,
      userID: user._id.toString(),
      userName: user.username,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials: user.publicKey ? [{ type: 'public-key', id: Buffer.from(user.publicKey, 'base64') }] : [],
    });

    await User.updateOne({ _id: user._id }, { $set: { challenge: options.challenge } }).exec();
    res.json(options);
  } catch (error) {
    console.error('Passkey registration start error:', error);
    res.status(500).json({ message: 'Server error during passkey registration start' });
  }
};

exports.registerPasskeyVerify = async (req, res) => {
  try {
    const { username, credential } = req.body;
    const user = await User.findOne({ username }).exec();
    if (!user || !user.challenge) return res.status(400).json({ message: 'Invalid passkey registration' });

    const verification = await verifyRegistrationResponse({
      credential,
      expectedChallenge: user.challenge,
      expectedOrigin: passkey.origin,
      expectedRPID: passkey.rpId,
    });

    if (!verification.verified) return res.status(400).json({ message: 'Passkey registration failed' });

    user.publicKey = Buffer.from(verification.registrationInfo.credentialPublicKey).toString('base64');
    user.challenge = undefined;
    await user.save();

    res.json({ message: 'Passkey registered successfully', user: { username: user.username, role: user.role } });
  } catch (error) {
    console.error('Passkey registration verify error:', error);
    res.status(500).json({ message: 'Server error during passkey registration verify' });
  }
};

exports.loginPasskeyStart = async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username }).exec();
    if (!user || !user.publicKey) return res.status(400).json({ message: 'User or passkey not found' });

    const options = generateAuthenticationOptions({
      timeout: 60000,
      allowCredentials: [{ type: 'public-key', id: Buffer.from(user.publicKey, 'base64') }],
      rpId: passkey.rpId,
    });

    await User.updateOne({ _id: user._id }, { $set: { challenge: options.challenge } }).exec();
    res.json(options);
  } catch (error) {
    console.error('Passkey login start error:', error);
    res.status(500).json({ message: 'Server error during passkey login start' });
  }
};

exports.loginPasskeyVerify = async (req, res) => {
  try {
    const { username, credential } = req.body;
    const user = await User.findOne({ username }).exec();
    if (!user || !user.publicKey || !user.challenge) return res.status(400).json({ message: 'Invalid passkey login' });

    const verification = await verifyAuthenticationResponse({
      credential,
      expectedChallenge: user.challenge,
      expectedOrigin: passkey.origin,
      expectedRPID: passkey.rpId,
      authenticator: { credentialPublicKey: Buffer.from(user.publicKey, 'base64') },
    });

    if (!verification.verified) return res.status(400).json({ message: 'Passkey authentication failed' });

    user.challenge = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'your-secure-jwt-secret-here', { expiresIn: '1h' });
    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (error) {
    console.error('Passkey login verify error:', error);
    res.status(500).json({ message: 'Server error during passkey login verify' });
  }
};