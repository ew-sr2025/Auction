const crypto = require('crypto');
const User = require('../models/User');
const EmailVerification = require('../models/EmailVerification');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendRegistrationCode } = require('../utils/email');
const generateUsername = require('../utils/generateUsername');
const { signToken } = require('../utils/token');

const sendAuth = (res, user, status = 200) =>
  res.status(status).json({ success: true, token: signToken(user._id), user });

const normalizeRegistration = (payload) => {
  const { firstName, lastName, email, username, birthDate, password } = payload || {};

  if (
    typeof firstName !== 'string' ||
    !firstName.trim() ||
    typeof lastName !== 'string' ||
    !lastName.trim() ||
    typeof email !== 'string' ||
    !email.trim() ||
    !birthDate ||
    typeof password !== 'string' ||
    !password
  ) {
    throw new AppError("Ism, familya, email, tug'ilgan sana va parol majburiy");
  }
  if (password.length < 6) {
    throw new AppError("Parol kamida 6 ta belgidan iborat bo'lishi kerak");
  }
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    throw new AppError("Email noto'g'ri");
  }

  const birth = new Date(birthDate);
  if (isNaN(birth) || birth >= new Date()) {
    throw new AppError("Tug'ilgan sana noto'g'ri");
  }

  const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
  if (normalizedUsername && !/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
    throw new AppError("Username 3-20 belgi: lotin harflari, raqam va _ bo'lishi mumkin");
  }

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim().toLowerCase(),
    username: normalizedUsername,
    birthDate: birth,
    password,
  };
};

const checkRegistrationAvailability = async ({ email, username }) => {
  if (await User.exists({ email })) {
    throw new AppError('Bu email allaqachon band', 409);
  }
  if (username && (await User.exists({ username }))) {
    throw new AppError('Bu username allaqachon band', 409);
  }
};

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_DELAY_MS = 2 * 60 * 1000;
const VERIFICATION_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

const createCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

const deliverCode = async (email, { allowResend }) => {
  let verification = await EmailVerification.findOne({ email }).select('+codeHash');
  if (verification && !allowResend) {
    return { resendAt: verification.resendAt, sent: false };
  }

  const now = new Date();
  if (verification && verification.resendAt > now) {
    throw new AppError('Yangi kodni 2 daqiqadan keyin yuborishingiz mumkin', 429);
  }

  const code = createCode();
  const previous = verification
    ? {
        codeHash: verification.codeHash,
        expiresAt: verification.expiresAt,
        resendAt: verification.resendAt,
        attempts: verification.attempts,
        cleanupAt: verification.cleanupAt,
      }
    : null;

  if (!verification) verification = new EmailVerification({ email });
  verification.codeHash = hashCode(code);
  verification.expiresAt = new Date(now.getTime() + CODE_LIFETIME_MS);
  verification.resendAt = new Date(now.getTime() + RESEND_DELAY_MS);
  verification.cleanupAt = new Date(now.getTime() + VERIFICATION_RETENTION_MS);
  verification.attempts = 0;
  await verification.save();

  try {
    await sendRegistrationCode(email, code);
  } catch (err) {
    if (previous) {
      Object.assign(verification, previous);
      await verification.save();
    } else {
      await EmailVerification.deleteOne({ _id: verification._id });
    }
    console.error('Registration verification email delivery failed:', err);
    throw new AppError('Email yuborilmadi. Pochta serveri sozlamalarini tekshiring', 503);
  }

  return { resendAt: verification.resendAt, sent: true };
};

// POST /api/auth/register/code
exports.requestRegistrationCode = asyncHandler(async (req, res) => {
  const registration = normalizeRegistration(req.body);
  await checkRegistrationAvailability(registration);
  const result = await deliverCode(registration.email, { allowResend: false });
  res.json({ success: true, ...result });
});

// POST /api/auth/register/resend
exports.resendRegistrationCode = asyncHandler(async (req, res) => {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) throw new AppError('Emailni kiriting');
  await checkRegistrationAvailability({ email, username: '' });

  const result = await deliverCode(email, { allowResend: true });
  res.json({ success: true, ...result });
});

// POST /api/auth/register/verify
exports.verifyRegistration = asyncHandler(async (req, res) => {
  const registration = normalizeRegistration(req.body);
  const { code } = req.body || {};
  await checkRegistrationAvailability(registration);

  const verification = await EmailVerification.findOne({ email: registration.email }).select(
    '+codeHash'
  );
  if (!verification || verification.expiresAt <= new Date()) {
    throw new AppError('Tasdiqlash kodi topilmadi yoki muddati tugadi');
  }
  if (verification.attempts >= MAX_CODE_ATTEMPTS) {
    throw new AppError('Urinishlar soni tugadi. Yangi kod yuboring', 429);
  }
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new AppError('6 xonali tasdiqlash kodini kiriting');
  }

  const submittedHash = Buffer.from(hashCode(code), 'hex');
  const storedHash = Buffer.from(verification.codeHash, 'hex');
  if (!crypto.timingSafeEqual(submittedHash, storedHash)) {
    await EmailVerification.updateOne({ _id: verification._id }, { $inc: { attempts: 1 } });
    throw new AppError('Tasdiqlash kodi noto‘g‘ri');
  }

  // username ixtiyoriy: berilmasa user4523 kabi tasodifiy yaratiladi
  const username = registration.username || (await generateUsername());
  const user = await User.create({ ...registration, username });
  await EmailVerification.deleteOne({ _id: verification._id });
  sendAuth(res, user, 201);
});

// POST /api/auth/login   body: { identifier, password }  (username yoki email)
exports.login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    throw new AppError('Username/email va parolni kiriting');
  }

  const id = identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: id }, { username: id }],
  }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError("Username/email yoki parol noto'g'ri", 401);
  }

  sendAuth(res, user);
});

// GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});
