import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';

const numberFormat = new Intl.NumberFormat('uz-UZ');

export default function About() {
  const [stats, setStats] = useState(null);
  const [news, setNews] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/site/stats')
      .then(({ data }) => {
        if (!cancelled) setStats(data.stats);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get('/site/news')
      .then(({ data }) => {
        if (!cancelled) setNews(data.news);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statItems = [
    { label: "Ro‘yxatdan o‘tgan foydalanuvchilar", value: stats?.users },
    { label: "E’lon qilingan mahsulotlar", value: stats?.products },
    { label: 'Hozir savdoda', value: stats?.activeProducts },
    { label: 'Muvaffaqiyatli sotilgan', value: stats?.soldProducts },
  ];

  return (
    <section className="about-page">
      <header className="about-hero card">
        <p className="about-eyebrow">LOT · ONLAYN AUKSION</p>
        <h1>Mahsulotingiz uchun eng yaxshi taklif</h1>
        <p className="muted">
          Lot — O‘zbekiston bo‘ylab mahsulotlarni auksion orqali sotish va xarid
          qilish uchun yaratilgan onlayn platforma.
        </p>
        <p className="about-launch">Sayt 5-oktabr kuni internetga chiqarilgan.</p>
      </header>

      <section className="about-stats" aria-label="Sayt statistikasi">
        {statItems.map(({ label, value }) => (
          <article className="about-stat card" key={label}>
            <strong>
              {stats ? numberFormat.format(value) : '—'}
            </strong>
            <span>{label}</span>
          </article>
        ))}
      </section>
      {error && <div className="alert error">{error}</div>}
      {!stats && !error && <p className="muted center">Statistika yuklanmoqda...</p>}
      <p className="muted small about-stats-note">
        Statistika ma’lumotlar bazasidagi joriy holatni ko‘rsatadi. Mahsulotlar
        soniga o‘chirilmagan e’lonlar kiradi; sotilganlar soni sotilgan deb
        belgilangan mahsulotlarni hisoblaydi.
      </p>

      <section className="about-news">
        <div className="page-head">
          <div>
            <h2>Yangiliklar</h2>
            <p className="muted">Sayt e’lonlari va auksionlardagi yirik savdolar.</p>
          </div>
        </div>
        {news.length === 0 ? (
          <p className="empty">Hozircha yangiliklar yo‘q.</p>
        ) : (
          <div className="news-list">
            {news.map((item) => (
              <article className="news-card card" key={item._id}>
                {item.image && <img src={item.image} alt="" className="news-image" />}
                <div className="news-copy">
                  <span className={`badge ${item.type === 'successful-sale' ? 'sold' : 'active'}`}>
                    {item.type === 'successful-sale' ? 'Muvaffaqiyatli savdo' : 'Sayt yangiligi'}
                  </span>
                  <h3>{item.title}</h3>
                  <p className="muted">{item.body}</p>
                  <time className="muted small">{new Date(item.createdAt).toLocaleDateString('uz-UZ')}</time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="about-details card">
        <h2>Lot qanday ishlaydi?</h2>
        <div className="about-detail-grid">
          <article>
            <h3>Auksionda qatnashing</h3>
            <p className="muted">
              Mahsulotni ko‘rib chiqing, taklif kiriting va narx o‘zgarishini
              real vaqtda kuzating.
            </p>
          </article>
          <article>
            <h3>O‘zbekiston hududlari</h3>
            <p className="muted">
              E’lon joylashda viloyat va tuman yoki shaharni tanlab,
              mahsulot qayerdaligini xaridorlarga ko‘rsating.
            </p>
          </article>
          <article>
            <h3>Mahsulot bo‘yicha suhbat</h3>
            <p className="muted">
              Muallif va xaridor mahsulotga biriktirilgan alohida chatda
              yozishishi mumkin.
            </p>
          </article>
          <article>
            <h3>Xavfsiz foydalanish</h3>
            <p className="muted">
              Shubhali e’lonlar haqida xabar berish va qoidabuzarliklarni
              moderatsiya qilish imkoniyati mavjud.
            </p>
          </article>
        </div>
      </section>
    </section>
  );
}
