const router = require('express').Router();
const c = require('../controllers/productController');
const locations = require('../controllers/locationController');
const messages = require('../controllers/messageController');
const { protect, requirePhone, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', c.listProducts);
router.get('/locations', locations.getLocations);
router.post('/location/resolve', protect, locations.resolveGpsLocation);
router.get('/mine', protect, c.myProducts);
router.get('/:id/conversations', protect, messages.listConversations);
router.get('/:id/messages', protect, messages.listMessages);
router.post('/:id/messages', protect, messages.sendMessage);
// requirePhone upload'dan oldin: telefon yo'q bo'lsa rasmlar yuklanmaydi
router.post('/', protect, requirePhone, upload.array('images', 5), c.createProduct);

router.get('/:id', optionalAuth, c.getProduct);
router.put('/:id', protect, upload.array('images', 5), c.updateProduct);
router.delete('/:id', protect, c.deleteProduct);
router.post('/:id/reactivate', protect, c.reactivateProduct);
router.post('/:id/accept', protect, c.acceptOffer);

// Product moderation endpoints
router.post('/:id/ban-buyer', protect, c.banBuyerFromProduct); // author bans a buyer from this product
router.post('/:id/report', protect, c.reportProduct); // users report a product

module.exports = router;
