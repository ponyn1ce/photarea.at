const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const orders = require('../controllers/orders.controller');

// менеджер (1) и админ (2) — доступ к заказам
router.get('/', auth, ...requireRole(1), orders.list);
router.get('/:id', auth, ...requireRole(1), orders.getOne);
router.post('/', auth, ...requireRole(1), orders.create);
router.patch('/:id', auth, ...requireRole(1), orders.patch);
// удаление — только админ (2) и legacy
router.delete('/:id', auth, ...requireRole(2), orders.remove);

module.exports = router;
