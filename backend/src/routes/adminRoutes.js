const router = require('express').Router();
const { listUsers, setUserBan } = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/auth');

router.use(protect, requireAdmin);
router.get('/users', listUsers);
router.patch('/users/:id/ban', setUserBan);

module.exports = router;
