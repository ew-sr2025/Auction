const router = require('express').Router();
const {
  listUsers,
  getUser,
  listProducts,
  getProduct,
  removeProduct,
  setUserBan,
  updateUser,
} = require('../controllers/adminController');
const products = require('../controllers/productController');
const upload = require('../middleware/upload');
const { protect, requireAdmin } = require('../middleware/auth');

router.use(protect, requireAdmin);
router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.put('/users/:id', upload.single('avatar'), updateUser);
router.patch('/users/:id/ban', setUserBan);
router.get('/products', listProducts);
router.get('/products/:id', getProduct);
router.put('/products/:id', upload.array('images', 5), products.adminUpdateProduct);
router.delete('/products/:id', removeProduct);

module.exports = router;
