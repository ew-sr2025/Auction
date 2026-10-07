const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    round: { type: Number, default: 1 }, // mahsulotning qaysi davriga tegishli
    isBanHidden: { type: Boolean, default: false },
    banHiddenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

bidSchema.index({ product: 1, round: 1, amount: -1 });
bidSchema.index({ bidder: 1, createdAt: -1 });

module.exports = mongoose.model('Bid', bidSchema);
