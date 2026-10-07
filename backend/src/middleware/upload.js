const multer = require('multer');
const AppError = require('../utils/AppError');

const EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const fileFilter = (_req, file, cb) => {
  if (EXT[file.mimetype]) return cb(null, true);
  cb(new AppError('Faqat rasm yuklash mumkin (jpg, png, webp, gif)'));
};

module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});
