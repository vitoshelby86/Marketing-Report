export const nf = new Intl.NumberFormat('vi-VN');

export const int = (v: number) => (v == null || isNaN(v) ? '–' : nf.format(Math.round(v)));
export const dec = (v: number, d = 2) => (v == null || isNaN(v) ? '–' : v.toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: d }));
export const pct = (v: number, d = 1) => (v == null || isNaN(v) ? '–' : `${dec(v, d)}%`);

export function money(v: number) {
  return int(v);
}
export const dong = (v: number) => (v == null || isNaN(v) ? '–' : `${nf.format(Math.round(v))}`);

export function deltaPct(cur: number, prev: number | null | undefined) {
  if (prev == null || !prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export const todayVN = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const dmy = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '');
export const dmyFull = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

export const PALETTE = ['#1877F2', '#c8102e', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#64748b'];
