const router = require('express').Router();
const {
  listUsers,
  listProducts,
  removeProduct,
  setUserBan,
} = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/auth');

router.use(protect, requireAdmin);
router.get('/users', listUsers);
router.patch('/users/:id/ban', setUserBan);
router.get('/products', listProducts);
router.delete('/products/:id', removeProduct);

module.exports = router;
