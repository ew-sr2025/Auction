import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(identifier, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form narrow" onSubmit={submit}>
      <h1>Kirish</h1>
      {error && <div className="alert error">{error}</div>}
      <label>
        Username yoki email
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
      </label>
      <label>
        Parol
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <button className="btn primary" disabled={busy}>{busy ? 'Kirilmoqda...' : 'Kirish'}</button>
      <p className="muted">
        Akkauntingiz yo'qmi? <Link to="/register" className="link">Ro'yxatdan o'ting</Link>
      </p>
    </form>
  );
}
