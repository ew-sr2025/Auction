const { Server } = require('socket.io');
const User = require('../models/User');
const Product = require('../models/Product');
const Message = require('../models/Message');
const mongoose = require('mongoose');
const { verifyToken } = require('../utils/token');
const { placeBid } = require('../services/bidService');
const { clientUrl } = require('../config/env');
const { MIN_BID_STEP } = require('../config/constants');

module.exports = function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: clientUrl, methods: ['GET', 'POST'] },
  });

  // Auth: client `io(url, { auth: { token } })` ko'rinishida ulanadi.
  // Token yo'q bo'lsa — mehmon (faqat kuzata oladi, taklif bera olmaydi).
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();
    try {
      const { id } = verifyToken(token);
      const user = await User.findById(id).select('_id username').lean();
      if (!user) return next(new Error('Unauthorized'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Umumiy lenta (mahsulotlar ro'yxati real vaqtda yangilanishi uchun)
    socket.on('feed:join', () => socket.join('feed'));
    socket.on('feed:leave', () => socket.leave('feed'));

    // Bitta mahsulot sahifasi
    socket.on('product:join', (productId) => socket.join(`product:${productId}`));
    socket.on('product:leave', (productId) => socket.leave(`product:${productId}`));

    socket.on('chat:join', async ({ productId, buyerId } = {}, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (!socket.user) throw new Error('Yozishmalar uchun tizimga kiring');
        if (!mongoose.isValidObjectId(productId)) throw new Error("Noto'g'ri mahsulot ID");
        const product = await Product.findOne({ _id: productId, isDeleted: false })
          .select('author')
          .lean();
        if (!product) throw new Error('Mahsulot topilmadi');

        const isAuthor = String(product.author) === String(socket.user._id);
        const conversationBuyerId = isAuthor ? buyerId : String(socket.user._id);
        if (!mongoose.isValidObjectId(conversationBuyerId) ||
            String(conversationBuyerId) === String(product.author)) {
          throw new Error('Suhbat topilmadi');
        }
        if (isAuthor && !(await Message.exists({ product: productId, buyer: conversationBuyerId }))) {
          throw new Error('Suhbat topilmadi');
        }
        if (!isAuthor && buyerId && String(buyerId) !== String(socket.user._id)) {
          throw new Error('Bu suhbatga ruxsatingiz yo‘q');
        }

        socket.join(`chat:${productId}:${conversationBuyerId}`);
        reply({ ok: true });
      } catch (err) {
        reply({ ok: false, message: err.message });
      }
    });

    socket.on('chat:leave', ({ productId, buyerId } = {}) => {
      if (productId && buyerId) socket.leave(`chat:${productId}:${buyerId}`);
    });

    socket.on('chat:watch', async ({ productId } = {}, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (!socket.user) throw new Error('Yozishmalar uchun tizimga kiring');
        if (!mongoose.isValidObjectId(productId)) throw new Error("Noto'g'ri mahsulot ID");
        const product = await Product.findOne({
          _id: productId,
          author: socket.user._id,
          isDeleted: false,
        }).select('_id').lean();
        if (!product) throw new Error('Bu amal faqat mahsulot egasi uchun');
        socket.join(`chat:inbox:${productId}:${socket.user._id}`);
        reply({ ok: true });
      } catch (err) {
        reply({ ok: false, message: err.message });
      }
    });

    // Taklif berish: socket.emit('bid:place', { productId, amount }, (res) => {...})
    socket.on('bid:place', async ({ productId, amount } = {}, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (!socket.user) throw Object.assign(new Error('Taklif berish uchun tizimga kiring'), { statusCode: 401 });

        const { product, bid } = await placeBid(socket.user._id, productId, amount);

        const payload = {
          productId: product._id,
          amount: bid.amount,
          bidCount: product.bidCount,
          minNextBid: bid.amount + MIN_BID_STEP,
          endsAt: product.endsAt,
          bidder: { _id: socket.user._id, username: socket.user.username },
          at: bid.createdAt,
        };
        io.to(`product:${product._id}`).emit('bid:new', payload);
        io.to('feed').emit('product:updated', {
          productId: product._id,
          currentPrice: product.currentPrice,
          bidCount: product.bidCount,
        });

        reply({ ok: true, bid: payload });
      } catch (err) {
        reply({ ok: false, message: err.message, code: err.code, status: err.statusCode || 500 });
      }
    });
  });

  return io;
};
