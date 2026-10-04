const router = require('express').Router();
const { updateMe } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.put('/me', protect, upload.single('avatar'), updateMe);

module.exports = router;
