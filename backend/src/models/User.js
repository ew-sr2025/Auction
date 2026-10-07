const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { PHONE_REGEX } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email noto'g'ri"],
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9_]{3,20}$/,
        "Username 3-20 belgi: lotin harflari, raqam va _ bo'lishi mumkin",
      ],
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isBanned: { type: Boolean, default: false },
    bannedAt: { type: Date, default: null },
    bannedUntil: { type: Date, default: null },
    banReason: { type: String, default: '', maxlength: 500 },
    banDataProcessedAt: { type: Date, default: null },
    password: { type: String, required: true, minlength: 6, select: false },
    birthDate: { type: Date },

    // Profilni tahrirlashda to'ldiriladi
    avatar: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },
    phone: {
      type: String,
      default: '',
      validate: {
        validator: (v) => v === '' || PHONE_REGEX.test(v),
        message: "Telefon raqam noto'g'ri (masalan +998901234567)",
      },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
