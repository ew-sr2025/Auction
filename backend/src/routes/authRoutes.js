const router = require('express').Router();
const {
  login,
  getMe,
  requestRegistrationCode,
  resendRegistrationCode,
  verifyRegistration,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register/code', requestRegistrationCode);
router.post('/register/resend', resendRegistrationCode);
router.post('/register/verify', verifyRegistration);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;
