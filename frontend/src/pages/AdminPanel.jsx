import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { assetUrl } from '../config.js';
import { fmtDate, fullName } from '../utils';

export default function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('users');
  const [products, setProducts] = useState([]);
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

  useEffect(() => {
    if (section === 'users') loadUsers();
    else loadProducts();
  }, [section, loadProducts, loadUsers]);

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

  return (
    <section>
      <div className="admin-head">
        <div>
          <h1>Admin panel</h1>
          <p className="muted">{section === 'users' ? 'Foydalanuvchilar' : 'Mahsulotlar'}: {total}</p>
        </div>
        <form className="admin-search" onSubmit={submitSearch}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={section === 'users' ? 'Ism, username yoki email' : 'Mahsulot yoki muallif'}
            aria-label={section === 'users' ? 'Foydalanuvchilarni qidirish' : 'Mahsulotlarni qidirish'}
          />
          <button className="btn primary">Qidirish</button>
        </form>
      </div>

      <div className="tabs admin-tabs">
        <button className={section === 'users' ? 'on' : ''} onClick={() => { setSection('users'); setPage(1); }}>
          Foydalanuvchilar
        </button>
        <button className={section === 'products' ? 'on' : ''} onClick={() => { setSection('products'); setPage(1); }}>
          Mahsulotlar
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}
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
              <button
                type="button"
                className="btn danger"
                disabled={busyId === product._id}
                onClick={() => removeProduct(product)}
              >
                {busyId === product._id ? 'O‘chirilmoqda...' : 'Darhol ban berish / o‘chirish'}
              </button>
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

      {pages > 1 && (
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
