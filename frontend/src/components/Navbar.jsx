import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { assetUrl } from '../config.js';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className={`nav ${menuOpen ? 'menu-open' : ''}`}>
      <div className="container nav-inner">
        <Link to="/" className="logo">Lot</Link>
        <button
          className="nav-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? 'Navigatsiyani yopish' : 'Navigatsiyani ochish'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className="nav-links" id="primary-navigation">
          <NavLink to="/" end>Mahsulotlar</NavLink>
          <NavLink to="/about">Sayt haqida</NavLink>
          {user ? (
            <>
              <NavLink to="/chats">Chatlar</NavLink>
              <NavLink to="/profile">
                {user.avatar ? <img className="mini-avatar" src={assetUrl(user.avatar)} alt="" /> : null}
                {user.username}
              </NavLink>
              {user.role === 'admin' && <NavLink to="/admin">Admin panel</NavLink>}
              <button
                className="btn ghost"
                onClick={() => {
                  setMenuOpen(false);
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
