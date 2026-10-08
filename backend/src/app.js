const express = require('express');
const cors = require('cors');
const path = require('path');
const { clientUrl } = require('./config/env');
const { uploadDir } = require('./utils/files');
const errorHandler = require('./middleware/errorHandler');
const Product = require('./models/Product');
const User = require('./models/User');
const isUserBanned = require('./utils/banStatus');

const app = express();

app.use(cors({ origin: clientUrl }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', async (req, res, next) => {
  const filename = path.basename(req.path);
  if (!filename || req.path !== `/${filename}`) return res.sendStatus(404);

  try {
    const url = `/uploads/${filename}`;
    const [products, avatarOwners] = await Promise.all([
      Product.find({ images: url }).select('author').lean(),
      User.find({ avatar: url }).select('_id isBanned bannedUntil'),
    ]);
    const ownerIds = [...new Set([
      ...products.map((product) => String(product.author)),
      ...avatarOwners.map((owner) => String(owner._id)),
    ])];
    if (ownerIds.length) {
      const owners = await User.find({ _id: { $in: ownerIds } }).select('_id isBanned bannedUntil');
      for (const owner of owners) {
        if (await isUserBanned(owner, req.app.get('io'))) return res.sendStatus(404);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}, express.static(uploadDir));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/site', require('./routes/siteRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/products', require('./routes/productRoutes'));

app.use((_req, res) => res.status(404).json({ success: false, message: 'Topilmadi' }));
app.use(errorHandler);

module.exports = app;
