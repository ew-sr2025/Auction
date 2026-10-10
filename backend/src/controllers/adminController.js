const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { banUserData, liftBan, releaseExpiredBans } = require('../services/banService');
const { uploadImage } = require('../services/imageStorage');
const { PHONE_REGEX } = require('../config/constants');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const filter = {};
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  await releaseExpiredBans(req.app.get('io'));

  if (query) {
    const search = new RegExp(escapeRegex(query), 'i');
    filter.$or = [
      { username: search },
      { firstName: search },
      { lastName: search },
      { email: search },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('username firstName lastName email phone bio avatar role isBanned bannedUntil banReason createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, users, total, page, pages: Math.ceil(total / limit) });
});

exports.getUser = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("Noto'g'ri ID");
  const user = await User.findById(req.params.id)
    .select('username firstName lastName email phone bio avatar role isBanned bannedUntil banReason createdAt')
    .lean();
  if (!user) throw new AppError('Foydalanuvchi topilmadi', 404);
  res.json({ success: true, user });
});

exports.listProducts = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const filter = { isDeleted: false };

  if (query) {
    const search = new RegExp(escapeRegex(query), 'i');
    const authors = await User.find({ username: search }).distinct('_id');
    filter.$or = [{ title: search }, { author: { $in: authors } }];
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .select('title description images author status currentPrice startingPrice durationDays saleMode bidCount location contactPhone reporters createdAt')
      .populate('author', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    products: products.map(({ reporters = [], ...product }) => ({
      ...product,
      reportCount: reporters.length,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

exports.getProduct = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("Noto'g'ri ID");
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false })
    .select('title description images author status currentPrice startingPrice durationDays saleMode bidCount location contactPhone createdAt')
    .populate('author', 'username firstName lastName')
    .lean();
  if (!product) throw new AppError('Mahsulot topilmadi', 404);
  res.json({ success: true, product });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError("Noto'g'ri ID");
  const user = await User.findById(id);
  if (!user) throw new AppError('Foydalanuvchi topilmadi', 404);

  const { firstName, lastName, username, email, phone, bio } = req.body || {};
  if (firstName !== undefined) {
    const value = String(firstName).trim();
    if (!value || value.length > 50) throw new AppError("Ism 1 dan 50 belgigacha bo'lishi kerak");
    user.firstName = value;
  }
  if (lastName !== undefined) {
    const value = String(lastName).trim();
    if (!value || value.length > 50) throw new AppError("Familya 1 dan 50 belgigacha bo'lishi kerak");
    user.lastName = value;
  }
  if (username !== undefined) {
    const normalized = String(username).trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
      throw new AppError("Username 3-20 belgi: lotin harflari, raqam va _ bo'lishi mumkin");
    }
    user.username = normalized;
  }
  if (email !== undefined) {
    const normalized = String(email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new AppError("Email manzil noto'g'ri");
    user.email = normalized;
  }
  if (phone !== undefined) {
    const normalized = String(phone).replace(/[\s()-]/g, '');
    if (normalized && !PHONE_REGEX.test(normalized)) throw new AppError("Telefon raqam noto'g'ri");
    user.phone = normalized;
  }
  if (bio !== undefined) {
    const value = String(bio).trim();
    if (value.length > 500) throw new AppError("Bio 500 belgidan oshmasligi kerak");
    user.bio = value;
  }
  if (req.body.removeAvatar === 'true') user.avatar = '';
  else if (req.file) user.avatar = await uploadImage(req.file, '/avatars');

  await user.save();
  res.json({ success: true, user: user.toJSON() });
});

exports.removeProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError("Noto'g'ri ID");

  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) throw new AppError('Mahsulot topilmadi', 404);
  await product.softDelete();

  const io = req.app.get('io');
  if (io) {
    io.to('feed').to(`product:${product._id}`).emit('product:removed', {
      productId: product._id,
    });
  }
  res.json({ success: true });
});

exports.setUserBan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError("Noto'g'ri ID");
  const { isBanned, durationType, duration, durationUnit, reason } = req.body || {};
  if (typeof isBanned !== 'boolean') throw new AppError('Blok holatini yuboring');
  if (String(req.user._id) === id) {
    throw new AppError("O'zingizni bloklay olmaysiz", 409);
  }

  const user = await User.findById(id);
  if (!user) throw new AppError('Foydalanuvchi topilmadi', 404);
  if (user.role === 'admin') {
    throw new AppError('Boshqa administratorni bloklab bo‘lmaydi', 409);
  }

  if (isBanned) {
    if (durationType !== 'temporary' && durationType !== 'permanent') {
      throw new AppError("Blok muddatini tanlang: vaqtinchalik yoki cheksiz");
    }
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
      throw new AppError("Sabab 500 belgidan oshmasligi kerak");
    }

    user.isBanned = true;
    user.bannedAt = new Date();
    user.banDataProcessedAt = null;
    user.banReason = typeof reason === 'string' ? reason.trim() : '';
    if (durationType === 'permanent') {
      user.bannedUntil = null;
    } else {
      const unitMs = { hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000 };
      const multiplier = unitMs[durationUnit];
      if (!Number.isSafeInteger(duration) || duration < 1 || !multiplier) {
        throw new AppError("Vaqtinchalik blok uchun to'g'ri muddat va birlik kiriting");
      }
      const bannedUntil = Date.now() + duration * multiplier;
      if (!Number.isFinite(bannedUntil) || bannedUntil > 8640000000000000) {
        throw new AppError("Blok muddati juda uzun");
      }
      user.bannedUntil = new Date(bannedUntil);
    }
    await user.save();
    req.app.get('io')?.in(`user:${user._id}`).disconnectSockets(true);
    await banUserData(user._id, req.app.get('io'));
    await User.updateOne(
      { _id: user._id, isBanned: true, bannedAt: user.bannedAt },
      { $set: { banDataProcessedAt: new Date() } }
    );
  } else {
    await liftBan(user._id, req.app.get('io'));
  }

  const updatedUser = await User.findById(user._id);
  res.json({
    success: true,
    user: {
      _id: updatedUser._id,
      username: updatedUser.username,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      isBanned: updatedUser.isBanned,
      bannedUntil: updatedUser.bannedUntil,
      banReason: updatedUser.banReason,
      createdAt: updatedUser.createdAt,
    },
  });
});
