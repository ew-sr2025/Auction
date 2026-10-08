import { useState } from 'react';
import { Link } from 'react-router-dom';
import Countdown from './Countdown.jsx';
import PriceTicker from './PriceTicker.jsx';
import { assetUrl } from '../config.js';
import { fullName } from '../utils';

export default function ProductCard({ product }) {
  const p = product;
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Link to={`/product/${p._id}`} className="card lot">
      <div className="lot-img">
        {p.images?.[0] && !imageFailed ? (
          <img
            src={assetUrl(p.images[0])}
            alt={p.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="no-img"><span>Rasm mavjud emas</span></div>
        )}
      </div>
      <div className="lot-body">
        <h3 className="lot-title">{p.title}</h3>
        <div className="lot-price-label">
          {p.saleMode === 'fixed'
            ? 'Sotish narxi'
            : p.bidCount > 0 ? `Oxirgi taklif (${p.bidCount} ta)` : "Boshlang'ich narx"}
        </div>
        <PriceTicker value={p.currentPrice} />
        {p.saleMode === 'fixed' ? (
          <div className="lot-meta"><span className="badge">Oddiy savdo</span></div>
        ) : (
          <div className="lot-meta">
            <span className="muted">Tugashiga</span>
            <Countdown endsAt={p.endsAt} />
          </div>
        )}
        <div className="lot-author muted">
          Muallif: {p.author?.username || fullName(p.author)}
        </div>
      </div>
    </Link>
  );
}
