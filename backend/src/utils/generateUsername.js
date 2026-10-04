const User = require('../models/User');

// "user4523" ko'rinishidagi noyob username yaratadi
module.exports = async function generateUsername() {
  for (let i = 0; i < 10; i++) {
    const candidate = `user${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `user${Date.now().toString().slice(-8)}`;
};
