const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/token');
const isUserBanned = require('../utils/banStatus');

exports.protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError('Avval tizimga kiring', 401);

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError('Token yaroqsiz yoki muddati tugagan', 401);
  }

  const user = await User.findById(payload.id);
  if (!user) throw new AppError('Foydalanuvchi topilmadi', 401);
  if (await isUserBanned(user, req.app.get('io'))) {
    throw new AppError('Akkauntingiz bloklangan', 403, 'USER_BANNED');
  }

  req.user = user;
  next();
});

exports.requireAdmin = (req, _res, next) => {
  if (req.user?.role !== 'admin') {
    return next(new AppError('Bu amal faqat administrator uchun', 403));
  }
  next();
};

// Post yaratishdan oldin ishlatiladi: telefon raqam majburiy
exports.requirePhone = (req, _res, next) => {
  if (!req.user.phone) {
    return next(
      new AppError(
        "Post yaratish uchun avval profilingizga telefon raqam qo'shing",
        403,
        'PHONE_REQUIRED'
      )
    );
  }
  next();
};

// Token bo'lsa foydalanuvchini aniqlaydi, bo'lmasa mehmon sifatida o'tkazadi
exports.optionalAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      const { id } = verifyToken(header.slice(7));
      const user = await User.findById(id);
      if (user && !(await isUserBanned(user, req.app.get('io')))) req.user = user;
    }
  } catch {
    /* mehmon sifatida davom etadi */
  }
  next();
};
