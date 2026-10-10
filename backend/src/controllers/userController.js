const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { uploadImage } = require('../services/imageStorage');

// PUT /api/users/me  (multipart/form-data: firstName, lastName, username, bio, phone, avatar)
exports.updateMe = asyncHandler(async (req, res) => {
  const user = req.user;
  const { firstName, lastName, username, bio, phone } = req.body;

  if (firstName !== undefined) {
    const value = String(firstName).trim();
    if (!value) throw new AppError("Ism bo'sh bo'lmasligi kerak");
    user.firstName = value;
  }
  if (lastName !== undefined) {
    const value = String(lastName).trim();
    if (!value) throw new AppError("Familya bo'sh bo'lmasligi kerak");
    user.lastName = value;
  }
  if (username !== undefined) {
    const normalized = String(username).trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
      throw new AppError("Username 3-20 belgi: lotin harflari, raqam va _ bo'lishi mumkin");
    }
    if (normalized !== user.username && (await User.exists({ username: normalized, _id: { $ne: user._id } }))) {
      throw new AppError('Bu username allaqachon band', 409);
    }
    user.username = normalized;
  }
  if (bio !== undefined) user.bio = String(bio).trim();
  if (phone !== undefined && typeof phone === 'string') user.phone = phone.replace(/[\s()-]/g, '');
  if (req.body.removeAvatar === 'true') user.avatar = '';
  else if (req.file) user.avatar = await uploadImage(req.file, '/avatars');

  await user.save();

  res.json({ success: true, user });
});
