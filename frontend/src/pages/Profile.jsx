import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Countdown from '../components/Countdown.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import { assetUrl } from '../config.js';
import { STATUS_LABEL, fmtDate, fmtPrice, fullName } from '../utils';

export default function Profile() {
  const { user } = useAuth();
  const [tab, setTab] = useState('products');

  return (
    <>
      <div className="profile-head">
        {user.avatar ? <img className="avatar" src={assetUrl(user.avatar)} alt="" /> : <div className="avatar ph">{user.firstName[0]}</div>}
        <div>
          <h1>{fullName(user)}</h1>
          <div className="muted">@{user.username} · {user.email}</div>
          {user.bio && <p className="bio">{user.bio}</p>}
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'products' ? 'on' : ''} onClick={() => setTab('products')}>Mahsulotlarim</button>
        <button className={tab === 'create' ? 'on' : ''} onClick={() => setTab('create')}>Mahsulot joylash</button>
        <button className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>Profilni tahrirlash</button>
      </div>

      {tab === 'products' && <MyProducts goCreate={() => setTab('create')} />}
      {tab === 'create' && <CreateProduct goEdit={() => setTab('edit')} done={() => setTab('products')} />}
      {tab === 'edit' && <EditProfile />}
    </>
  );
}

function MyProducts({ goCreate }) {
  const socket = useSocket();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const itemsRef = useRef([]);
  itemsRef.current = items || [];

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/products/mine');
      setItems(data.items);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mahsulotlarimdan biri o'zgarsa ro'yxatni yangilaymiz
  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit('feed:join');
    join();
    socket.on('connect', join);
    const onChange = (e) => {
      if (itemsRef.current.some((p) => p._id === e.productId)) load();
    };
    socket.on('product:updated', onChange);
    socket.on('product:ended', onChange);
    socket.on('product:extended', onChange);
    return () => {
      socket.emit('feed:leave');
      socket.off('connect', join);
      socket.off('product:updated', onChange);
      socket.off('product:ended', onChange);
      socket.off('product:extended', onChange);
    };
  }, [socket, load]);

  const act = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  if (!items) return error ? <div className="alert error">{error}</div> : <p className="muted">Yuklanmoqda...</p>;

  if (items.length === 0) {
    return (
      <div className="empty">
        Siz hali mahsulot joylamagansiz.{' '}
        <button className="link-btn" onClick={goCreate}>Birinchi mahsulotni joylang</button>
      </div>
    );
  }

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      {editing && (
        <EditProduct
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
      <div className="my-list">
        {items.map((p) => (
          <div key={p._id} className={`card my-item ${p.status !== 'active' ? 'inactive' : ''}`}>
            <div className="my-thumb">{p.images?.[0] ? <img src={assetUrl(p.images[0])} alt="" /> : <div className="no-img sm">Rasm yo'q</div>}</div>
            <div className="my-main">
              <div className="my-title">
                <Link to={`/product/${p._id}`} className="link">{p.title}</Link>
                <span className={`badge ${p.status}`}>{STATUS_LABEL[p.status]}</span>
              </div>
              <div>
                {p.bidCount > 0 ? 'Oxirgi taklif' : "Boshlang'ich narx"}: <strong>{fmtPrice(p.currentPrice)}</strong>
                {p.lastBidder && p.status === 'active' && <span className="muted"> · @{p.lastBidder.username}</span>}
              </div>
              {p.status === 'active' ? (
                <div className="muted small">Tugashiga: <Countdown endsAt={p.endsAt} /> ({fmtDate(p.endsAt)})</div>
              ) : (
                <div className="muted small">Tugagan: {p.endedAt ? fmtDate(p.endedAt) : fmtDate(p.endsAt)}</div>
              )}
              {p.status === 'sold' && p.winner && (
                <div className="alert ok">
                  Kelishilgan narx: <strong>{fmtPrice(p.finalPrice)}</strong> · Xaridor: {fullName(p.winner)} (@{p.winner.username})
                  {p.winner.phone && <> · Tel: <strong>{p.winner.phone}</strong></>}
                </div>
              )}
            </div>
            <div className="my-actions">
              <button type="button" className="btn accent" onClick={() => setEditing(p)}>
                Tahrirlash
              </button>
              {p.status === 'active' && p.bidCount > 0 && (
                <button
                  className="btn primary"
                  onClick={() =>
                    window.confirm(`${fmtPrice(p.currentPrice)} taklif bilan sotilgan deb belgilaysizmi?`) &&
                    act(() => api.post(`/products/${p._id}/accept`))
                  }
                >
                  Sotildi deb belgilash
                </button>
              )}
              {p.status !== 'active' && (
                <button className="btn accent" onClick={() => act(() => api.post(`/products/${p._id}/reactivate`))}>
                  Qayta faollashtirish
                </button>
              )}
              <button
                className="btn danger"
                onClick={() =>
                  window.confirm("Mahsulotni o'chirasizmi? U ro'yxatingizdan yo'qoladi.") &&
                  act(() => api.delete(`/products/${p._id}`))
                }
              >
                O'chirish
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CreateProduct({ goEdit, done }) {
  const { user } = useAuth();
  const [f, setF] = useState({ title: '', description: '', startingPrice: '5000', durationDays: '5' });
  const [location, setLocation] = useState(null);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!user.phone) {
    return (
      <div className="card form narrow">
        <h2>Telefon raqam kerak</h2>
        <p>Mahsulot joylash uchun avval profilingizga telefon raqam qo'shing. Xaridor siz bilan shu raqam orqali bog'lanadi.</p>
        <button className="btn primary" onClick={goEdit}>Telefon raqam qo'shish</button>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      if (location) {
        fd.append('locationRegionId', String(location.regionId));
        fd.append('locationDistrictId', String(location.districtId));
      }
      files.forEach((file) => fd.append('images', file));
      await api.post('/products', fd);
      done();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Yangi mahsulot</h2>
      {error && <div className="alert error">{error}</div>}
      <label>
        Nomi
        <input value={f.title} onChange={set('title')} maxLength={120} required />
      </label>
      <label>
        Tavsif
        <textarea rows={4} value={f.description} onChange={set('description')} maxLength={2000} />
      </label>
      <div className="row2">
        <label>
          Boshlang'ich narx (so'm, kamida 50 000)
          <input type="number" min={5000} step={1000} value={f.startingPrice} onChange={set('startingPrice')} required />
        </label>
        <label>
          Muddat
          <select value={f.durationDays} onChange={set('durationDays')}>
            {[1, 3, 5, 7, 10, 14, 30].map((d) => (
              <option key={d} value={d}>{d} kun</option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">Hech kim taklif bermasa, muddat bir marta 2 kunga uzaytiriladi.</p>
      <label>Mahsulot joylashuvi (ixtiyoriy)</label>
      <LocationPicker value={location} onChange={setLocation} />
      <label>
        Rasmlar (5 tagacha, har biri 5MB gacha)
        <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 5))} />
      </label>
      {files.length > 0 && <div className="muted small">{files.map((x) => x.name).join(', ')}</div>}
      <p className="muted small">Aloqa raqami: <strong>{user.phone}</strong></p>
      <button className="btn primary" disabled={busy}>{busy ? 'Joylanmoqda...' : 'Joylash'}</button>
    </form>
  );
}

function EditProduct({ product, onClose, onSaved }) {
  const [f, setF] = useState({
    title: product.title || '',
    description: product.description || '',
    startingPrice: String(product.startingPrice || 0),
    durationDays: String(product.durationDays || 1),
  });
  const [removeImages, setRemoveImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [location, setLocation] = useState(product.location || null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canEditPrice = product.bidCount === 0;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('title', f.title.trim());
      fd.append('description', f.description.trim());
      fd.append('durationDays', String(f.durationDays));
      fd.append('locationRegionId', location ? String(location.regionId) : '');
      fd.append('locationDistrictId', location ? String(location.districtId) : '');
      if (canEditPrice) fd.append('startingPrice', String(f.startingPrice));
      removeImages.forEach((img) => fd.append('removeImages', img));
      files.forEach((file) => fd.append('images', file));
      await api.put(`/products/${product._id}`, fd);
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card form">
      <h2>Mahsulotni tahrirlash</h2>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={submit}>
        <label>
          Nomi
          <input value={f.title} onChange={set('title')} maxLength={120} required />
        </label>
        <label>
          Tavsif
          <textarea rows={4} value={f.description} onChange={set('description')} maxLength={2000} />
        </label>
        <div className="row2">
          <label>
            Boshlang'ich narx (so'm)
            <input type="number" min={5000} step={1000} value={f.startingPrice} onChange={set('startingPrice')} disabled={!canEditPrice} required />
          </label>
          <label>
            Muddat (kun)
            <select value={f.durationDays} onChange={set('durationDays')}>
              {[1, 3, 5, 7, 10, 14, 30].map((d) => (
                <option key={d} value={d}>{d} kun</option>
              ))}
            </select>
          </label>
        </div>
        {!canEditPrice && <p className="muted small">Takliflar bo'lgani uchun narxni o'zgartirib bo'lmaydi.</p>}
        <label>Mahsulot joylashuvi (ixtiyoriy)</label>
        <LocationPicker value={location} onChange={setLocation} />
        {product.images?.length > 0 && (
          <div>
            <div className="muted small">Mavjud rasmlar</div>
            <div className="row2">
              {product.images.map((img) => (
                <label key={img} className="card" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <img src={assetUrl(img)} alt="" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={removeImages.includes(img)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRemoveImages((prev) => checked ? [...prev, img] : prev.filter((x) => x !== img));
                      }}
                    />
                    O'chirish
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        <label>
          Yangi rasmlar qo'shish (5 tagacha)
          <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files).slice(0, 5))} />
        </label>
        {files.length > 0 && <div className="muted small">{files.map((x) => x.name).join(', ')}</div>}
        <div className="row2" style={{ marginTop: '12px' }}>
          <button type="button" className="btn" onClick={onClose}>Bekor qilish</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</button>
        </div>
      </form>
    </div>
  );
}

function EditProfile() {
  const { user, updateUser } = useAuth();
  const [f, setF] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username || '',
    bio: user.bio || '',
    phone: user.phone || '',
  });
  const [avatar, setAvatar] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      if (avatar) fd.append('avatar', avatar);
      const { data } = await api.put('/users/me', fd);
      updateUser(data.user);
      setAvatar(null);
      setOk('Saqlandi');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form narrow" onSubmit={submit}>
      <h2>Profilni tahrirlash</h2>
      {error && <div className="alert error">{error}</div>}
      {ok && <div className="alert ok">{ok}</div>}
      <div className="row2">
        <label>
          Ism
          <input value={f.firstName} onChange={set('firstName')} required />
        </label>
        <label>
          Familya
          <input value={f.lastName} onChange={set('lastName')} required />
        </label>
      </div>
      <label>
        Username
        <input value={f.username} onChange={set('username')} minLength={3} maxLength={20} pattern="[a-z0-9_]+" required />
      </label>
      <label>
        Telefon raqam
        <input value={f.phone} onChange={set('phone')} placeholder="+998901234567" />
      </label>
      <label>
        Bio
        <textarea rows={3} value={f.bio} onChange={set('bio')} maxLength={500} />
      </label>
      <label>
        Profil rasmi
        <input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files[0] || null)} />
      </label>
      <button className="btn primary" disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</button>
    </form>
  );
}
