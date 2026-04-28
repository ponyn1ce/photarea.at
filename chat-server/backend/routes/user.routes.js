const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware);

// Cart
router.get('/cart', userController.getCart);
router.post('/cart', userController.addToCart);
router.delete('/cart/:id', userController.removeFromCart);
router.post('/checkout', userController.checkout);

// Favorites
router.get('/favorites', userController.getFavorites);
router.post('/favorites', userController.addToFavorites);
router.delete('/favorites/product/:productId', userController.removeFromFavorites);

module.exports = router;
