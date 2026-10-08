import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';

let locationOptionsRequest;
const loadLocationOptions = () => {
  if (!locationOptionsRequest) {
    locationOptionsRequest = api.get('/products/locations')
      .then(({ data }) => data)
      .catch((error) => {
        locationOptionsRequest = null;
        throw error;
      });
  }
  return locationOptionsRequest;
};

const geolocationError = (error) => {
  if (error.code === 1) return 'Joylashuvga ruxsat berilmadi. Brauzer sozlamalaridan GPS ruxsatini yoqing.';
  if (error.code === 2) return 'GPS joylashuvni aniqlab bo‘lmadi. GPS yoqilganini tekshirib, qayta urinib ko‘ring.';
  if (error.code === 3) return 'GPS so‘rovi vaqt tugagani sababli bekor bo‘ldi. Qayta urinib ko‘ring.';
  return 'GPS joylashuvni aniqlashda xatolik yuz berdi.';
};

export default function LocationPicker({ value, onChange }) {
  const [regions, setRegions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [regionId, setRegionId] = useState(value?.regionId ? String(value.regionId) : '');
  const [districtId, setDistrictId] = useState(value?.districtId ? String(value.districtId) : '');
  const [error, setError] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingGps, setLoadingGps] = useState(false);

  useEffect(() => {
    let active = true;
    loadLocationOptions()
      .then((options) => {
        if (!active) return;
        setRegions(options.regions);
        setDistricts(options.districts);
      })
      .catch((loadError) => {
        if (active) setError(errMsg(loadError));
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => { active = false; };
  }, []);

  const availableDistricts = districts.filter((district) => String(district.regionId) === regionId);
  const saveDistrict = (newDistrictId, newRegionId = regionId) => {
    setDistrictId(newDistrictId);
    const region = regions.find((item) => String(item.id) === newRegionId);
    const district = districts.find((item) => String(item.id) === newDistrictId);
    if (!region || !district) {
      onChange(null);
      return;
    }
    onChange({
      regionId: region.id,
      districtId: district.id,
      regionName: region.name,
      districtName: district.name,
    });
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError('Bu brauzer GPS joylashuvni aniqlashni qo‘llab-quvvatlamaydi.');
      return;
    }
    setLoadingGps(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { data } = await api.post('/products/location/resolve', {
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          const resolved = data.location;
          setRegionId(String(resolved.regionId));
          setDistrictId(String(resolved.districtId));
          onChange(resolved);
        } catch (resolveError) {
          setError(errMsg(resolveError));
        } finally {
          setLoadingGps(false);
        }
      },
      (locationError) => {
        setError(geolocationError(locationError));
        setLoadingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="location-picker">
      {error && <div className="alert error">{error}</div>}
      <div className="row2">
        <label>
          Viloyat yoki shahar
          <select
            value={regionId}
            required
            aria-label="Viloyat yoki shahar"
            onChange={(event) => {
              setRegionId(event.target.value);
              setDistrictId('');
              onChange(null);
            }}
            disabled={loadingOptions}
          >
            <option value="">{loadingOptions ? 'Yuklanmoqda...' : 'Viloyatni tanlang'}</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>{region.name}</option>
            ))}
          </select>
        </label>
        <label>
          Tuman yoki shahar
          <select
            value={districtId}
            required
            aria-label="Tuman yoki shahar"
            onChange={(event) => saveDistrict(event.target.value)}
            disabled={!regionId || loadingOptions}
          >
            <option value="">Tuman/shaharni tanlang</option>
            {availableDistricts.map((district) => (
              <option key={district.id} value={district.id}>{district.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="location-picker-actions">
        <button type="button" className="btn" onClick={detectLocation} disabled={loadingGps || loadingOptions}>
          {loadingGps ? 'GPS aniqlanmoqda...' : 'GPS orqali hududni aniqlash'}
        </button>
      </div>
      <p className="muted small">GPS aniqlanganda koordinatalar OpenStreetMap xizmatiga faqat tuman/shaharni topish uchun yuboriladi; saytda saqlanmaydi yoki ko‘rsatilmaydi.</p>
    </div>
  );
}
