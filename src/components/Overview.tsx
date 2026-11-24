'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, DataTable, PageShell, State, useFetch, useFilters } from './kit';
import { dec, dmy, dmyFull, int, money, pct } from './format';

const fmtUnit = (unit: string, v: number) =>
  v == null || isNaN(v) ? '–' : unit === 'pct' ? pct(v) : unit === 'x' ? dec(v) : int(v);

const STATUS_TXT: Record<string, string> = { good: 'Đạt mục tiêu', warn: 'Cần chú ý', bad: 'Dưới ngưỡng' };

function TargetHint({ m }: { m: any }) {
  if (!m.target) return null;
  const lowerIsGood = m.target.good < m.target.warn;
  const f = (v: number) => fmtUnit(m.unit, v);
  return <span className="thint">{lowerIsGood ? `Tốt ≤ ${f(m.target.good)} · Cảnh báo > ${f(m.target.warn)}` : `Tốt ≥ ${f(m.target.good)} · Cảnh báo < ${f(m.target.warn)}`}</span>;
}

function T1Card({ m }: { m: any }) {
  const d = m.delta;
  return (
    <div className={'t1 ' + (m.status || 'none')}>
      <div className="t1-top"><span>{m.label}</span>{m.status && <i className={'dot ' + m.status} title={STATUS_TXT[m.status]} />}</div>
      <div className="t1-val">
        {m.key === 'old_share' ? <>{pct(m.value, 0)} <small>cũ</small> · {pct(m.extra?.newShare ?? 0, 0)} <small>mới</small></> : fmtUnit(m.unit, m.value)}
      </div>
      {d != null ? (
        <div className={'delta ' + (m.neutral ? 'flat' : m.worse ? 'down' : 'up')}>
          {d > 0 ? '▲' : '▼'} {pct(Math.abs(d))} <small>vs kỳ trước ({m.key === 'old_share' ? pct(m.prev, 0) : fmtUnit(m.unit, m.prev)})</small>
        </div>
      ) : <div className="delta flat"><small>Chưa có kỳ so sánh</small></div>}
      <div className="t1-note">{m.key === 'spend' && m.extra?.fee ? `Đã gồm thuế phí +${dec(m.extra.fee, 1)}%` : m.note}</div>
      <TargetHint m={m} />
    </div>
  );
}

