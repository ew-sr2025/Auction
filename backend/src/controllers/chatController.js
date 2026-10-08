const Message = require('../models/Message');
const Product = require('../models/Product');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { getBannedUserIds } = require('../services/banService');

exports.listConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [productIds, bannedUserIds] = await Promise.all([
    Product.find({ author: userId }).distinct('_id'),
    getBannedUserIds(),
  ]);

  const match = {
    $or: [{ buyer: userId }],
  };
  if (productIds.length) match.$or.push({ product: { $in: productIds } });

  const latest = await Message.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $match: {
        'product.isDeleted': false,
        'product.banPausedAt': null,
        'product.author': { $nin: bannedUserIds },
        buyer: { $nin: bannedUserIds },
      },
    },
    {
      $group: {
        _id: { product: '$product._id', buyer: '$buyer' },
        message: { $first: '$$ROOT' },
      },
    },
    { $sort: { 'message.createdAt': -1 } },
    { $limit: 100 },
    {
      $project: {
        _id: 0,
        buyerId: '$_id.buyer',
        productId: '$_id.product',
        message: 1,
        product: {
          _id: '$message.product._id',
          title: '$message.product.title',
          images: '$message.product.images',
          status: '$message.product.status',
          author: '$message.product.author',
        },
      },
    },
  ]);

  const users = await User.find({
    _id: {
      $in: [...new Set(latest.flatMap(({ buyerId, message, product }) => [
        String(buyerId),
        String(message.sender),
        String(product.author),
      ]))],
    },
  })
    .select('username firstName lastName avatar')
    .lean();
  const usersById = new Map(users.map((user) => [String(user._id), user]));

  res.json({
    success: true,
    conversations: latest.map(({ buyerId, product, message }) => {
      const buyer = usersById.get(String(buyerId));
      const authorId = String(product.author);
      const author = usersById.get(authorId);
      const participant = String(authorId) === String(userId) ? buyer : author;
      if (!buyer || !author || !participant) return null;

      return {
        product,
        buyer,
        participant,
        message: {
          _id: message._id,
          text: message.text,
          createdAt: message.createdAt,
          sender: usersById.get(String(message.sender)),
        },
      };
    }).filter(Boolean),
  });
});
