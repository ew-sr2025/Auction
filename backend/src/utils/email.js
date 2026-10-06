const nodemailer = require('nodemailer');
const { emailFrom, smtpHost, smtpPass, smtpPort, smtpUser } = require('../config/env');

exports.sendRegistrationCode = async (email, code) => {
  if (!smtpHost || !smtpUser || !smtpPass || !emailFrom) {
    throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASS va EMAIL_FROM sozlamalari talab qilinadi');
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: emailFrom,
    to: email,
    subject: 'Ro‘yxatdan o‘tish uchun tasdiqlash kodi',
    text: `Tasdiqlash kodingiz: ${code}. Kod 10 daqiqa davomida amal qiladi.`,
  });
};
