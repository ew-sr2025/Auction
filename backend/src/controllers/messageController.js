const mongoose = require('mongoose');
const Product = require('../models/Product');
const Message = require('../models/Message');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getBannedUserIds, releaseExpiredBans } = require('../services/banService');

async function findProduct(id, io) {
  await releaseExpiredBans(io);
  if (!mongoose.isValidObjectId(id)) throw new AppError("Noto'g'ri mahsulot ID");
  const bannedUserIds = await getBannedUserIds();
  const product = await Product.findOne({
    _id: id,
    isDeleted: false,
    banPausedAt: null,
    author: { $nin: bannedUserIds },
  });
  if (!product) throw new AppError('Mahsulot topilmadi', 404);
  return product;
}

function chatRoom(productId, buyerId) {
  return `chat:${productId}:${buyerId}`;
}

// GET /api/products/:id/messages?buyerId=...
exports.listMessages = asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.id, req.app.get('io'));
  const isAuthor = String(product.author) === String(req.user._id);
  let buyerId;

  if (isAuthor) {
    if (!mongoose.isValidObjectId(req.query.buyerId)) {
      throw new AppError('Xaridor ID noto‘g‘ri', 400);
    }
    buyerId = String(req.query.buyerId);
    if (buyerId === String(product.author)) throw new AppError('Suhbat topilmadi', 404);
    if (await User.exists({ _id: buyerId, isBanned: true })) throw new AppError('Suhbat topilmadi', 404);
    const exists = await Message.exists({ product: product._id, buyer: buyerId });
    if (!exists) throw new AppError('Suhbat topilmadi', 404);
  } else {
    buyerId = String(req.user._id);
    if (req.query.buyerId && String(req.query.buyerId) !== buyerId) {
      throw new AppError('Bu suhbatga ruxsatingiz yo‘q', 403);
    }
  }

  const messages = await Message.find({ product: product._id, buyer: buyerId })
    .sort({ createdAt: 1 })
    .limit(500)
    .populate('sender', 'username firstName lastName avatar')
    .lean();

  res.json({ success: true, messages });
});

// GET /api/products/:id/conversations (muallif uchun barcha suhbatlar)
exports.listConversations = asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.id, req.app.get('io'));
  if (String(product.author) !== String(req.user._id)) {
    throw new AppError('Bu amal faqat mahsulot egasi uchun', 403);
  }

  const bannedUserIds = await getBannedUserIds();
  const latest = await Message.aggregate([
    { $match: { product: product._id, buyer: { $nin: bannedUserIds } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$buyer', message: { $first: '$$ROOT' } } },
    { $sort: { 'message.createdAt': -1 } },
    { $limit: 100 },
  ]);

  const buyers = await User.find({ _id: { $in: latest.map((item) => item._id) } })
    .select('username firstName lastName avatar')
    .lean();
  const buyersById = new Map(buyers.map((buyer) => [String(buyer._id), buyer]));

  res.json({
    success: true,
    conversations: latest.map((item) => ({
      buyer: buyersById.get(String(item._id)),
      message: item.message,
    })).filter((item) => item.buyer),
  });
});

// POST /api/products/:id/messages  body: { text, buyerId? }
exports.sendMessage = asyncHandler(async (req, res) => {
  const product = await findProduct(req.params.id, req.app.get('io'));
  const isAuthor = String(product.author) === String(req.user._id);
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 2000) {
    throw new AppError('Xabar 1 dan 2000 belgigacha bo‘lishi kerak');
  }

  let buyerId;
  if (isAuthor) {
    if (!mongoose.isValidObjectId(req.body.buyerId)) {
      throw new AppError('Xaridor ID noto‘g‘ri');
    }
    buyerId = String(req.body.buyerId);
    if (buyerId === String(product.author)) throw new AppError('Suhbat topilmadi', 404);
    if (await User.exists({ _id: buyerId, isBanned: true })) throw new AppError('Suhbat topilmadi', 404);
    const exists = await Message.exists({ product: product._id, buyer: buyerId });
    if (!exists) throw new AppError('Suhbat topilmadi', 404);
  } else {
    buyerId = String(req.user._id);
    if (req.body.buyerId && String(req.body.buyerId) !== buyerId) {
      throw new AppError('Bu suhbatga ruxsatingiz yo‘q', 403);
    }
  }

  const canChatWhileActive = product.status === 'active' &&
    (product.saleMode === 'fixed' || !product.endsAt || product.endsAt > new Date());
  const canContinueAfterSale =
    product.status === 'sold' &&
    (isAuthor || String(product.winner) === String(req.user._id)) &&
    (!isAuthor || String(product.winner) === buyerId);
  if (!canChatWhileActive && !canContinueAfterSale) {
    throw new AppError('Bu mahsulot bo‘yicha yozishmalar yopilgan', 409);
  }

  const message = await Message.create({
    product: product._id,
    buyer: buyerId,
    sender: req.user._id,
    text,
  });
  await message.populate('sender', 'username firstName lastName avatar');
  const payload = {
    _id: message._id,
    productId: String(product._id),
    buyerId,
    sender: message.sender,
    text: message.text,
    createdAt: message.createdAt,
  };

  const io = req.app.get('io');
  if (io) {
    io.to(chatRoom(product._id, buyerId)).emit('chat:new', payload);
    io.to(`chat:inbox:${product._id}:${product.author}`).emit('chat:inbox:new', payload);
    io.to(`chat:inbox:${product.author}`).emit('chat:inbox:new', payload);
    io.to(`chat:inbox:${buyerId}`).emit('chat:inbox:new', payload);
  }

  res.status(201).json({ success: true, message: payload });
});
