// .env o'zgaruvchi nomlari boshqacha bo'lsa, faqat shu faylni moslang.
require('dotenv').config();

const env = {
  port: process.env.PORT || 5000,
  mongoUri:
    process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || process.env.JWT_CODE,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || '*',
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  emailFrom: process.env.EMAIL_FROM,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
};

if (!env.mongoUri) throw new Error('.env da MONGO_URI topilmadi');
if (!env.jwtSecret) throw new Error('.env da JWT_SECRET topilmadi');

module.exports = env;
