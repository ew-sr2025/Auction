import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../api';
import { useSocket } from '../context/SocketContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

export default function Home() {
  const socket = useSocket();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const queryRef = useRef('');
  queryRef.current = query;

  const load = useCallback(
    async (pageToLoad, replace) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/products', {
          params: { q: query || undefined, sort, page: pageToLoad, limit: 12 },
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
    [query, sort]
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
      setItems((l) => l.map((p) => (p._id === productId ? { ...p, currentPrice, bidCount } : p)));
    const onExtended = ({ productId, endsAt }) =>
      setItems((l) => l.map((p) => (p._id === productId ? { ...p, endsAt } : p)));
    const onGone = ({ productId }) => setItems((l) => l.filter((p) => p._id !== productId));
    const onAdded = (p) => {
      if (queryRef.current) return;
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
      <div className="page-head">
        <h1>Hozir savdoda</h1>
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mahsulot nomi bo'yicha qidirish" />
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Yangilari</option>
            <option value="ending">Tez tugaydiganlar</option>
            <option value="price_asc">Narxi: arzonlari</option>
            <option value="price_desc">Narxi: qimmatlari</option>
          </select>
          <button className="btn primary">Qidirish</button>
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
          {query ? `"${query}" bo'yicha hech narsa topilmadi.` : "Hozircha faol mahsulot yo'q. Birinchi bo'lib profilingizdan mahsulot joylang."}
        </p>
      )}
      {loading && <p className="muted">Yuklanmoqda...</p>}
      {!loading && page < pages && (
        <div className="center">
          <button className="btn" onClick={() => load(page + 1, false)}>Yana ko'rsatish</button>
        </div>
      )}
    </>
  );
}
