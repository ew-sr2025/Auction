const express = require('express');
const cors = require('cors');
const { clientUrl } = require('./config/env');
const { uploadDir } = require('./utils/files');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: clientUrl }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/products', require('./routes/productRoutes'));

app.use((_req, res) => res.status(404).json({ success: false, message: 'Topilmadi' }));
app.use(errorHandler);

module.exports = app;
