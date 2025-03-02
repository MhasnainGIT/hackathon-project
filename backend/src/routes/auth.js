const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);

router.post('/register/passkey/start', authController.registerPasskeyStart);
router.post('/register/passkey/verify', authController.registerPasskeyVerify);
router.post('/login/passkey/start', authController.loginPasskeyStart);
router.post('/login/passkey/verify', authController.loginPasskeyVerify);

module.exports = router;