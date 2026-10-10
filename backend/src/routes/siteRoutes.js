const router = require('express').Router();
const site = require('../controllers/siteController');
const { protect, requireAdmin } = require('../middleware/auth');

router.get('/stats', site.getStats);
router.get('/news', site.listNews);
router.get('/news/:id', protect, requireAdmin, site.getNewsForEdit);
router.post('/news', protect, requireAdmin, site.createNews);
router.patch('/news/:id', protect, requireAdmin, site.updateNews);
router.delete('/news/:id', protect, requireAdmin, site.deleteNews);

module.exports = router;
