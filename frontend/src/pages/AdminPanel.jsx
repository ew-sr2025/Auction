import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { assetUrl } from '../config.js';
import { fmtDate, fullName } from '../utils';

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('users');
  const [products, setProducts] = useState([]);
  const [news, setNews] = useState([]);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsBody, setNewsBody] = useState('');
  const [banTarget, setBanTarget] = useState(null);
  const [banDurationType, setBanDurationType] = useState('temporary');
  const [banDuration, setBanDuration] = useState('1');
  const [banDurationUnit, setBanDurationUnit] = useState('days');
  const [banReason, setBanReason] = useState('');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/users', {
        params: { page, limit: 50, q: search },
      });
      setUsers(data.users);
      setTotal(data.total);
      setPages(Math.max(1, data.pages));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/products', {
        params: { page, limit: 50, q: search },
      });
      setProducts(data.products);
      setTotal(data.total);
      setPages(Math.max(1, data.pages));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/site/news');
      setNews(data.news.filter((item) => item.type === 'announcement'));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === 'users') loadUsers();
    else if (section === 'products') loadProducts();
    else loadNews();
  }, [section, loadNews, loadProducts, loadUsers]);

  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const submitBan = async (e) => {
    e.preventDefault();
    if (!banTarget) return;
    const duration = Number(banDuration);
    if (banDurationType === 'temporary' && (!Number.isSafeInteger(duration) || duration < 1)) {
      setError("Blok muddatini musbat butun son bilan kiriting.");
      return;
    }
    if (!window.confirm(`${banTarget.username} foydalanuvchisini bloklaysizmi?`)) return;

    setBusyId(banTarget._id);
    setError('');
    try {
      const { data } = await api.patch(`/admin/users/${banTarget._id}/ban`, {
        isBanned: true,
        durationType: banDurationType,
        ...(banDurationType === 'temporary' ? { duration, durationUnit: banDurationUnit } : {}),
        reason: banReason,
      });
      setUsers((current) =>
        current.map((entry) => entry._id === banTarget._id ? { ...entry, ...data.user } : entry)
      );
      setBanTarget(null);
      setBanReason('');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId('');
    }
  };

  const unbanUser = async (target) => {
    if (!window.confirm(`${target.username} foydalanuvchisini blokdan chiqarasizmi?`)) return;
    setBusyId(target._id);
    setError('');
    try {
      const { data } = await api.patch(`/admin/users/${target._id}/ban`, { isBanned: false });
      setUsers((current) =>
        current.map((entry) => entry._id === target._id ? { ...entry, ...data.user } : entry)
      );
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId('');
    }
  };

  const openBanForm = (target) => {
    setBanTarget(target);
    setBanDurationType('temporary');
    setBanDuration('1');
    setBanDurationUnit('days');
    setBanReason('');
  };

  const removeProduct = async (target) => {
    if (!window.confirm(`"${target.title}" mahsulotini darhol o‘chirasizmi?`)) return;
    setBusyId(target._id);
    setError('');
    try {
      await api.delete(`/admin/products/${target._id}`);
      setProducts((current) => current.filter((product) => product._id !== target._id));
      setTotal((current) => Math.max(0, current - 1));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId('');
    }
  };

  const submitNews = async (event) => {
    event.preventDefault();
    setError('');
    setBusyId('news-form');
    try {
      const { data } = await api.post('/site/news', { title: newsTitle, body: newsBody });
      setNews((current) => [data.news, ...current]);
      setNewsTitle('');
      setNewsBody('');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId('');
    }
  };

  const removeNews = async (post) => {
    if (!window.confirm(`“${post.title}” yangiligini o‘chirasizmi?`)) return;
    setBusyId(post._id);
    setError('');
    try {
      await api.delete(`/site/news/${post._id}`);
      setNews((current) => current.filter((item) => item._id !== post._id));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusyId('');
    }
  };

  return (
    <section>
      <div className="admin-head">
        <div>
          <h1>Admin panel</h1>
          <p className="muted">
            {section === 'users' ? `Foydalanuvchilar: ${total}` :
              section === 'products' ? `Mahsulotlar: ${total}` : 'Sayt yangiliklari'}
          </p>
        </div>
        {section !== 'news' && <form className="admin-search" onSubmit={submitSearch}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={section === 'users' ? 'Ism, username yoki email' : 'Mahsulot yoki muallif'}
            aria-label={section === 'users' ? 'Foydalanuvchilarni qidirish' : 'Mahsulotlarni qidirish'}
          />
          <button className="btn primary">Qidirish</button>
        </form>}
      </div>

      <div className="tabs admin-tabs">
        <button className={section === 'users' ? 'on' : ''} onClick={() => { setSection('users'); setPage(1); }}>
          Foydalanuvchilar
        </button>
        <button className={section === 'products' ? 'on' : ''} onClick={() => { setSection('products'); setPage(1); }}>
          Mahsulotlar
        </button>
        <button className={section === 'news' ? 'on' : ''} onClick={() => { setSection('news'); setPage(1); }}>
          Yangiliklar
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}
      {section === 'news' && (
        <form className="card form admin-news-form" onSubmit={submitNews}>
          <h2>Yangi yangilik qo‘shish</h2>
          <label>
            Sarlavha
            <input
              value={newsTitle}
              onChange={(event) => setNewsTitle(event.target.value)}
              maxLength={120}
              required
            />
          </label>
          <label>
            Matn
            <textarea
              value={newsBody}
              onChange={(event) => setNewsBody(event.target.value)}
              rows={4}
              maxLength={2000}
              required
            />
          </label>
          <button className="btn primary" disabled={busyId === 'news-form'}>
            {busyId === 'news-form' ? 'Saqlanmoqda...' : 'Yangilikni joylash'}
          </button>
        </form>
      )}
      {banTarget && (
        <form className="card form admin-ban-form" onSubmit={submitBan}>
          <div className="admin-ban-title">
            <h2>@{banTarget.username} foydalanuvchisini bloklash</h2>
            <button type="button" className="btn" onClick={() => setBanTarget(null)}>Yopish</button>
          </div>
          <label>
            Blok muddati
            <select value={banDurationType} onChange={(e) => setBanDurationType(e.target.value)}>
              <option value="temporary">Vaqtinchalik</option>
              <option value="permanent">Cheksiz</option>
            </select>
          </label>
          {banDurationType === 'temporary' && (
            <div className="row2">
              <label>
                Muddatni kiriting
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value)}
                  required
                />
              </label>
              <label>
                Birlik
                <select value={banDurationUnit} onChange={(e) => setBanDurationUnit(e.target.value)}>
                  <option value="hours">Soat</option>
                  <option value="days">Kun</option>
                </select>
              </label>
            </div>
          )}
          <label>
            Sabab (ixtiyoriy)
            <textarea
              rows={2}
              maxLength={500}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Bloklash sababini yozing"
            />
          </label>
          <button className="btn danger" disabled={busyId === banTarget._id}>
            {busyId === banTarget._id ? 'Saqlanmoqda...' : 'Bloklash'}
          </button>
        </form>
      )}
      {loading ? (
        <p className="muted">Yuklanmoqda...</p>
      ) : section === 'users' && users.length === 0 ? (
        <p className="empty">Foydalanuvchilar topilmadi.</p>
      ) : section === 'products' && products.length === 0 ? (
        <p className="empty">Mahsulotlar topilmadi.</p>
      ) : section === 'news' && news.length === 0 ? (
        <p className="empty">Hali admin yangiliklari yo‘q.</p>
      ) : section === 'news' ? (
        <div className="admin-news-list">
          {news.map((post) => (
            <article className="card admin-news-item" key={post._id}>
              <div>
                <strong>{post.title}</strong>
                <p className="muted">{post.body}</p>
                <span className="muted small">{fmtDate(post.createdAt)}</span>
              </div>
              <div className="admin-item-actions">
                <button type="button" className="btn" onClick={() => navigate(`/admin/edit/news/${post._id}`)}>Tahrirlash</button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busyId === post._id}
                  onClick={() => removeNews(post)}
                >
                  {busyId === post._id ? 'O‘chirilmoqda...' : 'O‘chirish'}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : section === 'products' ? (
        <div className="admin-products">
          {products.map((product) => (
              <article className="card admin-product" key={product._id}>
                <div className="admin-product-info">
                  <strong>{product.title}</strong>
                  <span className="muted">@{product.author?.username || 'noma’lum muallif'}</span>
                  <span className="muted small">
                    {product.status} · {fmtDate(product.createdAt)} · Xabarlar: {product.reportCount}/5
                  </span>
                </div>
                {product.images?.[0] && (
                  <img className="admin-product-thumb" src={assetUrl(product.images[0])} alt="" />
                )}
                <div className="admin-item-actions">
                  <button type="button" className="btn" onClick={() => navigate(`/admin/edit/products/${product._id}`)}>Tahrirlash</button>
                  <button
                    type="button"
                    className="btn danger"
                    disabled={busyId === product._id}
                    onClick={() => removeProduct(product)}
                  >
                    {busyId === product._id ? 'O‘chirilmoqda...' : 'Darhol ban berish / o‘chirish'}
                  </button>
                </div>
              </article>
          ))}
        </div>
      ) : (
        <div className="admin-users">
          {users.map((entry) => {
            const isSelf = entry._id === user._id;
            const isAdmin = entry.role === 'admin';
            return (
              <article className="card admin-user" key={entry._id}>
                <div className="admin-user-info">
                  <strong>{fullName(entry) || entry.username}</strong>
                  <span className="muted">@{entry.username} · {entry.email}</span>
                  <span className="muted small">Ro‘yxatdan o‘tgan: {fmtDate(entry.createdAt)}</span>
                </div>
                <div className="admin-user-actions">
                  <button type="button" className="btn" onClick={() => navigate(`/admin/edit/users/${entry._id}`)}>Tahrirlash</button>
                  <span className={`badge ${entry.isBanned ? 'expired' : 'active'}`}>
                    {entry.isBanned ? 'Bloklangan' : isAdmin ? 'Admin' : 'Faol'}
                  </span>
                  {entry.isBanned && (
                    <div className="admin-ban-meta muted small">
                      <span>{entry.bannedUntil ? `Gacha: ${fmtDate(entry.bannedUntil)}` : 'Cheksiz blok'}</span>
                      {entry.banReason && <span>Sabab: {entry.banReason}</span>}
                    </div>
                  )}
                  {!isAdmin && (
                    <button
                      type="button"
                      className={`btn ${entry.isBanned ? 'accent' : 'danger'}`}
                      disabled={busyId === entry._id || isSelf}
                      onClick={() => entry.isBanned ? unbanUser(entry) : openBanForm(entry)}
                      title={isSelf ? "O'zingizni bloklay olmaysiz" : undefined}
                    >
                      {busyId === entry._id
                        ? 'Saqlanmoqda...'
                        : entry.isBanned ? 'Blokdan chiqarish' : 'Bloklash'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {section !== 'news' && pages > 1 && (
        <div className="admin-pagination">
          <button className="btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            Oldingi
          </button>
          <span className="muted">Sahifa {page} / {pages}</span>
          <button className="btn" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>
            Keyingi
          </button>
        </div>
      )}
    </section>
  );
}
