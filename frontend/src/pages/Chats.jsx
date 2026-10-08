import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { assetUrl } from '../config.js';
import { fmtDate, fmtPrice } from '../utils';

export default function Chats() {
  const { productId, buyerId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const [conversations, setConversations] = useState([]);
  const [product, setProduct] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/chats/conversations');
      setConversations(data.conversations);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!socket) return undefined;
    const onInboxMessage = () => loadConversations();
    socket.on('chat:inbox:new', onInboxMessage);
    return () => socket.off('chat:inbox:new', onInboxMessage);
  }, [loadConversations, socket]);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setMessages([]);
      return undefined;
    }

    let cancelled = false;
    setError('');
    setProduct(null);
    setMessages([]);
    api.get(`/products/${productId}`)
      .then(({ data }) => {
        if (!cancelled) setProduct(data.product);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e));
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const isAuthor = Boolean(product && product.author?._id === user?._id);
  const threadBuyerId = isAuthor ? buyerId : user?._id;

  const loadMessages = useCallback(async () => {
    if (!productId || !threadBuyerId) {
      setMessages([]);
      return;
    }
    try {
      const { data } = await api.get(`/products/${productId}/messages`, {
        params: isAuthor ? { buyerId: threadBuyerId } : undefined,
      });
      setMessages(data.messages);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
  }, [isAuthor, productId, threadBuyerId]);

  useEffect(() => {
    if (!product || !threadBuyerId || !socket) return undefined;

    const join = () => {
      socket.emit('chat:join', {
        productId,
        ...(isAuthor ? { buyerId: threadBuyerId } : {}),
      }, (result) => {
        if (!result?.ok) setError(result?.message || 'Suhbatga ulanib bo‘lmadi');
      });
      loadMessages();
    };
    const onMessage = (message) => {
      if (message.productId !== productId || message.buyerId !== threadBuyerId) return;
      setMessages((current) =>
        current.some((item) => item._id === message._id) ? current : [...current, message]
      );
    };

    join();
    socket.on('connect', join);
    socket.on('chat:new', onMessage);
    return () => {
      socket.emit('chat:leave', { productId, buyerId: threadBuyerId });
      socket.off('connect', join);
      socket.off('chat:new', onMessage);
    };
  }, [isAuthor, loadMessages, product, productId, socket, threadBuyerId]);

  const sendMessage = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post(`/products/${productId}/messages`, {
        text,
        ...(isAuthor ? { buyerId: threadBuyerId } : {}),
      });
      setText('');
      await Promise.all([loadMessages(), loadConversations()]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const isWinner = product?.winner?._id === user?._id;
  const active = product?.status === 'active' && new Date(product.endsAt) > new Date();
  const canChat = Boolean(
    active ||
    (product?.status === 'sold' &&
      (isWinner || (isAuthor && threadBuyerId === product.winner?._id)))
  );
  const selectedBuyerId = isAuthor ? buyerId : user?._id;

  return (
    <section className="chats-page">
      <div className="page-head">
        <div>
          <h1>Chatlar</h1>
          <p className="muted">Mahsulotlar bo‘yicha barcha yozishmalaringiz.</p>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="chats-layout">
        <aside className="chat-sidebar card" aria-label="Suhbatlar ro‘yxati">
          {conversations.length === 0 ? (
            <p className="muted small">Hozircha suhbatlar yo‘q. Mahsulot sahifasidan muallifga yozishingiz mumkin.</p>
          ) : conversations.map((conversation) => (
            <Link
              key={`${conversation.product._id}-${conversation.buyer._id}`}
              className={`chat-conversation ${productId === conversation.product._id && selectedBuyerId === conversation.buyer._id ? 'selected' : ''}`}
              to={`/chats/${conversation.product._id}/${conversation.buyer._id}`}
            >
              <strong>@{conversation.participant.username}</strong>
              <span className="chat-product-title">{conversation.product.title}</span>
              <span>{conversation.message.text}</span>
              <time className="muted small">{fmtDate(conversation.message.createdAt)}</time>
            </Link>
          ))}
        </aside>

        <div className="chat-main card">
          {!productId ? (
            <p className="muted">Suhbatni ko‘rish uchun chap tomondan tanlang.</p>
          ) : !product ? (
            <p className="muted">Mahsulot yuklanmoqda...</p>
          ) : isAuthor && !buyerId ? (
            <p className="muted">Sotuvchi sifatida suhbatni chap tomondan tanlang.</p>
          ) : (
            <>
              <Link className="chat-product-context" to={`/product/${product._id}`}>
                {product.images?.[0]
                  ? <img src={assetUrl(product.images[0])} alt="" />
                  : <div className="chat-product-placeholder">Rasm yo‘q</div>}
                <span>
                  <strong>{product.title}</strong>
                  <span className="muted small">{fmtPrice(product.currentPrice)}</span>
                </span>
              </Link>
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
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Xabaringizni yozing..."
                    required
                  />
                  <button className="btn primary" disabled={busy || !text.trim()}>
                    {busy ? 'Yuborilmoqda...' : 'Yuborish'}
                  </button>
                </form>
              ) : (
                <p className="muted small">Bu mahsulot bo‘yicha yangi yozishmalar yopilgan.</p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
