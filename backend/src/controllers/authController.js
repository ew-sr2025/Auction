const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const generateUsername = require('../utils/generateUsername');
const { signToken } = require('../utils/token');

const sendAuth = (res, user, status = 200) =>
  res.status(status).json({ success: true, token: signToken(user._id), user });

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, username, birthDate, password } = req.body;

  if (!firstName || !lastName || !email || !birthDate || !password) {
    throw new AppError("Ism, familya, email, tug'ilgan sana va parol majburiy");
  }
  if (password.length < 6) {
    throw new AppError("Parol kamida 6 ta belgidan iborat bo'lishi kerak");
  }

  const birth = new Date(birthDate);
  if (isNaN(birth) || birth >= new Date()) {
    throw new AppError("Tug'ilgan sana noto'g'ri");
  }

  // username ixtiyoriy: berilmasa user4523 kabi tasodifiy yaratiladi
  const finalUsername = username?.trim()
    ? username.trim().toLowerCase()
    : await generateUsername();

  const user = await User.create({
    firstName,
    lastName,
    email,
    username: finalUsername,
    birthDate: birth,
    password, // pre('save') da bcrypt bilan hash qilinadi
  });

  sendAuth(res, user, 201);
});

// POST /api/auth/login   body: { identifier, password }  (username yoki email)
exports.login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    throw new AppError('Username/email va parolni kiriting');
  }

  const id = identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: id }, { username: id }],
  }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError("Username/email yoki parol noto'g'ri", 401);
  }

  sendAuth(res, user);
});

// GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});
