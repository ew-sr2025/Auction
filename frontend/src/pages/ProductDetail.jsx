import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Countdown from '../components/Countdown.jsx';
import PriceTicker from '../components/PriceTicker.jsx';
import { STATUS_LABEL, fmtDate, fmtPrice, fullName } from '../utils';

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
  const [conversations, setConversations] = useState([]);
  const [chatBuyerId, setChatBuyerId] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

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
  const productLoaded = Boolean(product);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get(`/products/${id}/conversations`);
      setConversations(data.conversations);
      setChatBuyerId((selected) =>
        selected && data.conversations.some((c) => c.buyer?._id === selected)
          ? selected
          : data.conversations[0]?.buyer?._id || ''
      );
    } catch (e) {
      setChatError(errMsg(e));
    }
  }, [id]);

  useEffect(() => {
    if (!user || !isAuthor) return;
    loadConversations();
  }, [user, isAuthor, loadConversations]);

  const threadBuyerId = isAuthor ? chatBuyerId : user?._id;
  const loadMessages = useCallback(async () => {
    if (!user || !threadBuyerId) {
      setMessages([]);
      return;
    }
    try {
      const { data } = await api.get(`/products/${id}/messages`, {
        params: isAuthor ? { buyerId: threadBuyerId } : undefined,
      });
      setMessages(data.messages);
      setChatError('');
    } catch (e) {
      setChatError(errMsg(e));
    }
  }, [id, isAuthor, threadBuyerId, user]);

  useEffect(() => {
    if (!productLoaded || !user || !threadBuyerId) {
      setMessages([]);
      return undefined;
    }

    const join = () => {
      socket?.emit('chat:join', {
        productId: id,
        ...(isAuthor ? { buyerId: threadBuyerId } : {}),
      }, (res) => {
        if (!res?.ok) setChatError(res?.message || 'Suhbatga ulanib bo‘lmadi');
      });
      loadMessages();
    };
    join();
    socket?.on('connect', join);

    const onMessage = (message) => {
      if (message.productId !== id || message.buyerId !== threadBuyerId) return;
      setMessages((current) =>
        current.some((item) => item._id === message._id) ? current : [...current, message]
      );
    };
    socket?.on('chat:new', onMessage);

    return () => {
      socket?.emit('chat:leave', { productId: id, buyerId: threadBuyerId });
      socket?.off('connect', join);
      socket?.off('chat:new', onMessage);
    };
  }, [id, isAuthor, loadMessages, productLoaded, socket, threadBuyerId, user]);

  useEffect(() => {
    if (!productLoaded || !user || !isAuthor || !socket) return undefined;
    const join = () => socket.emit('chat:watch', { productId: id });
    const onInboxMessage = (message) => {
      if (message.productId === id) loadConversations();
    };
    join();
    socket.on('connect', join);
    socket.on('chat:inbox:new', onInboxMessage);
    return () => {
      socket.off('connect', join);
      socket.off('chat:inbox:new', onInboxMessage);
    };
  }, [id, isAuthor, loadConversations, productLoaded, socket, user]);

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
    socket.on('product:removed', onRemoved);

    return () => {
      socket.emit('product:leave', id);
      socket.off('connect', join);
      socket.off('bid:new', onBid);
      socket.off('product:extended', onExtended);
      socket.off('product:ended', reload);
      socket.off('product:reactivated', reload);
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

  const sendMessage = async (e) => {
    e.preventDefault();
    setChatError('');
    setChatBusy(true);
    try {
      await api.post(`/products/${id}/messages`, {
        text: chatText,
        ...(isAuthor ? { buyerId: threadBuyerId } : {}),
      });
      setChatText('');
      await loadMessages();
      if (isAuthor) loadConversations();
    } catch (e) {
      setChatError(errMsg(e));
    } finally {
      setChatBusy(false);
    }
  };

  if (!product) return error ? <div className="alert error">{error}</div> : <p className="muted">Yuklanmoqda...</p>;

  const active = product.status === 'active' && new Date(product.endsAt) > new Date();
  const canChat = active || (product.status === 'sold' && (isWinner || (isAuthor && chatBuyerId === product.winner?._id)));
  const imgs = product.images || [];

  return (
    <>
      <div className="detail">
        <div className="detail-gallery">
          <div className="detail-main-img">
            {imgs[img] ? <img src={imgs[img]} alt={product.title} /> : <div className="no-img">Rasm yo'q</div>}
          </div>
          {imgs.length > 1 && (
            <div className="thumbs">
              {imgs.map((src, i) => (
                <button key={src} className={i === img ? 'on' : ''} onClick={() => setImg(i)}>
                  <img src={src} alt="" />
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

        <div className="card bidbox">
          <div className="lot-price-label">
            {product.bidCount > 0 ? `Oxirgi taklif (${product.bidCount} ta)` : "Boshlang'ich narx"}
          </div>
          <PriceTicker value={product.currentPrice} big />
          {product.lastBidder && product.bidCount > 0 && (
            <div className="muted">Taklif egasi: @{product.lastBidder.username}</div>
          )}

          <div className="bid-time">
            <span className="muted">{active ? 'Tugashiga' : 'Holat'}</span>
            {active ? <Countdown endsAt={product.endsAt} big /> : <span className={`badge ${product.status}`}>{STATUS_LABEL[product.status]}</span>}
          </div>
          <div className="muted small">Tugash vaqti: {fmtDate(product.endsAt)}</div>
          {product.extensionUsed && active && (
            <div className="muted small">Taklif tushmagani uchun muddat 2 kunga uzaytirilgan</div>
          )}

          {active && !isAuthor && user && (
            <form className="bid-form" onSubmit={placeBid}>
              <input type="number" min={product.minNextBid} step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              <button className="btn accent" disabled={busy || !socket}>Taklif berish</button>
              <div className="muted small">Kamida {fmtPrice(product.minNextBid)}</div>
            </form>
          )}
          {active && !user && (
            <p className="muted">
              Taklif berish uchun <Link to="/login" state={{ from: `/product/${id}` }} className="link">tizimga kiring</Link>.
            </p>
          )}
          {active && isAuthor && (
            <div className="author-actions">
              <p className="muted small">Bu sizning mahsulotingiz.</p>
              {product.bidCount > 0 && (
                <button className="btn primary" onClick={accept}>Sotildi deb belgilash</button>
              )}
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
        </div>

        {product.description && (
          <>
            <h2>Tavsif</h2>
            <p className="desc">{product.description}</p>
          </>
        )}

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
        </div>
      </div>

      <section className="product-chat card">
        <div className="chat-heading">
          <div>
            <h2>Yozishmalar</h2>
            <p className="muted small">Muallif va xaridor o‘rtasidagi shaxsiy suhbat.</p>
          </div>
        </div>
        {!user ? (
          <p className="muted">
            Yozishmalar uchun <Link to="/login" state={{ from: `/product/${id}` }} className="link">tizimga kiring</Link>.
          </p>
        ) : (
          <div className={`chat-layout ${isAuthor ? 'seller-chat' : ''}`}>
            {isAuthor && (
              <aside className="chat-conversations">
                <h3>Xaridorlar</h3>
                {conversations.length === 0 ? (
                  <p className="muted small">Hozircha yozishma yo‘q.</p>
                ) : conversations.map(({ buyer, message }) => (
                  <button
                    key={buyer._id}
                    className={`chat-conversation ${chatBuyerId === buyer._id ? 'selected' : ''}`}
                    onClick={() => setChatBuyerId(buyer._id)}
                  >
                    <strong>@{buyer.username}</strong>
                    <span>{message.text}</span>
                  </button>
                ))}
              </aside>
            )}
            <div className="chat-thread">
              {!threadBuyerId ? (
                <p className="muted">Xaridor yozganda suhbat shu yerda ko‘rinadi.</p>
              ) : (
                <>
                  <div className="chat-messages" aria-live="polite">
                    {messages.length === 0 ? (
                      <p className="muted small">Suhbatni boshlash uchun xabar yozing.</p>
                    ) : messages.map((message) => (
                      <article
                        key={message._id}
                        className={`chat-message ${message.sender?._id === user._id ? 'mine' : ''}`}
                      >
                        <div className="chat-message-meta">
                          <strong>@{message.sender?.username}</strong>
                          <time>{fmtDate(message.createdAt)}</time>
                        </div>
                        <p>{message.text}</p>
                      </article>
                    ))}
                  </div>
                  {canChat ? (
                    <form className="chat-form" onSubmit={sendMessage}>
                      <textarea
                        rows={2}
                        maxLength={2000}
                        value={chatText}
                        onChange={(e) => setChatText(e.target.value)}
                        placeholder="Xabaringizni yozing..."
                        required
                      />
                      <button className="btn primary" disabled={chatBusy || !chatText.trim()}>
                        {chatBusy ? 'Yuborilmoqda...' : 'Yuborish'}
                      </button>
                    </form>
                  ) : (
                    <p className="muted small">Bu mahsulot bo‘yicha yangi yozishmalar yopilgan.</p>
                  )}
                </>
              )}
              {chatError && <div className="alert error">{chatError}</div>}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
