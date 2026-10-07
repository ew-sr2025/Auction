const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

exports.uploadDir = uploadDir;

// multer yuklagan fayllarni (xatolik bo'lganda) o'chirish
exports.removeFiles = (files = []) =>
  files.forEach((f) => fs.unlink(f.path, () => {}));
