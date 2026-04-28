const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth2.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', controller.logout);
router.post('/verify', controller.verify);
router.post('/resend', controller.resend);
router.post('/check-email', controller.checkEmail);
router.post('/verify-reset-code', controller.verifyResetCode);
router.post('/reset-password', controller.resetPassword);
router.get('/me', authMiddleware, controller.me);
router.put('/me', authMiddleware, controller.updateMe);
router.post('/telegram/link-token', authMiddleware, controller.telegramLinkToken);

module.exports = router;
