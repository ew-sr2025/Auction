const mongoose = require('mongoose');
const Product = require('../models/Product');
const Bid = require('../models/Bid');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { removeFiles } = require('../utils/files');
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
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const filter = { status: 'active', isDeleted: false, endsAt: { $gt: new Date() } };
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
  const items = await Product.find({ author: req.user._id, isDeleted: false })
    .sort({ createdAt: -1 })
    .populate('lastBidder', 'username')
    .populate('winner', 'username firstName lastName phone');

  res.json({ success: true, items: items.map((p) => present(p, req.user._id)) });
});

// GET /api/products/:id
exports.getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new AppError("Noto'g'ri ID");

  const product = await Product.findOne({ _id: id, isDeleted: false })
    .populate('author', AUTHOR_FIELDS)
    .populate('lastBidder', 'username')
    .populate('winner', 'username');
  if (!product) throw new AppError('Mahsulot topilmadi', 404);

  const bids = await Bid.find({ product: product._id, round: product.round })
    .sort({ amount: -1 })
    .limit(20)
    .populate('bidder', 'username avatar')
    .lean();

  res.json({ success: true, product: present(product, req.user?._id), bids });
});

// DELETE /api/products/:id  (soft delete: bazada qoladi)
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
