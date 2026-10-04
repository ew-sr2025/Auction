const Product = require('../models/Product');
const { DAY, EXTENSION_DAYS, SCHEDULER_INTERVAL_MS } = require('../config/constants');

let running = false;

async function tick(io) {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const due = await Product.find({
      status: 'active',
      isDeleted: false,
      endsAt: { $lte: now },
    })
      .select('_id bidCount extensionUsed endsAt')
      .lean();

    for (const p of due) {
      const room = `product:${p._id}`;
      const base = { _id: p._id, status: 'active', endsAt: p.endsAt };

      if (p.bidCount > 0) {
        // Taklif bor edi -> yakunlandi, g'olib = oxirgi taklif egasi
        const doc = await Product.findOneAndUpdate(
          base,
          [{ $set: { status: 'sold', winner: '$lastBidder', finalPrice: '$currentPrice', endedAt: now } }],
          { new: true }
        );
        if (doc) {
          const payload = { productId: doc._id, status: doc.status, winner: doc.winner, finalPrice: doc.finalPrice };
          io.to(room).to('feed').emit('product:ended', payload);
        }
      } else if (!p.extensionUsed) {
        // Hech kim taklif bermadi -> bir marta +2 kun
        const newEnd = new Date(p.endsAt.getTime() + EXTENSION_DAYS * DAY);
        const doc = await Product.findOneAndUpdate(
          { ...base, extensionUsed: false },
          { $set: { endsAt: newEnd, extensionUsed: true } },
          { new: true }
        );
        if (doc) io.to(room).to('feed').emit('product:extended', { productId: doc._id, endsAt: doc.endsAt });
      } else {
        // Uzaytirilgan muddat ham tugadi -> faol emas (author reactivate qilishi mumkin)
        const doc = await Product.findOneAndUpdate(
          base,
          { $set: { status: 'expired', endedAt: now } },
          { new: true }
        );
        if (doc) io.to(room).to('feed').emit('product:ended', { productId: doc._id, status: 'expired' });
      }
    }
  } catch (err) {
    console.error('Scheduler xatosi:', err);
  } finally {
    running = false;
  }
}

exports.startAuctionScheduler = (io) => {
  tick(io);
  return setInterval(() => tick(io), SCHEDULER_INTERVAL_MS);
};
