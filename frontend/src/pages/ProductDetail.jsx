import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Countdown from '../components/Countdown.jsx';
import PriceTicker from '../components/PriceTicker.jsx';
import { assetUrl } from '../config.js';
import { STATUS_LABEL, fmtDate, fmtPrice } from '../utils';

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [bids, setBids] = useState([]);
  const [img, setImg] = useState(0);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/products/${id}`);
      setProduct(data.product);
      setBids(data.bids);
      setAmount(String(data.product.minNextBid));
    } catch (e) {
      setError(errMsg(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isAuthor = user && product?.author?._id === user._id;
  const isWinner = user && product?.winner?._id === user._id;
  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit('product:join', id);
    join();
    socket.on('connect', join);

    const onBid = (b) => {
      if (b.productId !== id) return;
      setProduct((p) =>
        p
          ? {
              ...p,
              currentPrice: b.amount,
              bidCount: b.bidCount,
              endsAt: b.endsAt,
              minNextBid: b.minNextBid,
              lastBidder: b.bidder,
            }
          : p
      );
      setBids((l) => [{ _id: `${b.at}-${b.amount}`, amount: b.amount, bidder: b.bidder, createdAt: b.at }, ...l].slice(0, 20));
      setAmount((cur) => (Number(cur) <= b.amount ? String(b.minNextBid) : cur));
    };
    const onExtended = (e) => {
      if (e.productId === id) setProduct((p) => (p ? { ...p, endsAt: e.endsAt, extensionUsed: true } : p));
    };
    const reload = (e) => {
      if (e.productId === id || e._id === id) load();
    };
    const onRemoved = (e) => {
      if (e.productId === id) navigate('/');
    };

    socket.on('bid:new', onBid);
    socket.on('product:extended', onExtended);
    socket.on('product:ended', reload);
    socket.on('product:reactivated', reload);
    socket.on('product:updated', reload);
    socket.on('product:removed', onRemoved);

    return () => {
      socket.emit('product:leave', id);
      socket.off('connect', join);
      socket.off('bid:new', onBid);
      socket.off('product:extended', onExtended);
      socket.off('product:ended', reload);
      socket.off('product:reactivated', reload);
      socket.off('product:updated', reload);
      socket.off('product:removed', onRemoved);
    };
  }, [socket, id, load, navigate]);

  const placeBid = (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    socket.emit('bid:place', { productId: id, amount: Number(amount) }, (res) => {
      setBusy(false);
      if (!res?.ok) return setError(res?.message || 'Taklif qabul qilinmadi');
      setNotice('Taklifingiz qabul qilindi');
    });
  };

  const accept = async () => {
    if (!window.confirm(`${fmtPrice(product.currentPrice)} taklif bilan sotilgan deb belgilaysizmi?`)) return;
    try {
      await api.post(`/products/${id}/accept`);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const reportProduct = async () => {
    setReportBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post(`/products/${id}/report`);
      if (data.deleted) {
        navigate('/');
        return;
      }
      setProduct((current) => current && ({
        ...current,
        reportCount: data.reportCount,
        hasReported: true,
      }));
      setNotice(data.message);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setReportBusy(false);
    }
  };

  if (!product) return error ? <div className="alert error">{error}</div> : <p className="muted">Yuklanmoqda...</p>;

  const isAuction = product.saleMode !== 'fixed';
  const active = product.status === 'active' && (!isAuction || new Date(product.endsAt) > new Date());
  const canStartChat = active || (product.status === 'sold' && isWinner);
  const imgs = product.images || [];

  return (
    <>
      <div className="detail">
        <div className="detail-gallery">
          <div className="detail-main-img">
            {imgs[img] ? <img src={assetUrl(imgs[img])} alt={product.title} /> : <div className="no-img">Rasm yo'q</div>}
          </div>
          {imgs.length > 1 && (
            <div className="thumbs">
              {imgs.map((src, i) => (
                <button key={src} className={i === img ? 'on' : ''} onClick={() => setImg(i)}>
                  <img src={assetUrl(src)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

      <div className="detail-info">
        <h1>{product.title}</h1>
        <p className="muted">
          Muallif: <strong>{fullName(product.author)}</strong> (@{product.author?.username})
        </p>
        {product.location && (
          <div className="product-location card">
            <div>
              <strong>Joylashuv</strong>
              <div className="muted small">{product.location.regionName}, {product.location.districtName}</div>
            </div>
          </div>
        )}

        <div className="card bidbox">
          <div className="lot-price-label">
            {isAuction
              ? product.bidCount > 0 ? `Oxirgi taklif (${product.bidCount} ta)` : "Boshlang'ich narx"
              : 'Sotish narxi'}
          </div>
          <PriceTicker
            value={!isAuction && product.status === 'sold' ? product.finalPrice : product.currentPrice}
            big
          />
          {product.lastBidder && product.bidCount > 0 && (
            <div className="muted">Taklif egasi: @{product.lastBidder.username}</div>
          )}

          {isAuction ? (
            <>
              <div className="bid-time">
                <span className="muted">{active ? 'Tugashiga' : 'Holat'}</span>
                {active ? <Countdown endsAt={product.endsAt} big /> : <span className={`badge ${product.status}`}>{STATUS_LABEL[product.status]}</span>}
              </div>
              <div className="muted small">Tugash vaqti: {fmtDate(product.endsAt)}</div>
            </>
          ) : (
            <div className="bid-time">
              <span className="muted">Savdo turi</span>
              <span className={`badge ${product.status}`}>{active ? 'Oddiy savdo' : STATUS_LABEL[product.status]}</span>
            </div>
          )}
          {isAuction && product.extensionUsed && active && (
            <div className="muted small">Taklif tushmagani uchun muddat 1 kunga uzaytirilgan</div>
          )}

          {isAuction && active && !isAuthor && user && (
            <form className="bid-form" onSubmit={placeBid}>
              <input type="number" min={product.minNextBid} step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              <button className="btn accent" disabled={busy || !socket}>Taklif berish</button>
              <div className="muted small">Kamida {fmtPrice(product.minNextBid)}</div>
            </form>
          )}
          {isAuction && active && !user && (
            <p className="muted">
              Taklif berish uchun <Link to="/login" state={{ from: `/product/${id}` }} className="link">tizimga kiring</Link>.
            </p>
          )}
          {isAuction && active && isAuthor && (
            <div className="author-actions">
              <p className="muted small">Bu sizning mahsulotingiz.</p>
              {product.bidCount > 0 && (
                <button className="btn primary" onClick={accept}>Sotildi deb belgilash</button>
              )}
            </div>
          )}
          {user && !isAuthor && (
            <div className="product-report">
              <button
                type="button"
                className="btn"
                disabled={reportBusy || product.hasReported}
                onClick={reportProduct}
              >
                {reportBusy
                  ? 'Yuborilmoqda...'
                  : product.hasReported
                    ? 'Xabar berildi'
                    : 'Mahsulot haqida xabar berish'}
              </button>
              <span className="muted small">{product.reportCount || 0}/5 ta xabar</span>
            </div>
          )}

          {error && <div className="alert error">{error}</div>}
          {notice && <div className="alert ok">{notice}</div>}

          {!active && product.status === 'sold' && (
            <div className="alert ok">
              Kelishilgan narx: <strong>{fmtPrice(product.finalPrice)}</strong>
              {product.winner && <> · G'olib: @{product.winner.username}</>}
            </div>
          )}
          {isWinner && product.contactPhone && (
            <div className="alert ok">Muallif bilan bog'lanish: <strong>{product.contactPhone}</strong></div>
          )}
          {user && (
            <div className="product-chat-link">
              {isAuthor ? (
                <Link className="btn" to="/chats">Chatlarni ochish</Link>
              ) : canStartChat ? (
                <Link className="btn" to={`/chats/${id}/${user._id}`}>Muallifga yozish</Link>
              ) : null}
            </div>
          )}
          {!user && active && (
            <p className="product-chat-link muted">
              Muallifga yozish uchun <Link to="/login" state={{ from: `/product/${id}` }} className="link">tizimga kiring</Link>.
            </p>
          )}
        </div>

        {product.description && (
          <>
            <h2>Tavsif</h2>
            <p className="desc">{product.description}</p>
          </>
        )}

          {isAuction && (
            <>
              <h2>Takliflar tarixi</h2>
              {bids.length === 0 ? (
                <p className="muted">Hali taklif berilmagan.</p>
              ) : (
                <ul className="bids">
                  {bids.map((b, i) => (
                    <li key={b._id} className={i === 0 ? 'top' : ''}>
                      <span>@{b.bidder?.username}</span>
                      <strong>{fmtPrice(b.amount)}</strong>
                      <span className="muted small">{fmtDate(b.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

    </>
  );
}
