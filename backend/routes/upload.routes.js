const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

// Protect upload route with auth middleware (and ideally admin check)
router.post('/', authMiddleware, ...requireRole(2), uploadController.uploadMiddleware, uploadController.uploadImage);

module.exports = router;
