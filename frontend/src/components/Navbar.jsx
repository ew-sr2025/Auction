import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { assetUrl } from '../config.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="logo">Lot</Link>
        <nav className="nav-links">
          <NavLink to="/" end>Mahsulotlar</NavLink>
          {user ? (
            <>
              <NavLink to="/profile">
                {user.avatar ? <img className="mini-avatar" src={assetUrl(user.avatar)} alt="" /> : null}
                {user.username}
              </NavLink>
              {user.role === 'admin' && <NavLink to="/admin">Admin panel</NavLink>}
              <button
                className="btn ghost"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Chiqish
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Kirish</NavLink>
              <Link to="/register" className="btn primary">Ro'yxatdan o'tish</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
