const mongoose = require('mongoose');
const {
  DAY,
  MIN_START_PRICE,
  DEFAULT_DURATION_DAYS,
  PHONE_REGEX,
} = require('../config/constants');

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 2000 },
    images: [{ type: String }],

    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // post yaratilgan paytdagi aloqa raqami (profildan olinadi, majburiy)
    contactPhone: {
      type: String,
      required: true,
      match: [PHONE_REGEX, "Telefon raqam noto'g'ri"],
    },

    // Narx
    startingPrice: { type: Number, required: true, min: MIN_START_PRICE },
    currentPrice: { type: Number }, // eng oxirgi taklif (taklif bo'lmasa = startingPrice)
    lastBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    bidCount: { type: Number, default: 0 },

    // Muddat
    durationDays: { type: Number, default: DEFAULT_DURATION_DAYS, min: 1, max: 30 },
    startsAt: { type: Date },
    endsAt: { type: Date },
    banPausedAt: { type: Date, default: null },
    extensionUsed: { type: Boolean, default: false }, // +2 kun berilganmi

    // Holat: active -> sold (taklif bor edi / kelishildi) yoki expired (taklif bo'lmadi)
    status: {
      type: String,
      enum: ['active', 'sold', 'expired'],
      default: 'active',
    },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    finalPrice: { type: Number, default: null },
    endedAt: { type: Date, default: null },
    round: { type: Number, default: 1 }, // reactivate qilinganda +1

    bannedUsers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, default: '', maxlength: 500 },
        bannedAt: { type: Date, default: Date.now },
      },
    ],
    reporters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Soft delete: author o'chirsa ham bazada qoladi
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

productSchema.index({ status: 1, isDeleted: 1, endsAt: 1 });
productSchema.index({ author: 1, isDeleted: 1, createdAt: -1 });

productSchema.pre('validate', function (next) {
  if (this.isNew) {
    this.currentPrice = this.startingPrice;
    this.startsAt = new Date();
    this.endsAt = new Date(Date.now() + this.durationDays * DAY);
  }
  next();
});

// Qayta faollashtirish: yangi davr boshlanadi
productSchema.methods.reactivate = function (durationDays) {
  this.durationDays = durationDays || this.durationDays;
  this.status = 'active';
  this.round += 1;
  this.currentPrice = this.startingPrice;
  this.lastBidder = null;
  this.bidCount = 0;
  this.winner = null;
  this.finalPrice = null;
  this.endedAt = null;
  this.extensionUsed = false;
  this.startsAt = new Date();
  this.endsAt = new Date(Date.now() + this.durationDays * DAY);
  return this.save();
};

productSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Product', productSchema);
