import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { assetUrl } from '../config.js';

function UserForm({ user, onCancel, onSaved }) {
  const [fields, setFields] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    username: user.username || '',
    email: user.email || '',
    phone: user.phone || '',
    bio: user.bio || '',
  });
  const [avatar, setAvatar] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      Object.entries(fields).forEach(([key, value]) => form.append(key, value));
      if (avatar) form.append('avatar', avatar);
      if (removeAvatar) form.append('removeAvatar', 'true');
      const { data } = await api.put(`/admin/users/${user._id}`, form);
      onSaved(data.user);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form admin-editor-page-form" onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      <div className="row2">
        <label>Ism<input value={fields.firstName} onChange={set('firstName')} maxLength={50} required /></label>
        <label>Familya<input value={fields.lastName} onChange={set('lastName')} maxLength={50} required /></label>
      </div>
      <div className="row2">
        <label>Username<input value={fields.username} onChange={set('username')} minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" required /></label>
        <label>Email<input type="email" value={fields.email} onChange={set('email')} required /></label>
      </div>
      <label>Telefon raqam<input value={fields.phone} onChange={set('phone')} placeholder="+998901234567" /></label>
      <label>Bio<textarea rows={3} value={fields.bio} onChange={set('bio')} maxLength={500} /></label>
      {user.avatar && (
        <label className="admin-current-avatar">
          Joriy profil rasmi
          <img src={assetUrl(user.avatar)} alt="" />
          <span><input type="checkbox" checked={removeAvatar} onChange={(event) => setRemoveAvatar(event.target.checked)} /> Rasmni olib tashlash</span>
        </label>
      )}
      <label>Yangi profil rasmi<input type="file" accept="image/*" onChange={(event) => { setAvatar(event.target.files[0] || null); setRemoveAvatar(false); }} /></label>
      <div className="admin-editor-actions">
        <button type="button" className="btn" onClick={onCancel}>Bekor qilish</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</button>
      </div>
    </form>
  );
}

