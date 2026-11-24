'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, Pie, PieChart, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PALETTE, addDays, deltaPct, dmy, dmyFull, int, money, pct, todayVN } from './format';

/* ---------------- Bộ lọc ---------------- */
export type Filters = { from: string; to: string; cmp: '' | 'prev' | 'yoy'; range: string; qs: string };

export const RANGES: [string, string][] = [
  ['today', 'Hôm nay'], ['yesterday', 'Hôm qua'], ['7', '7 ngày qua'], ['14', '14 ngày qua'], ['28', '28 ngày qua'], ['30', '30 ngày qua'],
  ['week', 'Tuần này'], ['lastweek', 'Tuần trước'], ['month', 'Tháng này'], ['lastmonth', 'Tháng trước'],
  ['quarter', 'Quý này'], ['lastquarter', 'Quý trước'], ['all', 'Tối đa'], ['custom', 'Tùy chọn…'],
];

const firstOfMonth = (iso: string, monthOffset = 0) => {
  const d = new Date(iso.slice(0, 7) + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + monthOffset);
  return d.toISOString().slice(0, 10);
};

/** Quy đổi lựa chọn khoảng thời gian ra từ ngày - đến ngày (giờ Việt Nam). "N ngày qua" không gồm hôm nay; tuần bắt đầu từ Chủ Nhật. */
export function resolveRange(range: string, customFrom?: string | null, customTo?: string | null) {
  const today = todayVN(), yesterday = addDays(today, -1);
  const dow = new Date(today + 'T00:00:00Z').getUTCDay();
  const weekStart = addDays(today, -dow);
  const qStart = (iso: string, offset = 0) => {
    const d = new Date(iso.slice(0, 7) + '-01T00:00:00Z');
    d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3 + offset * 3);
    return d.toISOString().slice(0, 10);
  };
  switch (range) {
    case 'today': return { from: today, to: today };
    case 'yesterday': return { from: yesterday, to: yesterday };
    case '7': case '14': case '28': case '30': return { from: addDays(yesterday, -(Number(range) - 1)), to: yesterday };
    case 'week': return { from: weekStart, to: today };
    case 'lastweek': return { from: addDays(weekStart, -7), to: addDays(weekStart, -1) };
    case 'month': return { from: firstOfMonth(today), to: today };
    case 'lastmonth': return { from: firstOfMonth(today, -1), to: addDays(firstOfMonth(today), -1) };
    case 'quarter': return { from: qStart(today), to: today };
    case 'lastquarter': return { from: qStart(today, -1), to: addDays(qStart(today), -1) };
    case 'all': return { from: '2000-01-01', to: today };
    case 'custom': return { from: customFrom || addDays(yesterday, -29), to: customTo || yesterday };
    default: return { from: addDays(yesterday, -29), to: yesterday };
  }
}

export function useFilters(): Filters & { set: (p: Record<string, string | null>) => void } {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const range = sp.get('r') || '30';
  const { from, to } = resolveRange(range, sp.get('f'), sp.get('t'));
  const cmp = (sp.get('cmp') || '') as Filters['cmp'];
  const qs = ['r', 'f', 't', 'cmp'].filter((k) => sp.get(k)).map((k) => `${k}=${sp.get(k)}`).join('&');
  const set = (p: Record<string, string | null>) => {
    const n = new URLSearchParams(sp.toString());
    Object.entries(p).forEach(([k, v]) => (v == null || v === '' ? n.delete(k) : n.set(k, v)));
    router.replace(`${path}?${n.toString()}`, { scroll: false });
  };
  return { from, to, cmp, range, qs, set };
}