const TABS: [string, string][] = [['account', 'Tài khoản QC'], ['region', 'Vùng miền'], ['gender', 'Giới tính'], ['age', 'Độ tuổi'], ['category', 'Loại sản phẩm'], ['page', 'Page'], ['format', 'Hình thức chạy'], ['media', 'Media'], ['product', 'Mã sản phẩm'], ['creative', 'Mã media'], ['source', 'Nguồn đơn'], ['campaign', 'Camp'], ['hour', 'Khung giờ'], ['device', 'Thiết bị']];
const SRC_NOTE: Record<string, string> = {
  region: 'Chi phí và doanh số theo vùng miền (dữ liệu mẫu).',
  gender: 'Chi phí và doanh số theo giới tính (dữ liệu mẫu).',
  age: 'Chi phí và doanh số theo độ tuổi (dữ liệu mẫu).',
  category: 'Doanh số, đơn và chi phí theo loại sản phẩm (dữ liệu mẫu).',
  hour: 'Chi phí và doanh số theo khung giờ trong ngày (dữ liệu mẫu).',
  device: 'Chi phí theo thiết bị (dữ liệu mẫu, không có doanh số theo thiết bị).',
  account: 'Chi phí theo tài khoản quảng cáo; doanh số của các đơn gắn được vào camp thuộc tài khoản đó (đơn không gắn camp nằm ở dòng “Không gắn QC”).',
  page: 'Chi phí theo page (camp), doanh số theo page của đơn.', format: 'Hình thức chạy lấy từ tên camp (Purchase, Mess, Mess Sale...).', media: 'Media lấy từ tên camp (Video, Hình ảnh).', product: 'Mã sản phẩm lấy từ tên camp.', creative: 'Mã media (creative) lấy từ tên camp, ví dụ V001.', source: 'Nguồn đơn trên Poscake; toàn bộ chi phí Meta tính vào Facebook.', campaign: 'Theo camp quảng cáo.',
};
const MET: { key: string; label: string; unit: string; get: (r: any) => number; lowerBetter?: boolean }[] = [
  { key: 'spend', label: 'Chi phí', unit: 'money', get: (r) => r.spend },
  { key: 'cost_inbox', label: 'CP/Inbox', unit: 'money', get: (r) => r.cost_inbox, lowerBetter: true },
  { key: 'revenue', label: 'Doanh số', unit: 'money', get: (r) => r.revenue },
  { key: 'cpo', label: 'CPO', unit: 'money', get: (r) => r.cost_order, lowerBetter: true },
  { key: 'cp_rev', label: 'CP/DS', unit: 'pct', get: (r) => r.cp_rev, lowerBetter: true },
  { key: 'roas', label: 'ROAS', unit: 'x', get: (r) => r.roas },
  { key: 'aov', label: 'AOV', unit: 'money', get: (r) => r.aov },
  { key: 'aov_new', label: 'AOV khách mới', unit: 'money', get: (r) => r.aov_new },
  { key: 'aov_old', label: 'AOV khách cũ', unit: 'money', get: (r) => r.aov_old },
  { key: 'close_rate', label: 'Tỉ lệ chốt', unit: 'pct', get: (r) => r.close_rate },
  { key: 'new_revenue', label: 'Doanh số khách mới', unit: 'money', get: (r) => r.new_revenue },
];

