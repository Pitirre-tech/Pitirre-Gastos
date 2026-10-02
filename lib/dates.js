const TZ = 'America/Puerto_Rico';

export function todayPR() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

const pad = (n) => String(n).padStart(2, '0');

export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const nextY = m === 12 ? y + 1 : y, nextM = m === 12 ? 1 : m + 1;
  const prevY = m === 1 ? y - 1 : y, prevM = m === 1 ? 12 : m - 1;
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${nextY}-${pad(nextM)}-01`,
    prev: `${prevY}-${pad(prevM)}`,
    next: `${nextY}-${pad(nextM)}`,
  };
}

export function monthLabel(month, lang) {
  const [y, m] = month.split('-').map(Number);
  const s = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang === 'es' ? 'es-PR' : 'en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shortDate(iso, lang) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(lang === 'es' ? 'es-PR' : 'en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}
