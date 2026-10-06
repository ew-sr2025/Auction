import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';

export default function Login() {
  const { login, googleLogin } = useAuth();
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

  const signInWithGoogle = async (credential) => {
    setError('');
    setBusy(true);
    try {
      await googleLogin(credential);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card form narrow">
      <h1>Kirish</h1>
      {error && <div className="alert error">{error}</div>}
      <form className="form-fields" onSubmit={submit}>
        <label>
          Username yoki email
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
        </label>
        <label>
          Parol
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn primary" disabled={busy}>{busy ? 'Kirilmoqda...' : 'Kirish'}</button>
      </form>
      <div className="auth-divider"><span>yoki</span></div>
      <GoogleSignInButton
        disabled={busy}
        onCredential={signInWithGoogle}
        onError={(err) => setError(errMsg(err))}
      />
      <p className="muted">
        Akkauntingiz yo'qmi? <Link to="/register" className="link">Ro'yxatdan o'ting</Link>
      </p>
    </div>
  );
}
