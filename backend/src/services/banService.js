const Bid = require('../models/Bid');
const Message = require('../models/Message');
const Product = require('../models/Product');
const User = require('../models/User');
const { MIN_BID_STEP } = require('../config/constants');

const AUTHOR_FIELDS = 'username firstName lastName avatar';

const emit = (io, event, payload, productId) => {
  if (!io) return;
  let target = io.to('feed');
  if (productId) target = target.to(`product:${productId}`);
  target.emit(event, payload);
};

async function refreshActiveProduct(productId, round, io) {
  const product = await Product.findOne({
    _id: productId,
    status: 'active',
    isDeleted: false,
    banPausedAt: null,
    round,
  });
  if (!product) return;

  const [latestBid, bidCount] = await Promise.all([
    Bid.findOne({ product: productId, round, isBanHidden: { $ne: true } })
      .sort({ createdAt: -1 })
      .select('amount bidder')
      .lean(),
    Bid.countDocuments({ product: productId, round, isBanHidden: { $ne: true } }),
  ]);

  product.currentPrice = latestBid?.amount ?? product.startingPrice;
  product.lastBidder = latestBid?.bidder ?? null;
  product.bidCount = bidCount;
  await product.save();

  emit(
    io,
    'product:updated',
    {
      productId: product._id,
      currentPrice: product.currentPrice,
      bidCount: product.bidCount,
      lastBidder: product.lastBidder,
      minNextBid: product.bidCount ? product.currentPrice + MIN_BID_STEP : product.startingPrice,
    },
    product._id
  );
}

async function pauseOwnedProducts(userId, io, now) {
  const products = await Product.find({
    author: userId,
    isDeleted: false,
  }).select('_id status endsAt banPausedAt');

  if (!products.length) return;
  const toPause = products.filter(
    (product) =>
      product.status === 'active' &&
      product.endsAt > now &&
      !product.banPausedAt
  );
  if (toPause.length) {
    await Product.updateMany(
      { _id: { $in: toPause.map((product) => product._id) }, banPausedAt: null },
      { $set: { banPausedAt: now } }
    );
  }
  products.forEach((product) => emit(io, 'product:removed', { productId: product._id }, product._id));
}

async function hideActiveBids(userId, io, now) {
  const products = await Product.find({
    author: { $ne: userId },
    status: 'active',
    isDeleted: false,
    banPausedAt: null,
    endsAt: { $gt: now },
  }).select('_id round').lean();
  if (!products.length) return;

  const currentRounds = products.map(({ _id, round }) => ({ product: _id, round }));
  const bids = await Bid.find({
    bidder: userId,
    isBanHidden: { $ne: true },
    $or: currentRounds,
  }).select('_id product round').lean();
  if (!bids.length) return;

  await Bid.updateMany(
    { _id: { $in: bids.map((bid) => bid._id) }, isBanHidden: { $ne: true } },
    { $set: { isBanHidden: true, banHiddenAt: now } }
  );

  const hidden = await Bid.find({
    bidder: userId,
    isBanHidden: true,
    $or: currentRounds,
  }).select('_id product round').lean();
  const affected = new Map(hidden.map((bid) => [`${bid.product}:${bid.round}`, bid]));
  for (const bid of affected.values()) {
    await refreshActiveProduct(bid.product, bid.round, io);
  }
}

async function restoreOwnedProducts(userId, io, now) {
  const products = await Product.find({
    author: userId,
    status: 'active',
    isDeleted: false,
    banPausedAt: { $ne: null },
  });

  for (const product of products) {
    product.endsAt = new Date(product.endsAt.getTime() + now.getTime() - product.banPausedAt.getTime());
    product.banPausedAt = null;
    await product.save();
    await product.populate('author', AUTHOR_FIELDS);
    const payload = product.toObject();
    delete payload.contactPhone;
    delete payload.__v;
    emit(io, 'product:created', payload, product._id);
  }
}

async function restoreCompatibleBids(userId, io) {
  const hiddenBids = await Bid.find({ bidder: userId, isBanHidden: true })
    .select('_id product round banHiddenAt')
    .lean();
  const affected = new Map();

  for (const bid of hiddenBids) {
    const product = await Product.findOne({
      _id: bid.product,
      round: bid.round,
      status: 'active',
      isDeleted: false,
      banPausedAt: null,
      endsAt: { $gt: new Date() },
    }).select('_id round').lean();
    if (!product) continue;

    const laterBid = await Bid.exists({
      product: bid.product,
      round: bid.round,
      bidder: { $ne: userId },
      isBanHidden: { $ne: true },
      createdAt: { $gt: bid.banHiddenAt },
    });
    if (laterBid) continue;

    const result = await Bid.updateOne(
      { _id: bid._id, isBanHidden: true },
      { $set: { isBanHidden: false }, $unset: { banHiddenAt: 1 } }
    );
    if (result.modifiedCount) affected.set(`${product._id}:${product.round}`, product);
  }

  for (const product of affected.values()) {
    await refreshActiveProduct(product._id, product.round, io);
  }
}

async function restoreBannedUser(userId, io) {
  const now = new Date();
  await restoreOwnedProducts(userId, io, now);
  await restoreCompatibleBids(userId, io);
  await notifyBuyerConversations(userId, io);
}

async function notifyBuyerConversations(userId, io) {
  if (!io) return;
  const productIds = await Message.distinct('product', { buyer: userId });
  const products = await Product.find({ _id: { $in: productIds }, isDeleted: false })
    .select('_id author')
    .lean();
  for (const product of products) {
    io.to(`chat:inbox:${product._id}:${product.author}`).emit('chat:inbox:new', {
      productId: String(product._id),
      buyerId: String(userId),
    });
  }
}

exports.banUserData = async (userId, io) => {
  const now = new Date();
  await pauseOwnedProducts(userId, io, now);
  await hideActiveBids(userId, io, now);
  await notifyBuyerConversations(userId, io);
};

exports.liftBan = async (userId, io, onlyIfExpired = false) => {
  const user = await User.findById(userId).select('isBanned bannedAt bannedUntil');
  if (!user?.isBanned) return false;
  const now = new Date();
  if (onlyIfExpired && (!user.bannedUntil || user.bannedUntil > now)) return false;

  const filter = { _id: user._id, isBanned: true, bannedAt: user.bannedAt };
  if (onlyIfExpired) filter.bannedUntil = { $lte: now };
  const released = await User.updateOne(filter, {
    $set: {
      isBanned: false,
      bannedAt: null,
      bannedUntil: null,
      banReason: '',
      banDataProcessedAt: null,
    },
  });
  if (!released.modifiedCount) return false;

  await restoreBannedUser(user._id, io);
  return true;
};

exports.releaseExpiredBans = async (io) => {
  const expired = await User.find({
    isBanned: true,
    bannedUntil: { $ne: null, $lte: new Date() },
  }).select('_id');

  for (const user of expired) {
    await exports.liftBan(user._id, io, true);
  }

  const unapplied = await User.find({
    isBanned: true,
    banDataProcessedAt: null,
  }).select('_id bannedAt');
  for (const user of unapplied) {
    await exports.banUserData(user._id, io);
    await User.updateOne(
      { _id: user._id, isBanned: true, bannedAt: user.bannedAt, banDataProcessedAt: null },
      { $set: { banDataProcessedAt: new Date() } }
    );
  }
};

exports.getBannedUserIds = async () => User.find({ isBanned: true }).distinct('_id');
