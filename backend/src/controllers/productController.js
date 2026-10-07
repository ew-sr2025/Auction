const mongoose = require('mongoose');
const Product = require('../models/Product');
const Bid = require('../models/Bid');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { removeFiles } = require('../utils/files');
const { getBannedUserIds, releaseExpiredBans, banUserData } = require('../services/banService');
const User = require('../models/User');
const {
  MIN_START_PRICE,
  MIN_BID_STEP,
  DEFAULT_DURATION_DAYS,
} = require('../config/constants');

const AUTHOR_FIELDS = 'username firstName lastName avatar';

// contactPhone faqat muallif va g'olibga ko'rinadi
function present(doc, userId) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const idOf = (v) => (v && v._id ? String(v._id) : v ? String(v) : null);
  const me = userId ? String(userId) : null;

  const isAuthor = me && idOf(obj.author) === me;
  const isWinner = me && idOf(obj.winner) === me;
  if (!isAuthor && !isWinner) delete obj.contactPhone;

  obj.minNextBid = obj.bidCount === 0 ? obj.startingPrice : obj.currentPrice + MIN_BID_STEP;
  delete obj.__v;
  return obj;
}

const emit = (req, event, payload, productId) => {
  const io = req.app.get('io');
  if (!io) return;
  let target = io.to('feed');
  if (productId) target = target.to(`product:${productId}`);
  target.emit(event, payload);
};

async function findOwned(req) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError("Noto'g'ri ID");
  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) throw new AppError('Mahsulot topilmadi', 404);
  if (String(product.author) !== String(req.user._id)) {
    throw new AppError("Bu amal faqat mahsulot egasi uchun", 403);
  }
  return product;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const parseStringList = (value) => {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  if (typeof value === 'string') return value ? [value] : [];
  return [];
};

// POST /api/products  (multipart: title, description, startingPrice, durationDays, images[])
exports.createProduct = asyncHandler(async (req, res) => {
  try {
    const { title, description = '' } = req.body;
    const startingPrice = Number(req.body.startingPrice);
    const durationDays = req.body.durationDays
      ? parseInt(req.body.durationDays, 10)
      : DEFAULT_DURATION_DAYS;

    if (!title || !title.trim()) throw new AppError('Mahsulot nomini kiriting');
    if (!Number.isInteger(startingPrice) || startingPrice < MIN_START_PRICE) {
      throw new AppError(`Minimal boshlang'ich narx ${MIN_START_PRICE} so'm`);
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) {
      throw new AppError("Muddat 1 dan 30 kungacha bo'lishi kerak");
    }

    const product = await Product.create({
      title,
      description,
      images: (req.files || []).map((f) => `/uploads/${f.filename}`),
      author: req.user._id,
      contactPhone: req.user.phone,
      startingPrice,
      durationDays,
    });

    await product.populate('author', AUTHOR_FIELDS);
    emit(req, 'product:created', present(product, null));
    res.status(201).json({ success: true, product: present(product, req.user._id) });
  } catch (err) {
    removeFiles(req.files);
    throw err;
  }
});

// GET /api/products?q=&sort=&page=&limit=   (faqat faol mahsulotlar)
exports.listProducts = asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  await releaseExpiredBans(io);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const bannedUserIds = await getBannedUserIds();
  const filter = {
    status: 'active',
    isDeleted: false,
    banPausedAt: null,
    author: { $nin: bannedUserIds },
    endsAt: { $gt: new Date() },
  };
  if (req.query.q) filter.title = { $regex: escapeRegex(String(req.query.q)), $options: 'i' };

  const sorts = {
    newest: { createdAt: -1 },
    ending: { endsAt: 1 },
    price_asc: { currentPrice: 1 },
    price_desc: { currentPrice: -1 },
  };
  const sort = sorts[req.query.sort] || sorts.newest;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .select('-contactPhone -__v')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', AUTHOR_FIELDS)
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) });
});

// GET /api/products/mine  (muallifning barcha mahsulotlari: faol va nofaol)
exports.myProducts = asyncHandler(async (req, res) => {
  const items = await Product.find({ author: req.user._id, isDeleted: false, banPausedAt: null })
    .sort({ createdAt: -1 })
    .populate('lastBidder', 'username')
    .populate('winner', 'username firstName lastName phone');

  res.json({ success: true, items: items.map((p) => present(p, req.user._id)) });
});

