const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const {
  getLocationOptions,
  matchReverseGeocode,
} = require('../services/uzbekistanLocations');

let lastGeocodeAt = 0;
let geocodeQueue = Promise.resolve();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function reverseGeocode(latitude, longitude) {
  const delay = Math.max(0, 1100 - (Date.now() - lastGeocodeAt));
  if (delay) await wait(delay);
  lastGeocodeAt = Date.now();

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '10',
    'accept-language': 'uz,ru,en',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        'User-Agent': 'AuctionApp/1.0 (https://github.com/ew-sr2025/Auction)',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new AppError('GPS manzil xizmati hozir javob bermayapti. Keyinroq qayta urinib ko‘ring.', 502);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

exports.getLocations = (_req, res) => {
  res.json({ success: true, ...getLocationOptions() });
};

exports.resolveGpsLocation = asyncHandler(async (req, res) => {
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 37 ||
    latitude > 46 ||
    longitude < 55 ||
    longitude > 74
  ) {
    throw new AppError("O‘zbekiston hududidagi GPS koordinatalarini yuboring");
  }

  const request = geocodeQueue.then(() => reverseGeocode(latitude, longitude));
  geocodeQueue = request.catch(() => {});
  let result;
  try {
    result = await request;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.name === 'AbortError') {
      throw new AppError('GPS manzilini aniqlash vaqti tugadi. Qayta urinib ko‘ring.', 504);
    }
    console.error('GPS reverse geocoding failed:', error);
    throw new AppError('GPS manzilini aniqlab bo‘lmadi. Manzilni ro‘yxatdan tanlang.', 502);
  }

  if (result.address?.country_code !== 'uz') {
    throw new AppError("GPS O‘zbekiston hududida emas. Viloyat va tuman/shaharni qo‘lda tanlang.", 422);
  }
  const location = matchReverseGeocode(result.address);
  if (!location) {
    throw new AppError("GPS orqali tuman aniqlanmadi. Viloyat va tuman/shaharni ro‘yxatdan tanlang.", 422);
  }

  res.json({ success: true, location });
});
