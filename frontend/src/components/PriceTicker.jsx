import { useEffect, useRef, useState } from 'react';
import { fmtPrice } from '../utils';

// Narx o'zgarganda qisqa vaqt yonib turadi: jonli taklif belgisi
export default function PriceTicker({ value, big = false }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span className={`price ${big ? 'big' : ''} ${flash ? 'flash' : ''}`}>
      {fmtPrice(value)}
    </span>
  );
}
