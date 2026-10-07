const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

exports.uploadDir = uploadDir;