function ProductForm({ product, onCancel }) {
  const navigate = useNavigate();
  const [fields, setFields] = useState({
    title: product.title || '',
    description: product.description || '',
    startingPrice: String(product.startingPrice || ''),
    durationDays: String(product.durationDays || 2),
    contactPhone: product.contactPhone || '',
  });
  const [location, setLocation] = useState(product.location || null);
  const [regions, setRegions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [removeImages, setRemoveImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canEditPrice = product.bidCount === 0;
  const availableDistricts = districts.filter((district) => district.regionId === Number(location?.regionId));
  const set = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    let active = true;
    api.get('/products/locations')
      .then(({ data }) => {
        if (!active) return;
        setRegions(data.regions);
        setDistricts(data.districts);
      })
      .catch((err) => {
        if (active) setError(errMsg(err));
      });
    return () => { active = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!location?.regionId || !location?.districtId) {
      setError('Mahsulot joylashuvi uchun viloyat va tuman/shaharni tanlang.');
      return;
    }
    if ((product.images || []).filter((image) => !removeImages.includes(image)).length + files.length > 5) {
      setError("Mahsulotga jami 5 tagacha rasm qo'shish mumkin.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('title', fields.title.trim());
      form.append('description', fields.description.trim());
      form.append('contactPhone', fields.contactPhone);
      form.append('durationDays', fields.durationDays);
      form.append('locationRegionId', String(location.regionId));
      form.append('locationDistrictId', String(location.districtId));
      if (canEditPrice) form.append('startingPrice', fields.startingPrice);
      removeImages.forEach((image) => form.append('removeImages', image));
      files.forEach((file) => form.append('images', file));
      await api.put(`/admin/products/${product._id}`, form);
      navigate('/admin');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form admin-editor-page-form" onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      <label>Nomi<input value={fields.title} onChange={set('title')} maxLength={120} required /></label>
      <label>Tavsif<textarea rows={4} value={fields.description} onChange={set('description')} maxLength={2000} /></label>
      <div className="row2">
        <label>
          {product.saleMode === 'fixed' ? 'Sotish narxi (so‘m)' : 'Boshlang‘ich narx (so‘m)'}
          <input type="number" min="5000" step="1" value={fields.startingPrice} onChange={set('startingPrice')} disabled={!canEditPrice} required />
        </label>
        {product.saleMode === 'auction' && (
          <label>Muddat (kun)<input type="number" min="1" max="30" value={fields.durationDays} onChange={set('durationDays')} required /></label>
        )}
      </div>
      {!canEditPrice && <p className="muted small">Takliflar borligi sabab narxni o‘zgartirib bo‘lmaydi.</p>}
      <label>Aloqa telefoni<input value={fields.contactPhone} onChange={set('contactPhone')} placeholder="+998901234567" /></label>
      <div className="row2">
        <label>
          Viloyat
          <select
            value={location?.regionId || ''}
            onChange={(event) => setLocation({ regionId: Number(event.target.value), districtId: '' })}
            required
          >
            <option value="">Viloyatni tanlang</option>
            {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
          </select>
        </label>
        <label>
          Tuman / shahar
          <select
            value={location?.districtId || ''}
            onChange={(event) => setLocation((current) => ({ ...current, districtId: Number(event.target.value) }))}
            required
            disabled={!location?.regionId}
          >
            <option value="">Tuman/shaharni tanlang</option>
            {availableDistricts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
          </select>
        </label>
      </div>
      {product.images?.length > 0 && (
        <div className="admin-edit-images">
          <span className="muted small">Mavjud rasmlar — olib tashlash uchun belgilang</span>
          <div className="admin-image-grid">
            {product.images.map((image) => (
              <label className="admin-edit-image" key={image}>
                <img src={assetUrl(image)} alt="" />
                <span><input type="checkbox" checked={removeImages.includes(image)} onChange={(event) => setRemoveImages((current) => event.target.checked ? [...current, image] : current.filter((item) => item !== image))} /> O‘chirish</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <label>Yangi rasmlar qo‘shish<input type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label>
      <div className="admin-editor-actions">
        <button type="button" className="btn" onClick={onCancel}>Bekor qilish</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</button>
      </div>
    </form>
  );
}

function NewsForm({ news, onCancel }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(news.title || '');
  const [body, setBody] = useState(news.body || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.patch(`/site/news/${news._id}`, { title, body });
      navigate('/admin');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form admin-editor-page-form" onSubmit={submit}>
      {error && <div className="alert error">{error}</div>}
      <label>Sarlavha<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>
      <label>Matn<textarea rows={6} value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} required /></label>
      <div className="admin-editor-actions">
        <button type="button" className="btn" onClick={onCancel}>Bekor qilish</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Saqlanmoqda...' : 'Saqlash'}</button>
      </div>
    </form>
  );
}

export default function AdminEditPage() {
  const { user, updateUser } = useAuth();
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const endpoints = {
      users: `/admin/users/${id}`,
      products: `/admin/products/${id}`,
      news: `/site/news/${id}`,
    };
    if (!endpoints[type]) {
      setRecord(null);
      setError('Tahrirlash turi topilmadi.');
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError('');
    setRecord(null);
    api.get(endpoints[type])
      .then(({ data }) => {
        if (active) setRecord(data[type === 'users' ? 'user' : type === 'products' ? 'product' : 'news']);
      })
      .catch((err) => {
        if (active) setError(errMsg(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, type]);

  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  const cancel = () => navigate('/admin');
  const title = type === 'users'
    ? 'Foydalanuvchini tahrirlash'
    : type === 'products'
      ? 'Mahsulotni tahrirlash'
      : 'Yangilikni tahrirlash';

  return (
    <section className="admin-edit-page">
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">O‘zgarishlarni saqlash uchun formani to‘ldiring.</p>
        </div>
        <button type="button" className="btn" onClick={cancel}>Admin panelga qaytish</button>
      </div>
      {loading ? <p className="muted">Yuklanmoqda...</p> : null}
      {!loading && error && <div className="alert error">{error}</div>}
      {!loading && record && type === 'users' && (
        <UserForm
          user={record}
          onCancel={cancel}
          onSaved={(updatedUser) => {
            if (updatedUser._id === user._id) updateUser(updatedUser);
            navigate('/admin');
          }}
        />
      )}
      {!loading && record && type === 'products' && <ProductForm product={record} onCancel={cancel} />}
      {!loading && record && type === 'news' && <NewsForm news={record} onCancel={cancel} />}
    </section>
  );
}
