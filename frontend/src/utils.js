export const fmtPrice = (n) =>
  `${Number(n || 0).toLocaleString('ru-RU')} so'm`;

export const fullName = (u) =>
  u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username : '';

export const fmtDate = (d) =>
  new Date(d).toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const STATUS_LABEL = {
  active: 'Faol',
  sold: 'Kelishilgan',
  expired: 'Muddati tugagan',
};
0