// GET /api/products/:id
exports.getProduct = asyncHandler(async (req, res) => {
  await releaseExpiredBans(req.app.get('io'));
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError("Noto'g'ri ID");

  const bannedUserIds = await getBannedUserIds();
  const product = await Product.findOne({
    _id: id,
    isDeleted: false,
    banPausedAt: null,
    author: { $nin: bannedUserIds },
  })
    .populate('author', AUTHOR_FIELDS)
    .populate('lastBidder', 'username')
    .populate('winner', 'username');
  if (!product) throw new AppError('Mahsulot topilmadi', 404);

  const bids = await Bid.find({
    product: product._id,
    round: product.round,
    isBanHidden: { $ne: true },
  })
    .sort({ amount: -1 })
    .limit(20)
    .populate('bidder', 'username avatar')
    .lean();

  res.json({ success: true, product: present(product, req.user?._id), bids });
});

// DELETE /api/products/:id  (soft delete: bazada qoladi)
exports.updateProduct = asyncHandler(async (req, res) => {
  const uploaded = (req.files || []).map((file) => `/uploads/${file.filename}`);
  let saved = false;
  try {
    const product = await findOwned(req);

    const removeSet = new Set(
      parseStringList(req.body?.removeImages)
        .map((img) => String(img).trim().replace(/\\/g, '/'))
        .filter((img) => img.startsWith('/uploads/'))
    );
    const keepImages = product.images.filter((img) => !removeSet.has(img));
    const totalImages = keepImages.length + uploaded.length;
    if (totalImages > 5) {
      throw new AppError("Mahsulotga maksimal 5 ta rasm bo'lishi mumkin");
    }

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) throw new AppError('Mahsulot nomini kiriting');
      product.title = title;
    }
    if (req.body.description !== undefined) {
      product.description = String(req.body.description).trim();
    }
    if (req.body.durationDays !== undefined) {
      const durationDays = parseInt(req.body.durationDays, 10);
      if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 30) {
        throw new AppError("Muddat 1 dan 30 kungacha bo'lishi kerak");
      }
      product.durationDays = durationDays;
      if (product.status === 'active' && product.bidCount === 0) {
        product.endsAt = new Date(Date.now() + product.durationDays * (24 * 60 * 60 * 1000));
      }
    }
    if (req.body.startingPrice !== undefined) {
      const startingPrice = Number(req.body.startingPrice);
      if (!Number.isInteger(startingPrice) || startingPrice < MIN_START_PRICE) {
        throw new AppError(`Minimal boshlang'ich narx ${MIN_START_PRICE} so'm`);
      }
      if (product.bidCount > 0) {
        throw new AppError("Takliflar bo'lgani uchun narxni o'zgartirib bo'lmaydi", 409);
      }
      product.startingPrice = startingPrice;
      product.currentPrice = startingPrice;
    }

    if (removeSet.size > 0 || uploaded.length > 0) {
      product.images = [...keepImages, ...uploaded];
    }

    await product.save();
    saved = true;
    await product.populate('author', AUTHOR_FIELDS);
    emit(req, 'product:updated', { productId: product._id }, product._id);
    res.json({ success: true, product: present(product, req.user._id) });
  } catch (err) {
    if (!saved) removeFiles(req.files);
    throw err;
  }
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await findOwned(req);
  await product.softDelete();
  emit(req, 'product:removed', { productId: product._id }, product._id);
  res.json({ success: true });
});

// POST /api/products/:id/reactivate  body: { durationDays? }
exports.reactivateProduct = asyncHandler(async (req, res) => {
  const product = await findOwned(req);
  if (product.status === 'active') throw new AppError('Mahsulot allaqachon faol', 409);

  let days;
  if (req.body?.durationDays !== undefined) {
    days = parseInt(req.body.durationDays, 10);
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      throw new AppError("Muddat 1 dan 30 kungacha bo'lishi kerak");
    }
  }

  await product.reactivate(days);
  await product.populate('author', AUTHOR_FIELDS);
  emit(req, 'product:reactivated', present(product, null), product._id);
  res.json({ success: true, product: present(product, req.user._id) });
});

// POST /api/products/:id/accept  (muallif oxirgi taklif bilan kelishdi)
exports.acceptOffer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError("Noto'g'ri ID");

  const now = new Date();
  const product = await Product.findOneAndUpdate(
    {
      _id: id,
      author: req.user._id,
      isDeleted: false,
      status: 'active',
      endsAt: { $gt: now },
      bidCount: { $gt: 0 },
    },
    [{ $set: { status: 'sold', winner: '$lastBidder', finalPrice: '$currentPrice', endedAt: now } }],
    { new: true }
  );
  if (!product) {
    throw new AppError(
      "Sotilgan deb belgilash uchun mahsulot faol, muddati o'tmagan va kamida bitta taklifli bo'lishi kerak",
      409
    );
  }

  emit(
    req,
    'product:ended',
    { productId: product._id, status: 'sold', winner: product.winner, finalPrice: product.finalPrice },
    product._id
  );
  res.json({ success: true, product });
});

