const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

exports.signToken = (userId) =>
  jwt.sign({ id: userId }, jwtSecret, { expiresIn: jwtExpiresIn });

exports.verifyToken = (token) => jwt.verify(token, jwtSecret);