const MONTH_NAMES = ['Th 1', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7', 'Th 8', 'Th 9', 'Th 10', 'Th 11', 'Th 12'];
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function monthShift(ym: string, n: number) {
  const d = new Date(ym + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

function Month({ ym, from, to, picking, onPick, max }: { ym: string; from: string; to: string; picking: boolean; onPick: (d: string) => void; max: string }) {
  const first = new Date(ym + '-01T00:00:00Z');
  const lead = (first.getUTCDay() + 6) % 7; // tuần bắt đầu từ Thứ Hai như màn hình Poscake
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  return (
    <div className="cal">
      <div className="cal-title">{MONTH_NAMES[first.getUTCMonth()]} {first.getUTCFullYear()}</div>
      <div className="cal-grid">
        {DOW.map((d) => <span key={d} className="dow">{d}</span>)}
        {cells.map((d, i) => d ? (
          <button key={i} type="button" disabled={d > max} className={'day' + (d >= from && d <= to ? ' in' : '') + (d === from || d === to ? ' edge' : '')} onClick={() => onPick(d)}>{Number(d.slice(8))}</button>
        ) : <span key={i} />)}
      </div>
      {picking && <div className="cal-hint">Chọn ngày kết thúc</div>}
    </div>
  );
}

function DateRangePicker({ f }: { f: ReturnType<typeof useFilters> }) {
  const [open, setOpen] = useState(false);
  const today = todayVN();
  const [draft, setDraft] = useState({ from: f.from, to: f.to, range: f.range });
  const [month, setMonth] = useState(f.from.slice(0, 7) < '2000-01' ? today.slice(0, 7) : f.from.slice(0, 7));
  const [picking, setPicking] = useState(false);
  const openIt = () => {
    setDraft({ from: f.from, to: f.to, range: f.range });
    setMonth(f.range === 'all' ? monthShift(today.slice(0, 7), -1) : f.from.slice(0, 7));
    setPicking(false);
    setOpen(true);
  };
  const label = RANGES.find((r) => r[0] === f.range && r[0] !== 'custom')?.[1];
  const text = f.range === 'all' ? `Tối đa (đến ${dmyFull(f.to)})` : `${dmyFull(f.from)} – ${dmyFull(f.to)}`;
  const pickPreset = (k: string) => {
    if (k === 'custom') { setDraft((d) => ({ ...d, range: 'custom' })); return; }
    const r = resolveRange(k);
    setDraft({ from: r.from, to: r.to, range: k });
    setMonth(k === 'all' ? monthShift(today.slice(0, 7), -1) : r.from.slice(0, 7));
    setPicking(false);
  };
  const pickDay = (d: string) => {
    if (!picking) { setDraft({ from: d, to: d, range: 'custom' }); setPicking(true); }
    else { setDraft((x) => ({ from: d < x.from ? d : x.from, to: d < x.from ? x.from : d, range: 'custom' })); setPicking(false); }
  };
  const apply = () => {
    if (draft.range === 'custom') f.set({ r: 'custom', f: draft.from, t: draft.to });
    else f.set({ r: draft.range, f: null, t: null });
    setOpen(false);
  };
  return (
    <div className="drp">
      <button type="button" className="drp-btn" onClick={openIt}>
        <span className="cal-ic">▦</span>
        {label ? <b>{label}</b> : null}
        <span>{text}</span>
      </button>
      {open && (
        <>
          <div className="drp-back" onClick={() => setOpen(false)} />
          <div className="drp-pop">
            <div className="drp-list">
              {RANGES.map(([k, l]) => <button key={k} type="button" className={draft.range === k ? 'on' : ''} onClick={() => pickPreset(k)}>{l}</button>)}
            </div>
            <div className="drp-main">
              <div className="drp-inputs">
                <input value={draft.range === 'all' ? '' : draft.from} placeholder="Từ ngày" type="date" onChange={(e) => e.target.value && setDraft({ from: e.target.value, to: draft.to < e.target.value ? e.target.value : draft.to, range: 'custom' })} />
                <span>→</span>
                <input value={draft.to} type="date" onChange={(e) => e.target.value && setDraft({ from: draft.from > e.target.value ? e.target.value : draft.from, to: e.target.value, range: 'custom' })} />
              </div>
              <div className="drp-cals">
                <button type="button" className="nav" onClick={() => setMonth(monthShift(month, -12))}>«</button>
                <button type="button" className="nav" onClick={() => setMonth(monthShift(month, -1))}>‹</button>
                <Month ym={month} from={draft.from} to={draft.to} picking={picking} onPick={pickDay} max={today} />
                <Month ym={monthShift(month, 1)} from={draft.from} to={draft.to} picking={picking} onPick={pickDay} max={today} />
                <button type="button" className="nav" onClick={() => setMonth(monthShift(month, 1))}>›</button>
                <button type="button" className="nav" onClick={() => setMonth(monthShift(month, 12))}>»</button>
              </div>
              <div className="drp-foot">
                <span className="muted">Giờ Việt Nam · {dmyFull(draft.from)} – {dmyFull(draft.to)}</span>
                <span><button type="button" onClick={() => setOpen(false)}>Đóng</button> <button type="button" className="primary" onClick={apply}>Áp dụng</button></span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function compareText(f: ReturnType<typeof useFilters>) {
  if (!f.cmp) return '';
  const days = Math.round((+new Date(f.to) - +new Date(f.from)) / 86400000) + 1;
  if (f.cmp === 'yoy') {
    const y = (iso: string) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() - 1); return d.toISOString().slice(0, 10); };
    return `Cùng kỳ năm trước: ${dmyFull(y(f.from))} – ${dmyFull(y(f.to))}`;
  }
  return `Trước đó ${days} ngày: ${dmyFull(addDays(f.from, -days))} – ${dmyFull(addDays(f.to, -days))}`;
}

export function FilterBar({ f, compare = true }: { f: ReturnType<typeof useFilters>; compare?: boolean }) {
  return (
    <div className="filters">
      <span className="flabel">Khoảng thời gian</span>
      <DateRangePicker f={f} />
      {compare && (
        <>
          <label className="switch">
            <input type="checkbox" checked={!!f.cmp} onChange={(e) => f.set({ cmp: e.target.checked ? 'prev' : null })} />
            <i /> So sánh với
          </label>
          {f.cmp && (
            <>
              <select value={f.cmp} onChange={(e) => f.set({ cmp: e.target.value })}>
                <option value="prev">Kỳ liền trước</option>
                <option value="yoy">Cùng kỳ năm trước</option>
              </select>
              <span className="muted cmp-txt">{compareText(f)}</span>
            </>
          )}
        </>
      )}
      <button className="ghost" onClick={() => f.set({ r: null, f: null, t: null, cmp: null })}>Đặt lại bộ lọc</button>
    </div>
  );
}

export function useFetch<T = any>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    fetch(url).then((r) => r.json()).then((j) => {
      if (!alive) return;
      if (j.error) setError(j.error); else { setError(''); setData(j); }
    }).catch((e) => alive && setError(String(e))).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [url]);
  return { data, loading, error };
}

export function PageShell({ crumbs, title, children, f, compare }: { crumbs: string[]; title: string; children: React.ReactNode; f?: ReturnType<typeof useFilters>; compare?: boolean }) {
  return (
    <div className="page">
      <div className="crumbs">{crumbs.map((c, i) => <span key={i} className={i === crumbs.length - 1 ? 'cur' : ''}>{c}{i < crumbs.length - 1 ? ' / ' : ''}</span>)}</div>
      <h1>{title}</h1>
      {f && <FilterBar f={f} compare={compare} />}
      {children}
    </div>
  );
}

export function State({ loading, error, empty }: { loading: boolean; error: string; empty?: boolean }) {
  if (error) return <div className="state err">Lỗi: {error}</div>;
  if (loading) return <div className="state">Đang tải dữ liệu…</div>;
  if (empty) return <div className="state">Chưa có dữ liệu mẫu cho mục này.</div>;
  return null;
}

/* ---------------- KPI ---------------- */
export type KpiDef = {
  label: string; icon?: string; value: string; sub?: string; cur?: number; prev?: number | null; lowerBetter?: boolean; spark?: string; hero?: boolean;
};

export function KpiGrid({ items, daily }: { items: KpiDef[]; daily?: any[] }) {
  return (
    <div className="kpis">
      {items.map((k) => {
        const d = k.cur != null ? deltaPct(k.cur, k.prev) : null;
        const good = d == null ? null : k.lowerBetter ? d < 0 : d > 0;
        return (
          <div key={k.label} className={'kpi' + (k.hero ? ' hero' : '')}>
            <div className="kpi-top"><span>{k.label}</span><i>{k.icon}</i></div>
            <div className="kpi-val">{k.value}</div>
            {d != null && <div className={'delta ' + (good ? 'up' : 'down')}>{d > 0 ? '▲' : '▼'} {pct(Math.abs(d))} <small>so với kỳ trước</small></div>}
            {k.sub && d == null && <div className="kpi-sub">{k.sub}</div>}
            {k.spark && daily && daily.length > 1 && (
              <div className="spark">
                <ResponsiveContainer width="100%" height={34}>
                  <AreaChart data={daily} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
                    <Area type="monotone" dataKey={k.spark} stroke={k.hero ? '#fff' : '#c8102e'} fill={k.hero ? 'rgba(255,255,255,.25)' : 'rgba(200,16,46,.12)'} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Insight({ children }: { children: React.ReactNode }) {
  return <div className="insight">{children}</div>;
}

export function Card({ title, sub, children, right, className = '' }: { title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <section className={'card ' + className}>
      <header><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>{right}</header>
      {children}
    </section>
  );
}

/* ---------------- Biểu đồ ---------------- */
const tip = { contentStyle: { borderRadius: 8, border: '1px solid #e6e8ee', fontSize: 12 } };

export function TimeLines({ data, keys, prefix, fmt = money, height = 280 }: { data: any[]; keys: string[]; prefix: string; fmt?: (v: number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#eef0f4" vertical={false} />
        <XAxis dataKey="date" tickFormatter={dmy} tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={92} />
        <Tooltip {...tip} labelFormatter={(l) => dmyFull(String(l))} formatter={(v: any) => fmt(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => <Line key={k} type="monotone" dataKey={`${prefix}${k}`} name={k} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} isAnimationActive={false} />)}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, nameKey, valueKey, fmt = money, center }: { data: any[]; nameKey: string; valueKey: string; fmt?: (v: number) => string; center?: string }) {
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  return (
    <div className="donut">
      <div className="donut-chart">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={58} outerRadius={88} paddingAngle={1} isAnimationActive={false}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip {...tip} formatter={(v: any) => fmt(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center"><b>{fmt(total)}</b><span>{center}</span></div>
      </div>
      <ul className="legend">
        {data.map((d, i) => (
          <li key={i}><i style={{ background: PALETTE[i % PALETTE.length] }} /><span>{d[nameKey]}</span><b>{total ? pct((d[valueKey] / total) * 100) : '–'}</b></li>
        ))}
      </ul>
    </div>
  );
}

export function Bars({ data, x, bars, fmt = money, height = 260, rotate }: { data: any[]; x: string; bars: { key: string; name: string; color?: string }[]; fmt?: (v: number) => string; height?: number; rotate?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: rotate ? 40 : 0 }}>
        <CartesianGrid stroke="#eef0f4" vertical={false} />
        <XAxis dataKey={x} tick={{ fontSize: 11 }} interval={0} angle={rotate ? -30 : 0} textAnchor={rotate ? 'end' : 'middle'} height={rotate ? 60 : 30} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={92} />
        <Tooltip {...tip} formatter={(v: any) => fmt(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map((b, i) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color || PALETTE[i]} radius={[4, 4, 0, 0]} isAnimationActive={false} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SpendRevenueDaily({ daily }: { daily: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#eef0f4" vertical={false} />
        <XAxis dataKey="date" tickFormatter={dmy} tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis yAxisId="l" tickFormatter={money} tick={{ fontSize: 11 }} width={92} />
        <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => v.toFixed(1)} tick={{ fontSize: 11 }} width={36} />
        <Tooltip {...tip} labelFormatter={(l) => dmyFull(String(l))} formatter={(v: any, n: any) => (n === 'ROAS' ? Number(v).toFixed(2) : money(Number(v)))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="l" dataKey="spend" name="Ngân sách" fill="#f2b8c0" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar yAxisId="l" dataKey="revenue" name="Doanh thu" fill="#c8102e" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Line yAxisId="r" type="monotone" dataKey="roas" name="ROAS" stroke="#111827" strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Danh sách thanh so sánh: thanh đỏ = tốt nhất */
export function RankBars({ rows, label, value, fmt, better }: { rows: any[]; label: string; value: string; fmt: (v: number) => string; better: 'min' | 'max' }) {
  const valid = rows.filter((r) => r[value] > 0);
  const best = valid.length ? (better === 'min' ? Math.min(...valid.map((r) => r[value])) : Math.max(...valid.map((r) => r[value]))) : null;
  const max = Math.max(1, ...rows.map((r) => r[value] || 0));
  return (
    <div className="rank">
      {rows.map((r) => (
        <div key={r.k ?? r[label]} className="rank-row">
          <div className="rank-name" title={r[label]}>{r[label]}</div>
          <div className="rank-bar"><div className={r[value] === best ? 'best' : ''} style={{ width: `${((r[value] || 0) / max) * 100}%` }} /></div>
          <b>{r[value] > 0 ? fmt(r[value]) : '–'}</b>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Bảng ---------------- */
export type Col = { key: string; label: string; group?: string; fmt?: (v: any, row: any) => React.ReactNode; best?: 'min' | 'max'; w?: number; align?: 'left' | 'right' };

export function DataTable({ cols, rows, total, first, search, maxRows = 500 }: { cols: Col[]; rows: any[]; total?: any; first: Col; search?: boolean; maxRows?: number }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [term, setTerm] = useState('');
  const view = useMemo(() => {
    let r = rows;
    if (term) r = r.filter((x) => String(x[first.key] ?? '').toLowerCase().includes(term.toLowerCase()));
    if (sort) r = [...r].sort((a, b) => ((a[sort.key] ?? 0) > (b[sort.key] ?? 0) ? 1 : -1) * sort.dir);
    return r.slice(0, maxRows);
  }, [rows, sort, term, first.key, maxRows]);
  const bests = useMemo(() => {
    const m: Record<string, number> = {};
    cols.forEach((c) => {
      if (!c.best) return;
      const v = rows.map((r) => r[c.key]).filter((x) => typeof x === 'number' && x > 0);
      if (v.length > 1) m[c.key] = c.best === 'min' ? Math.min(...v) : Math.max(...v);
    });
    return m;
  }, [rows, cols]);
  const groups: { name: string; span: number }[] = [];
  cols.forEach((c) => { const g = c.group || ''; if (groups.length && groups[groups.length - 1].name === g) groups[groups.length - 1].span++; else groups.push({ name: g, span: 1 }); });
  const th = (c: Col) => (
    <th key={c.key} className={c.align === 'left' ? 'l' : ''} onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: (-s.dir as 1 | -1) } : { key: c.key, dir: -1 }))}>
      {c.label}{sort?.key === c.key ? (sort.dir === -1 ? ' ↓' : ' ↑') : ''}
    </th>
  );
  return (
    <div>
      {search && <input className="search" placeholder="Tìm theo tên…" value={term} onChange={(e) => setTerm(e.target.value)} />}
      <div className="tablewrap">
        <table>
          <thead>
            {groups.some((g) => g.name) && <tr className="grp"><th />{groups.map((g, i) => <th key={i} colSpan={g.span}>{g.name}</th>)}</tr>}
            <tr>{th({ ...first, align: 'left' })}{cols.map(th)}</tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={r.k ?? i}>
                <td className="l first" title={String(r[first.key] ?? '')}>{first.fmt ? first.fmt(r[first.key], r) : r[first.key]}</td>
                {cols.map((c) => (
                  <td key={c.key} className={bests[c.key] != null && r[c.key] === bests[c.key] ? 'best' : ''}>{c.fmt ? c.fmt(r[c.key], r) : r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {total && (
            <tfoot>
              <tr><td className="l first">Tổng</td>{cols.map((c) => <td key={c.key}>{c.fmt ? c.fmt(total[c.key], total) : total[c.key]}</td>)}</tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export { int, money, pct };
