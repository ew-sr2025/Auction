import { useEffect, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');

export default function Countdown({ endsAt, big = false }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return <span className={`countdown ended ${big ? 'big' : ''}`}>Tugadi</span>;

  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const urgent = ms < 60 * 60 * 1000;

  return (
    <span className={`countdown ${urgent ? 'urgent' : ''} ${big ? 'big' : ''}`}>
      {d > 0 && `${d} kun `}
      {pad(h)}:{pad(m)}:{pad(sec)}
    </span>
  );
}
