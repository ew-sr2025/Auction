const router = require('express').Router();
const chats = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.get('/conversations', protect, chats.listConversations);

module.exports = router;
