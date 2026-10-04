const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { removeUploaded, removeFiles } = require('../utils/files');

// PUT /api/users/me  (multipart/form-data: firstName, lastName, bio, phone, avatar)
exports.updateMe = asyncHandler(async (req, res) => {
  const user = req.user;
  const oldAvatar = user.avatar;

  try {
    const { firstName, lastName, bio, phone } = req.body;

    if (firstName !== undefined) {
      if (!firstName.trim()) throw new AppError("Ism bo'sh bo'lmasligi kerak");
      user.firstName = firstName;
    }
    if (lastName !== undefined) {
      if (!lastName.trim()) throw new AppError("Familya bo'sh bo'lmasligi kerak");
      user.lastName = lastName;
    }
    if (bio !== undefined) user.bio = bio.trim();
    if (phone !== undefined) user.phone = phone.replace(/[\s()-]/g, '');
    if (req.file) user.avatar = `/uploads/${req.file.filename}`;

    await user.save();
  } catch (err) {
    if (req.file) removeFiles([req.file]);
    throw err;
  }

  if (req.file) removeUploaded(oldAvatar);
  res.json({ success: true, user });
});
