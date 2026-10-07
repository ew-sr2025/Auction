const User = require('../models/User');
const { liftBan } = require('../services/banService');

module.exports = async function isUserBanned(user, io) {
  if (!user?.isBanned) return false;

  const now = new Date();
  if (!user.bannedUntil || new Date(user.bannedUntil) > now) return true;

  if (await liftBan(user._id, io, true)) return false;
  const current = await User.findById(user._id).select('isBanned bannedUntil').lean();
  return Boolean(current?.isBanned && (!current.bannedUntil || new Date(current.bannedUntil) > now));
};
