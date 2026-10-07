const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { banUserData, liftBan, releaseExpiredBans } = require('../services/banService');

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
      .select('username firstName lastName email role isBanned bannedUntil banReason createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, users, total, page, pages: Math.ceil(total / limit) });
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
      .select('title images author status currentPrice reporters createdAt')
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
