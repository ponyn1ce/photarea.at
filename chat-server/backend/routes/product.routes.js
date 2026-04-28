const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');

// Public routes
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Admin routes (TODO: Add admin check middleware)
router.post('/', authMiddleware, ...requireRole(2), productController.createProduct);
router.put('/:id', authMiddleware, ...requireRole(2), productController.updateProduct);
router.delete('/:id', authMiddleware, ...requireRole(2), productController.deleteProduct);

module.exports = router;
