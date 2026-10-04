const DAY = 24 * 60 * 60 * 1000;

module.exports = {
  DAY,
  MIN_START_PRICE: 50000, // so'm
  MIN_BID_STEP: 1000, // har bir yangi taklif oldingisidan kamida shuncha ko'p
  DEFAULT_DURATION_DAYS: 5,
  EXTENSION_DAYS: 2, // hech kim taklif bermasa, bir marta uzaytiriladi
  SCHEDULER_INTERVAL_MS: 30 * 1000,
  PHONE_REGEX: /^\+?[0-9]{9,15}$/,
};
