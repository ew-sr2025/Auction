import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api, { errMsg } from '../api';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';

export default function Register() {
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('details');
  const [f, setF] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    birthDate: '',
    password: '',
  });
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 'code' || !resendAt) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step, resendAt]);

  const secondsRemaining = resendAt
    ? Math.max(0, Math.ceil((new Date(resendAt).getTime() - now) / 1000))
    : 0;
  const set = (k) => (e) => setF((current) => ({ ...current, [k]: e.target.value }));

  const requestCode = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register/code', f);
      setResendAt(data.resendAt);
      setNotice(
        data.sent
          ? 'Tasdiqlash kodi emailingizga yuborildi.'
          : 'Bu email uchun avvalgi tasdiqlash kodi va taymer saqlandi.'
      );
      setStep('code');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register/resend', { email: f.email });
      setResendAt(data.resendAt);
      setNotice('Yangi tasdiqlash kodi emailingizga yuborildi.');
      setCode('');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(f, code);
      navigate('/', { replace: true });
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
      navigate('/', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card form narrow">
      <h1>Ro'yxatdan o'tish</h1>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert ok">{notice}</div>}

      {step === 'details' ? (
        <form className="form-fields" onSubmit={requestCode}>
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
          <button className="btn primary" disabled={busy}>{busy ? 'Yuborilmoqda...' : 'Davom etish'}</button>
          <p className="muted">
            Akkauntingiz bormi? <Link to="/login" className="link">Kiring</Link>
          </p>
          <div className="auth-divider"><span>yoki</span></div>
          <GoogleSignInButton
            disabled={busy}
            onCredential={signInWithGoogle}
            onError={(err) => setError(errMsg(err))}
          />
        </form>
      ) : (
        <form className="form-fields" onSubmit={verify}>
          <p className="muted">
            Tasdiqlash kodini <strong>{f.email}</strong> manziliga yubordik.
          </p>
          <label>
            Email tasdiqlash kodi
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </label>
          <button className="btn primary" disabled={busy || code.length !== 6}>
            {busy ? 'Tekshirilmoqda...' : 'Tasdiqlash va ro‘yxatdan o‘tish'}
          </button>
          <div className="register-actions">
            <button type="button" className="btn ghost" onClick={() => { setStep('details'); setError(''); setNotice(''); }}>
              Orqaga
            </button>
            {secondsRemaining > 0 ? (
              <span className="muted small">Kodni qayta yuborish: {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, '0')}</span>
            ) : (
              <button type="button" className="btn ghost" onClick={resendCode} disabled={busy}>
                Kodni qayta yuborish
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
