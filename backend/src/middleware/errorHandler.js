module.exports = (err, _req, res, _next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Server xatosi';

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    status = 409;
    message = `Bu ${field} allaqachon band`;
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'MulterError') {
    status = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Rasm hajmi 5MB dan oshmasligi kerak'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? "Ko'pi bilan 5 ta rasm yuklash mumkin"
        : err.message;
  } else if (err.name === 'CastError') {
    status = 400;
    message = "Noto'g'ri ID";
  }

  if (status === 500) console.error(err);
  res.status(status).json({ success: false, message, code: err.code });
};