function Breakdown({ f, dim, setDim, cmp }: { f: ReturnType<typeof useFilters>; dim: string; setDim: (d: string) => void; cmp: string }) {
  const [metric, setMetric] = useState('revenue');
  const { data, loading, error } = useFetch<any>(`/api/report/breakdown?dim=${dim}&from=${f.from}&to=${f.to}&cmp=${cmp}`);
  const rows: any[] = data?.rows || [];
  const hasSpend = data?.hasSpend !== false;
  const hasOrders = data?.hasOrders !== false;
  const OBJ = ['spend', 'cost_inbox'];
  const metrics = MET.filter((m) => (hasOrders || OBJ.includes(m.key)) && (hasSpend || !['spend', 'cost_inbox', 'cpo', 'cp_rev', 'roas', 'close_rate'].includes(m.key)));
  const met = metrics.find((m) => m.key === metric) || metrics.find((m) => m.key === 'revenue') || metrics[0];
  const tableRows = useMemo(() => rows.map((r) => {
    const dl = (g: (x: any) => number) => (r.prev && g(r.prev) ? ((g(r.cur) - g(r.prev)) / Math.abs(g(r.prev))) * 100 : null);
    return { ...r.cur, label: r.label, d_revenue: dl((x) => x.revenue), d_cpo: dl((x) => x.cost_order), d_cp_rev: dl((x) => x.cp_rev), d_roas: dl((x) => x.roas), d_aov: dl((x) => x.aov) };
  }), [rows]);
  const chart = rows.filter((r) => r.cur.orders > 0 || r.cur.spend > 0).slice(0, 12).map((r) => ({ label: r.label, cur: met.get(r.cur), prev: r.prev ? met.get(r.prev) : 0 }));
  const dcell = (v: number | null, lower?: boolean) => v == null ? '' : <small className={(lower ? v > 0 : v < 0) ? 'neg' : 'pos'}> {v > 0 ? '▲' : '▼'}{pct(Math.abs(v), 0)}</small>;
  const noSpend = (v: any) => (hasSpend ? v : '–');
  return (
    <Card title="Tầng 3 · Chỉ số nguyên nhân (bóc tách)" sub={SRC_NOTE[dim]}>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={dim === k ? 'on' : ''} onClick={() => setDim(k)}>{l}</button>)}</div>
      <State loading={loading} error={error} empty={!loading && !error && !rows.length} />
      {rows.length > 0 && (
        <>
          <div className="row"><label>Biểu đồ theo chỉ số
            <select value={met.key} onChange={(e) => setMetric(e.target.value)} style={{ width: 'auto' }}>{metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: chart.length > 6 ? 36 : 0 }}>
              <CartesianGrid stroke="#eef0f4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={chart.length > 6 ? -25 : 0} textAnchor={chart.length > 6 ? 'end' : 'middle'} height={chart.length > 6 ? 56 : 30} />
              <YAxis tickFormatter={(v) => fmtUnit(met.unit, v)} tick={{ fontSize: 11 }} width={92} />
              <Tooltip formatter={(v: any) => fmtUnit(met.unit, Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="cur" name="Kỳ này" fill="#c8102e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              {data.prevRange && <Bar dataKey="prev" name="Kỳ trước" fill="#cdd2de" radius={[4, 4, 0, 0]} isAnimationActive={false} />}
            </BarChart>
          </ResponsiveContainer>
          <DataTable first={{ key: 'label', label: TABS.find((t) => t[0] === dim)![1] }} rows={tableRows} cols={!hasOrders ? [
            { key: 'spend', label: 'Chi phí', fmt: (v) => int(v) }, { key: 'impressions', label: 'Hiển thị', fmt: (v) => int(v) },
            { key: 'clicks', label: 'Click', fmt: (v) => int(v) }, { key: 'inbox', label: 'Inbox', fmt: (v) => int(v) },
            { key: 'cost_inbox', label: 'CP/Inbox', fmt: (v) => int(v), best: 'min' }, { key: 'cpm', label: 'CPM', fmt: (v) => int(v), best: 'min' },
          ] : [
            { key: 'spend', label: 'Chi phí', fmt: (v) => noSpend(int(v)) },
            { key: 'revenue', label: 'Doanh số', fmt: (v, r) => <>{int(v)}{dcell(r.d_revenue)}</> },
            { key: 'orders', label: 'Đơn', fmt: (v) => int(v) },
            { key: 'cost_order', label: 'CPO', fmt: (v, r) => hasSpend ? <>{int(v)}{dcell(r.d_cpo, true)}</> : '–', best: 'min' },
            { key: 'cp_rev', label: 'CP/DS', fmt: (v, r) => hasSpend ? <>{pct(v)}{dcell(r.d_cp_rev, true)}</> : '–', best: 'min' },
            { key: 'roas', label: 'ROAS', fmt: (v, r) => hasSpend ? <>{dec(v)}{dcell(r.d_roas)}</> : '–', best: 'max' },
            { key: 'close_rate', label: 'Tỉ lệ chốt', fmt: (v) => noSpend(pct(v)), best: 'max' },
            { key: 'aov', label: 'AOV', fmt: (v, r) => <>{int(v)}{dcell(r.d_aov)}</>, best: 'max' },
            { key: 'aov_new', label: 'AOV mới', fmt: (v) => int(v) },
            { key: 'aov_old', label: 'AOV cũ', fmt: (v) => int(v) },
            { key: 'cp_rev_new', label: 'CP/DS mới', fmt: (v) => noSpend(pct(v)), best: 'min' },
            { key: 'old_share', label: '% DS khách cũ', fmt: (v) => pct(v, 0) },
          ]} />
        </>
      )}
    </Card>
  );
}

