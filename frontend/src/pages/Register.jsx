import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    birthDate: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(f);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form narrow" onSubmit={submit}>
      <h1>Ro'yxatdan o'tish</h1>
      {error && <div className="alert error">{error}</div>}
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
        Email
        <input type="email" value={f.email} onChange={set('email')} required />
      </label>
      <label>
        Username (ixtiyoriy)
        <input value={f.username} onChange={set('username')} placeholder="Bo'sh qoldirsangiz, masalan user4523 beriladi" />
      </label>
      <label>
        Tug'ilgan sana
        <input type="date" value={f.birthDate} onChange={set('birthDate')} max={new Date().toISOString().slice(0, 10)} required />
      </label>
      <label>
        Parol (kamida 6 belgi)
        <input type="password" minLength={6} value={f.password} onChange={set('password')} required />
      </label>
      <button className="btn primary" disabled={busy}>{busy ? 'Yaratilmoqda...' : "Ro'yxatdan o'tish"}</button>
      <p className="muted">
        Akkauntingiz bormi? <Link to="/login" className="link">Kiring</Link>
      </p>
    </form>
  );
}
