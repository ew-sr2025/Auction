const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

exports.uploadDir = uploadDir;

// "/uploads/abc.jpg" ko'rinishidagi yo'ldan faylni o'chiradi
exports.removeUploaded = (urlPath) => {
  if (!urlPath || !urlPath.startsWith('/uploads/')) return;
  fs.unlink(path.join(uploadDir, path.basename(urlPath)), () => {});
};

// multer yuklagan fayllarni (xatolik bo'lganda) o'chirish
exports.removeFiles = (files = []) =>
  files.forEach((f) => fs.unlink(f.path, () => {}));
