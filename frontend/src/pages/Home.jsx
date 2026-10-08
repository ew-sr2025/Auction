import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../api';
import { useSocket } from '../context/SocketContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Home() {
  const socket = useSocket();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [regionId, setRegionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('newest');
  const [appliedFilters, setAppliedFilters] = useState({
    q: '',
    regionId: '',
    districtId: '',
    minPrice: '',
    maxPrice: '',
    sort: 'newest',
  });
  const [locationOptions, setLocationOptions] = useState({ regions: [], districts: [] });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filtersRef = useRef(appliedFilters);
  filtersRef.current = appliedFilters;

  useEffect(() => {
    let cancelled = false;
    api.get('/products/locations')
      .then(({ data }) => {
        if (!cancelled) setLocationOptions({ regions: data.regions, districts: data.districts });
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(
    async (pageToLoad, replace) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/products', {
          params: {
            q: appliedFilters.q || undefined,
            sort: appliedFilters.sort,
            regionId: appliedFilters.regionId || undefined,
            districtId: appliedFilters.districtId || undefined,
            minPrice: appliedFilters.minPrice || undefined,
            maxPrice: appliedFilters.maxPrice || undefined,
            page: pageToLoad,
            limit: 20,
          },
        });
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
        setPage(data.page);
        setPages(data.pages);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters]
  );

  useEffect(() => {
    load(1, true);
  }, [load]);

  // Real vaqt yangilanishlari
  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit('feed:join');
    join();
    socket.on('connect', join);

    const onUpdated = ({ productId, currentPrice, bidCount }) =>
      setItems((current) => {
        const filters = filtersRef.current;
        const belowMin = filters.minPrice !== '' && currentPrice < Number(filters.minPrice);
        const aboveMax = filters.maxPrice !== '' && currentPrice > Number(filters.maxPrice);
        return current
          .map((product) => product._id === productId
            ? { ...product, currentPrice, bidCount }
            : product)
          .filter((product) => !(product._id === productId && (belowMin || aboveMax)));
      });
    const onExtended = ({ productId, endsAt }) =>
      setItems((l) => l.map((p) => (p._id === productId ? { ...p, endsAt } : p)));
    const onGone = ({ productId }) => setItems((l) => l.filter((p) => p._id !== productId));
    const onAdded = (p) => {
      const filters = filtersRef.current;
      if (
        filters.q || filters.regionId || filters.districtId ||
        filters.minPrice || filters.maxPrice || filters.sort !== 'newest'
      ) return;
      setItems((l) => (l.some((x) => x._id === p._id) ? l : [p, ...l]));
    };

    socket.on('product:updated', onUpdated);
    socket.on('product:extended', onExtended);
    socket.on('product:ended', onGone);
    socket.on('product:removed', onGone);
    socket.on('product:created', onAdded);
    socket.on('product:reactivated', onAdded);

    return () => {
      socket.emit('feed:leave');
      socket.off('connect', join);
      socket.off('product:updated', onUpdated);
      socket.off('product:extended', onExtended);
      socket.off('product:ended', onGone);
      socket.off('product:removed', onGone);
      socket.off('product:created', onAdded);
      socket.off('product:reactivated', onAdded);
    };
  }, [socket]);

  return (
    <>
      <div className="page-head home-page-head">
        <h1>Hozir savdoda</h1>
        <form
          className="filters marketplace-filters"
          onSubmit={(e) => {
            e.preventDefault();
            const min = minPrice === '' ? undefined : Number(minPrice);
            const max = maxPrice === '' ? undefined : Number(maxPrice);
            if (
              (min !== undefined && (!Number.isSafeInteger(min) || min < 0)) ||
              (max !== undefined && (!Number.isSafeInteger(max) || max < 5000)) ||
              (min !== undefined && max !== undefined && min > max)
            ) {
              setError("Narx oralig'ini to'g'ri kiriting.");
              return;
            }
            setError('');
            setPage(1);
            setAppliedFilters({
              q: q.trim(),
              regionId,
              districtId,
              minPrice,
              maxPrice,
              sort,
            });
          }}
        >
          <div className="product-search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Mahsulot nomi bo‘yicha qidirish"
              aria-label="Mahsulot nomi bo‘yicha qidirish"
            />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Saralash">
              <option value="newest">Yangilari</option>
              <option value="ending">Tez tugaydiganlar</option>
              <option value="price_asc">Arzonidan qimmatiga</option>
              <option value="price_desc">Qimmatidan arzoniga</option>
            </select>
          </div>
          <div className="filter-fields">
            <select
              value={regionId}
              onChange={(e) => {
                setRegionId(e.target.value);
                setDistrictId('');
              }}
              aria-label="Viloyat bo‘yicha filtrlash"
            >
              <option value="">Barcha viloyatlar</option>
              {locationOptions.regions.map((region) => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
            <select
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              disabled={!regionId}
              aria-label="Tuman yoki shahar bo‘yicha filtrlash"
            >
              <option value="">Barcha tuman/shaharlar</option>
              {locationOptions.districts
                .filter((district) => String(district.regionId) === regionId)
                .map((district) => (
                  <option key={district.id} value={district.id}>{district.name}</option>
                ))}
            </select>
            <div className="price-range">
              <input
                type="number"
                min="0"
                step="1000"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Dan"
                aria-label="Minimal narx"
              />
              <span>dan</span>
              <input
                type="number"
                min="5000"
                step="1000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Gacha (kamida 5 000)"
                aria-label="Maksimal narx"
              />
              <span>so‘m gacha</span>
            </div>
            <button className="btn primary" type="submit">Filtrlash</button>
            <button
              className="btn clear-filters"
              type="button"
              onClick={() => {
                setQ('');
                setRegionId('');
                setDistrictId('');
                setMinPrice('');
                setMaxPrice('');
                setSort('newest');
                setPage(1);
                setError('');
                setAppliedFilters({
                  q: '',
                  regionId: '',
                  districtId: '',
                  minPrice: '',
                  maxPrice: '',
                  sort: 'newest',
                });
              }}
            >
              Tozalash
            </button>
          </div>
        </form>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="grid">
        {items.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>

      {!loading && items.length === 0 && !error && (
        <p className="empty">
          {appliedFilters.q
            ? `"${appliedFilters.q}" bo‘yicha va tanlangan filtrlarda mahsulot topilmadi.`
            : items.length === 0 &&
                !appliedFilters.regionId &&
                !appliedFilters.districtId &&
                !appliedFilters.minPrice &&
                !appliedFilters.maxPrice
              ? "Hozircha faol mahsulot yo'q. Birinchi bo'lib profilingizdan mahsulot joylang."
              : 'Tanlangan filtrlarda mahsulot topilmadi.'}
        </p>
      )}
      {loading && <p className="muted">Yuklanmoqda...</p>}
      {!loading && page < pages && (
        <div className="center">
          <button className="btn" onClick={() => load(page + 1, false)}>Keyingi 20 ta mahsulot</button>
        </div>
      )}
    </>
  );
}