// POST /api/products/:id/ban-buyer  (author bans a buyer from accessing this product)
exports.banBuyerFromProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { buyerId, reason = '' } = req.body || {};
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(buyerId)) {
    throw new AppError("Noto'g'ri ID");
  }
  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) throw new AppError('Mahsulot topilmadi', 404);
  if (String(product.author) !== String(req.user._id)) {
    throw new AppError("Bu amal faqat mahsulot egasi uchun", 403);
  }
  if (String(buyerId) === String(req.user._id)) throw new AppError("O'zingizni bloklay olmaysiz", 409);

  const buyer = await User.findById(buyerId).select('_id role isBanned');
  if (!buyer) throw new AppError('Foydalanuvchi topilmadi', 404);

  const already = product.bannedUsers?.some((b) => String(b.user) === String(buyerId));
  if (already) {
    return res.json({ success: true, message: 'Foydalanuvchi allaqachon bloklangan', product: present(product, req.user._id) });
  }

  product.bannedUsers = product.bannedUsers || [];
  product.bannedUsers.push({ user: buyerId, bannedBy: req.user._id, reason: String(reason).slice(0, 500) });
  await product.save();

  // After adding, check escalation: if buyer is banned from >=5 distinct products => global ban 10 days
  const banCount = await Product.countDocuments({ 'bannedUsers.user': buyerId });
  if (banCount >= 5 && !buyer.isBanned) {
    const now = new Date();
    const days = 10;
    buyer.isBanned = true;
    buyer.bannedAt = now;
    buyer.bannedUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    buyer.banReason = 'Bloklar soni ortishi: 5 ta mahsulotdan bloklandi';
    await buyer.save();

    // disconnect sockets and apply ban data effects
    req.app.get('io')?.in(`user:${buyer._id}`).disconnectSockets(true);
    await banUserData(buyer._id, req.app.get('io'));
    await User.updateOne(
      { _id: buyer._id, isBanned: true, bannedAt: buyer.bannedAt },
      { $set: { banDataProcessedAt: new Date() } }
    );
  }

  emit(req, 'product:updated', { productId: product._id }, product._id);
  res.json({ success: true, product: present(product, req.user._id) });
});

// POST /api/products/:id/report  (user reports a product; if reporters >=5 => delete product + ban author 5 days)
exports.reportProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError("Noto'g'ri ID");
  const product = await Product.findOne({ _id: id, isDeleted: false });
  if (!product) throw new AppError('Mahsulot topilmadi', 404);
  if (String(product.author) === String(req.user._id)) {
    throw new AppError("O'zingizni hisobot qila olmaysiz", 409);
  }

  product.reporters = product.reporters || [];
  const already = product.reporters.some((r) => String(r) === String(req.user._id));
  if (already) return res.json({ success: true, message: 'Siz allaqachon hisobot berdingiz' });

  product.reporters.push(req.user._id);
  await product.save();

  // Escalation: if >=5 distinct reporters => soft-delete product and ban author for 5 days
  if (product.reporters.length >= 5) {
    product.isDeleted = true;
    await product.save();

    const author = await User.findById(product.author).select('_id role isBanned');
    if (author && author.role !== 'admin' && !author.isBanned) {
      const now = new Date();
      const days = 5;
      author.isBanned = true;
      author.bannedAt = now;
      author.bannedUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      author.banReason = 'Mahsulotiga kamida 5 ta foydalanuvchi hisobot berdi';
      await author.save();

      req.app.get('io')?.in(`user:${author._id}`).disconnectSockets(true);
      await banUserData(author._id, req.app.get('io'));
      await User.updateOne(
        { _id: author._id, isBanned: true, bannedAt: author.bannedAt },
        { $set: { banDataProcessedAt: new Date() } }
      );
    }

    // notify feed that product removed
    emit(req, 'product:removed', { productId: product._id }, product._id);
    return res.json({ success: true, message: 'Mahsulot o‘chirildi va muallifga jazo qo‘llanildi' });
  }

  res.json({ success: true, message: 'Hisobot qabul qilindi', reporters: product.reporters.length });
});