export default function Overview() {
  const f = useFilters();
  const cmp = f.cmp === 'yoy' ? 'yoy' : 'prev';
  const { data, loading, error } = useFetch<any>(`/api/report/overview?from=${f.from}&to=${f.to}&cmp=${cmp}`);
  const [dim, setDim] = useState('region');
  const t3 = useRef<HTMLDivElement>(null);
  useEffect(() => { /* giữ tab khi đổi bộ lọc */ }, [f.from]);
  const goto = (d: string) => { setDim(d); setTimeout(() => t3.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };
  const t1 = data?.tier1 || [];
  const mkt = t1.filter((m: any) => m.group === 'MKT'), sale = t1.filter((m: any) => m.group === 'Sale');
    const empty = data && !data.hasPrev && !t1.some((m: any) => m.value);
  return (
    <PageShell crumbs={['Báo cáo', 'Tổng quan']} title="Tổng quan hiệu quả" f={f} compare={false}>
      <div className="row" style={{ marginTop: -4 }}>
        <label>So sánh với
          <select value={cmp} onChange={(e) => f.set({ cmp: e.target.value })} style={{ width: 'auto' }}>
            <option value="prev">Kỳ liền trước</option><option value="yoy">Cùng kỳ năm trước</option>
          </select></label>
        {data && <span className="muted">Khách mới = {data.factors.newCustomerDays ? `chưa mua trong ${data.factors.newCustomerDays} ngày trước` : 'chưa từng mua trước đó'} · chi phí ads {data.factors.adsFeePct ? `đã cộng ${dec(data.factors.adsFeePct, 1)}% thuế phí` : 'chưa cộng thuế phí'} </span>}
      </div>
      <State loading={loading} error={error} empty={!!empty} />
      {data && !empty && (
        <>
          <h2 className="tier">Tầng 1 · Chỉ số kết quả <small>dùng để cảnh báo</small></h2>
          <div className="blk"><h4>MKT</h4><div className="t1grid">{mkt.map((m: any) => <T1Card key={m.key} m={m} />)}</div></div>
          <div className="blk"><h4>Sale</h4><div className="t1grid">{sale.map((m: any) => <T1Card key={m.key} m={m} />)}</div></div>

          <h2 className="tier">Tầng 2 · Tách khách mới / khách cũ <small>chỉ số Tầng 1 xấu đi do nhóm nào?</small></h2>
          <div className="t1grid three">{data.tier2.map((m: any) => <T1Card key={m.key} m={m} />)}</div>
          <div className="grid2">
            <Card title="Doanh số khách mới và cũ theo ngày" className="span2">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#eef0f4" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={dmy} tick={{ fontSize: 11 }} minTickGap={24} />
                  <YAxis tickFormatter={money} tick={{ fontSize: 11 }} width={92} />
                  <Tooltip labelFormatter={(l) => dmyFull(String(l))} formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="new_revenue" name="Khách mới" stackId="a" fill="#c8102e" isAnimationActive={false} />
                  <Bar dataKey="old_revenue" name="Khách cũ" stackId="a" fill="#2563eb" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="So sánh khách mới và cũ">
              <table className="mini">
                <thead><tr><th></th><th>Khách mới</th><th>Khách cũ</th></tr></thead>
                <tbody>
                  <tr><td>Doanh số</td><td>{int(data.split.new.revenue)}</td><td>{int(data.split.old.revenue)}</td></tr>
                  <tr><td>Số đơn</td><td>{int(data.split.new.orders)}</td><td>{int(data.split.old.orders)}</td></tr>
                  <tr><td>AOV</td><td>{int(data.split.new.aov)}</td><td>{int(data.split.old.aov)}</td></tr>
                  <tr><td>CP/DS</td><td>{pct(data.split.new.cp_rev)}</td><td className="muted">không gắn chi phí</td></tr>
                </tbody>
              </table>
              <p className="muted">CP/DS khách mới = toàn bộ chi phí ads ÷ doanh số khách mới (xem như chi phí ads dành để kéo khách mới).</p>
            </Card>
          </div>

          <div id="t3" ref={t3} style={{ scrollMarginTop: 12 }}>
            <Breakdown f={f} dim={dim} setDim={setDim} cmp={cmp} />
          </div>
        </>
      )}
    </PageShell>
  );
}
