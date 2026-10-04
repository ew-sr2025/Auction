const mongoose = require('mongoose');
const { mongoUri } = require('./env');

module.exports = async function connectDB() {
  await mongoose.connect(mongoUri);
  console.log('MongoDB ulandi:', mongoose.connection.host);
};
