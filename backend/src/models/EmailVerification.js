const mongoose = require('mongoose');

const emailVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    resendAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    cleanupAt: { type: Date, required: true },
  },
  { timestamps: true }
);

emailVerificationSchema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('EmailVerification', emailVerificationSchema);
