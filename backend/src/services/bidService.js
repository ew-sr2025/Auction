const mongoose = require('mongoose');
const Product = require('../models/Product');
const Bid = require('../models/Bid');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { MIN_BID_STEP } = require('../config/constants');
const isUserBanned = require('../utils/banStatus');
const { banUserData } = require('./banService');

/**
 * Taklif berish. Atomik findOneAndUpdate ishlatilgani uchun
 * bir vaqtda kelgan ikki taklif bir-birini buzmaydi.
 */
exports.placeBid = async (userId, productId, rawAmount, io) => {
  if (!mongoose.isValidObjectId(productId)) throw new AppError("Noto'g'ri mahsulot ID");
  const bidder = await User.findById(userId).select('isBanned bannedUntil');
  if (!bidder || await isUserBanned(bidder, io)) {
    throw new AppError('Akkauntingiz bloklangan', 403, 'USER_BANNED');
  }
  const amount = Number(rawAmount);
  if (!Number.isInteger(amount) || amount <= 0) throw new AppError("Taklif summasi noto'g'ri");

  const now = new Date();
  const updated = await Product.findOneAndUpdate(
    {
      _id: productId,
      status: 'active',
      isDeleted: false,
      banPausedAt: null,
      endsAt: { $gt: now },
      author: { $ne: userId },
      $or: [
        { bidCount: 0, startingPrice: { $lte: amount } }, // birinchi taklif
        { bidCount: { $gt: 0 }, currentPrice: { $lte: amount - MIN_BID_STEP } },
      ],
    },
    { $set: { currentPrice: amount, lastBidder: userId }, $inc: { bidCount: 1 } },
    { new: true }
  );

  if (!updated) {
    // Rad etilish sababini aniqlaymiz
    const p = await Product.findById(productId).lean();
    if (!p || p.isDeleted) throw new AppError('Mahsulot topilmadi', 404);
    if (String(p.author) === String(userId)) throw new AppError("O'z mahsulotingizga taklif bera olmaysiz", 403);
    if (p.status !== 'active' || p.endsAt <= now) throw new AppError('Auksion yakunlangan', 409, 'AUCTION_CLOSED');
    const min = p.bidCount === 0 ? p.startingPrice : p.currentPrice + MIN_BID_STEP;
    throw new AppError(`Taklif kamida ${min} so'm bo'lishi kerak`, 409, 'BID_TOO_LOW');
  }

  const bid = await Bid.create({
    product: updated._id,
    bidder: userId,
    amount,
    round: updated.round,
  });

  const latestBidder = await User.findById(userId).select('isBanned bannedUntil');
  if (!latestBidder || await isUserBanned(latestBidder, io)) {
    await banUserData(userId, io);
    throw new AppError('Akkauntingiz bloklangan', 403, 'USER_BANNED');
  }

  return { product: updated, bid };
};
