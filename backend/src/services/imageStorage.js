const { ImageKit, toFile } = require('@imagekit/nodejs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { imageKitPrivateKey } = require('../config/env');

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const getClient = () => {
  if (!imageKitPrivateKey) {
    throw new AppError('ImageKit sozlanmagan: IMAGEKIT_PRIVATE_KEY kiriting', 503, 'IMAGEKIT_NOT_CONFIGURED');
  }
  return new ImageKit({ privateKey: imageKitPrivateKey });
};

exports.uploadImage = async (file, folder) => {
  if (!file?.buffer || !file.originalname) {
    throw new AppError('Yuklanadigan rasm fayli topilmadi');
  }

  const client = getClient();
  const fileName = `${crypto.randomUUID()}${EXTENSIONS[file.mimetype]}`;
  try {
    const result = await client.files.upload({
      file: await toFile(file.buffer, fileName),
      fileName,
      folder,
      useUniqueFileName: true,
    });
    if (!result.url) throw new Error('ImageKit did not return an image URL');
    return result.url;
  } catch (error) {
    console.error('ImageKit image upload failed:', error);
    throw new AppError('Rasmni ImageKitga yuklab bo‘lmadi', 502, 'IMAGEKIT_UPLOAD_FAILED');
  }
};

exports.uploadImages = async (files = [], folder) =>
  Promise.all(files.map((file) => exports.uploadImage(file, folder)));
