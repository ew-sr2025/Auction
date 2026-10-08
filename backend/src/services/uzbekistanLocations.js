const locationData = require('../data/uzbekistanLocations.json');
const AppError = require('../utils/AppError');

const cleanName = (value) =>
  transliterate(String(value || '').toLowerCase())
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ʻʼ`'’‘]/g, '')
    .replace(/\b(republic|respublikasi|viloyati|viloyat|region|oblast|district|tumani|tuman|shahri|shahar|city|county|rayon|gorod|район|область|республика|город|тумани|вилояти|шахри)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

function transliterate(value) {
  const chars = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j',
    з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'i', ь: '', э: 'e',
    ю: 'yu', я: 'ya', ў: 'o', ғ: 'g', қ: 'q', ҳ: 'h',
  };
  return value.replace(/[а-яёўғқҳ]/g, (char) => chars[char] ?? char);
}

const namesOf = (item) => [item.nameUz, item.nameCyrl, item.nameRu];
const regionById = new Map(locationData.regions.map((region) => [region.id, region]));
const districtById = new Map(locationData.districts.map((district) => [district.id, district]));

exports.getLocationOptions = () => ({
  regions: locationData.regions.map(({ id, nameUz }) => ({ id, name: nameUz })),
  districts: locationData.districts.map(({ id, regionId, nameUz }) => ({
    id,
    regionId,
    name: nameUz,
  })),
});

exports.getCanonicalLocation = (regionIdValue, districtIdValue) => {
  if (
    !['string', 'number'].includes(typeof regionIdValue) ||
    !['string', 'number'].includes(typeof districtIdValue) ||
    String(regionIdValue).trim() === '' ||
    String(districtIdValue).trim() === ''
  ) {
    throw new AppError("Viloyat va tuman/shaharni to'g'ri tanlang");
  }
  const regionId = Number(regionIdValue);
  const districtId = Number(districtIdValue);
  if (!Number.isSafeInteger(regionId) || !Number.isSafeInteger(districtId)) {
    throw new AppError("Viloyat va tuman/shaharni to'g'ri tanlang");
  }
  const region = regionById.get(regionId);
  const district = districtById.get(districtId);
  if (!region || !district || district.regionId !== regionId) {
    throw new AppError("Viloyat va tuman/shaharni to'g'ri tanlang");
  }
  return {
    regionId,
    districtId,
    regionName: region.nameUz,
    districtName: district.nameUz,
  };
};

exports.getLocationFilter = (regionIdValue, districtIdValue) => {
  const hasRegion = regionIdValue !== undefined && String(regionIdValue).trim() !== '';
  const hasDistrict = districtIdValue !== undefined && String(districtIdValue).trim() !== '';
  if (!hasRegion && !hasDistrict) return null;

  const regionId = hasRegion ? Number(regionIdValue) : null;
  const districtId = hasDistrict ? Number(districtIdValue) : null;
  if (
    (hasRegion && !Number.isSafeInteger(regionId)) ||
    (hasDistrict && !Number.isSafeInteger(districtId))
  ) {
    throw new AppError("Viloyat yoki tuman/shahar filtri noto'g'ri");
  }
  if (hasRegion && !regionById.has(regionId)) {
    throw new AppError("Viloyat filtri ro'yxatda topilmadi");
  }
  const district = hasDistrict ? districtById.get(districtId) : null;
  if (hasDistrict && (!district || (hasRegion && district.regionId !== regionId))) {
    throw new AppError("Tuman/shahar tanlangan viloyatga mos emas");
  }
  return {
    ...(hasRegion ? { 'location.regionId': regionId } : {}),
    ...(hasDistrict ? { 'location.districtId': districtId } : {}),
  };
};

const fields = ['county', 'city_district', 'municipality', 'district', 'city', 'town', 'village'];
const isCityField = (field) => ['city', 'town', 'village'].includes(field);

const regionCandidates = locationData.regions.map((region) => ({
  region,
  keys: namesOf(region).map(cleanName),
}));
const districtCandidates = locationData.districts.map((district) => ({
  district,
  keys: namesOf(district).map(cleanName),
}));

exports.matchReverseGeocode = (address) => {
  const regionValues = [address?.state, address?.region, address?.province, address?.state_district]
    .filter(Boolean)
    .map(cleanName);
  let possibleRegions = regionCandidates.filter(({ keys }) =>
    regionValues.some((value) => keys.includes(value))
  );
  if (possibleRegions.length > 1) {
    for (const field of fields) {
      const key = cleanName(address[field]);
      if (!key) continue;
      const matches = possibleRegions.filter(({ region }) =>
        districtCandidates.some(({ district, keys }) =>
          district.regionId === region.id && keys.includes(key)
        )
      );
      if (matches.length === 1) {
        possibleRegions = matches;
        break;
      }
    }
  }
  if (!possibleRegions.length) return null;
  const regionKey = possibleRegions[0].region.id;

  for (const field of fields) {
    const key = cleanName(address[field]);
    if (!key) continue;
    const matches = districtCandidates.filter(({ district, keys }) =>
      district.regionId === regionKey && keys.includes(key)
    );
    if (!matches.length) continue;

    const preferred = matches.find(({ district }) =>
      isCityField(field) ? /shahri|shahar/i.test(district.nameUz) : /tumani|tuman/i.test(district.nameUz)
    ) || matches[0];
    const region = regionById.get(regionKey);
    return {
      regionId: region.id,
      districtId: preferred.district.id,
      regionName: region.nameUz,
      districtName: preferred.district.nameUz,
    };
  }
  return null;
};
