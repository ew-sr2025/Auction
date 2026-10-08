const Product = require('../models/Product');
const User = require('../models/User');
const News = require('../models/News');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getBannedUserIds, releaseExpiredBans } = require('../services/banService');

exports.listNews = asyncHandler(async (req, res) => {
  await releaseExpiredBans(req.app.get('io'));
  const bannedUserIds = await getBannedUserIds();
  const [posts, soldProducts] = await Promise.all([
    News.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('author', 'username')
      .lean(),
    Product.find({
      isDeleted: false,
      banPausedAt: null,
      author: { $nin: bannedUserIds },
      status: 'sold',
      $expr: { $gte: ['$finalPrice', { $multiply: ['$startingPrice', 1.5] }] },
    })
      .select('title images startingPrice finalPrice endedAt updatedAt')
      .sort({ endedAt: -1, updatedAt: -1 })
      .limit(100)
      .lean(),
  ]);

  const news = [
    ...posts.map((post) => ({
      _id: String(post._id),
      type: 'announcement',
      title: post.title,
      body: post.body,
      author: post.author?.username || 'Admin',
      createdAt: post.createdAt,
    })),
    ...soldProducts.map((product) => ({
      _id: `sold-${product._id}`,
      type: 'successful-sale',
      title: `“${product.title}” muvaffaqiyatli sotildi!`,
      body: `Boshlang‘ich narx: ${product.startingPrice} so‘m. Sotilgan narx: ${product.finalPrice} so‘m (${(product.finalPrice / product.startingPrice).toFixed(1)} baravar).`,
      productId: String(product._id),
      image: product.images?.[0] || '',
      createdAt: product.endedAt || product.updatedAt,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 100);

  res.json({ success: true, news });
});

exports.createNews = asyncHandler(async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!title || title.length > 120) throw new AppError('Sarlavha 1 dan 120 belgigacha bo‘lishi kerak', 400);
  if (!body || body.length > 2000) throw new AppError('Matn 1 dan 2000 belgigacha bo‘lishi kerak', 400);

  const post = await News.create({ title, body, author: req.user._id });
  await post.populate('author', 'username');
  res.status(201).json({ success: true, news: post });
});

exports.deleteNews = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("Noto'g'ri ID", 400);
  const post = await News.findByIdAndDelete(req.params.id);
  if (!post) throw new AppError('Yangilik topilmadi', 404);
  res.json({ success: true });
});

exports.getStats = asyncHandler(async (req, res) => {
  await releaseExpiredBans(req.app.get('io'));
  const bannedUserIds = await getBannedUserIds();
  const publicProductFilter = {
    isDeleted: false,
    banPausedAt: null,
    author: { $nin: bannedUserIds },
  };
  const now = new Date();

  const [users, products, activeProducts, soldProducts] = await Promise.all([
    User.countDocuments(),
    Product.countDocuments(publicProductFilter),
    Product.countDocuments({
      ...publicProductFilter,
      status: 'active',
      $or: [
        { saleMode: 'fixed' },
        { saleMode: { $in: ['auction', null] }, endsAt: { $gt: now } },
      ],
    }),
    Product.countDocuments({
      ...publicProductFilter,
      status: 'sold',
    }),
  ]);

  res.json({
    success: true,
    stats: { users, products, activeProducts, soldProducts },
  });
});
