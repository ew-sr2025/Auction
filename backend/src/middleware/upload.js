const multer = require('multer');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { uploadDir } = require('../utils/files');

const EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${EXT[file.mimetype]}`),
});

const fileFilter = (_req, file, cb) => {
  if (EXT[file.mimetype]) return cb(null, true);
  cb(new AppError('Faqat rasm yuklash mumkin (jpg, png, webp, gif)'));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5MB, 5 ta gacha
});
