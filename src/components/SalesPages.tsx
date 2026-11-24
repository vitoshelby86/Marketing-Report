'use client';
import { Bars, Card, Col, DataTable, Donut, Insight, KpiGrid, PageShell, State, TimeLines, useFetch, useFilters } from './kit';
import { dec, dmy, int, money, pct } from './format';

/** Ô số kèm % thay đổi so với kỳ so sánh (nếu có). lower = chỉ số thấp là tốt. */
const dlt = (cur: number, prev: number | null | undefined, lower = false) => {
  if (prev == null || !prev) return null;
  const v = ((cur - prev) / Math.abs(prev)) * 100;
  return <small className={(lower ? v > 0 : v < 0) ? 'neg' : 'pos'}> {v > 0 ? '▲' : '▼'}{pct(Math.abs(v), 0)}</small>;
};
const pctChange = (cur: number, prev: number | null | undefined) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null);

const WD = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const STATUS: Record<string, string> = { ok: 'Đơn chốt (thành công / đang xử lý)', return: 'Hoàn', cancel: 'Hủy', new: 'Mới (chưa chốt)' };

export function SalesOverview() {
  const f = useFilters();
  const { data, loading, error } = useFetch<any>(`/api/report/sales?view=overview&from=${f.from}&to=${f.to}&cmp=${f.cmp}`);
  const t = data?.totals, p = data?.prev;
  const k = (label: string, icon: string, key: string, value: string, extra: any = {}) => ({ label, icon, value, cur: t?.[key], prev: p?.[key], ...extra });
  return (
    <PageShell crumbs={['Báo cáo', 'Báo cáo bán hàng', 'Tổng quan']} title="Tổng quan bán hàng" f={f}>
      <State loading={loading} error={error} empty={!loading && !error && data && !t?.total_orders} />
      {data && t?.total_orders > 0 && (
        <>
          <Insight>
            Tỉ lệ khách quay lại <b>{pct(t.repeat_rate)}</b> · tỉ lệ hủy <b>{pct(t.cancel_rate)}</b> · tỉ lệ hoàn <b>{pct(t.return_rate)}</b>.
          </Insight>
          <KpiGrid daily={data.daily.map((d: any) => ({ ...d, aov: d.orders ? d.revenue / d.orders : 0 }))} items={[
            k('Doanh thu', '₫', 'revenue', money(t.revenue), { hero: true, spark: 'revenue' }),
            k('Doanh số (trước giảm giá, gồm ship & phụ thu)', '₫', 'gross_sales', int(t.gross_sales), {}),
            k('Số đơn chốt', '#', 'orders', int(t.orders), { spark: 'orders' }),
            k('AOV', 'Ø', 'aov', int(t.aov), { spark: 'aov' }),
            k('Khách hàng', '☺', 'customers', int(t.customers), { sub: `${int(t.new_customers)} mới · ${int(t.returning_customers)} quay lại` }),
            k('Tỉ lệ hủy', '✕', 'cancel_rate', pct(t.cancel_rate), { lowerBetter: true, sub: `${int(t.cancelled)} đơn hủy` }),
            k('Tỉ lệ hoàn', '↩', 'return_rate', pct(t.return_rate), { lowerBetter: true, sub: `${int(t.returned)} đơn hoàn` }),
            k('SP / đơn', '▤', 'items_per_order', dec(t.items_per_order, 2), {}),
            k('Giảm giá', '％', 'discount', money(t.discount), { lowerBetter: true }),
            k('Phí vận chuyển thu', '⛟', 'shipping', money(t.shipping), {}),
            k('Tỉ lệ khách quay lại', '↻', 'repeat_rate', pct(t.repeat_rate), {}),
          ]} />
          <div className="grid2">
            <Card title="Doanh thu & số đơn theo ngày" className="span2">
              <Bars data={data.daily} x="date" bars={[{ key: 'revenue', name: 'Doanh thu', color: '#c8102e' }]} />
            </Card>
            <Card title="Trạng thái đơn">
              <Donut data={data.status.map((s: any) => ({ ...s, name: STATUS[s.g] || s.g }))} nameKey="name" valueKey="c" fmt={int} center="đơn" />
            </Card>
            <Card title="Doanh thu theo page">
              <Donut data={data.byPage} nameKey="label" valueKey="revenue" center="doanh thu" />
            </Card>
            <Card title="Đơn theo thứ trong tuần">
              <Bars data={data.weekday.map((w: any) => ({ ...w, name: WD[w.w] }))} x="name" fmt={int} bars={[{ key: 'orders', name: 'Số đơn', color: '#c8102e' }]} />
            </Card>
            <Card title="Đơn theo giờ trong ngày" sub="Giờ Việt Nam · gợi ý khung giờ chạy quảng cáo">
              <Bars data={data.hour.map((h: any) => ({ ...h, name: `${h.h}h` }))} x="name" fmt={int} bars={[{ key: 'orders', name: 'Số đơn', color: '#2563eb' }]} />
            </Card>
          </div>
          <Card title="Hiệu quả theo nhân viên MKT / sale" sub="Theo nhân viên phụ trách đơn">
            <DataTable first={{ key: 'label', label: 'Nhân viên' }} rows={data.byMarketer} cols={[
              { key: 'orders', label: 'Số đơn', fmt: (v) => int(v) }, { key: 'revenue', label: 'Doanh thu', fmt: (v) => int(v) },
            ]} />
          </Card>
        </>
      )}
    </PageShell>
  );
}

export function Products() {
  const f = useFilters();
  const { data, loading, error } = useFetch<any>(`/api/report/sales?view=product&from=${f.from}&to=${f.to}&cmp=${f.cmp}`);
  const all: any[] = data?.rows || [];
  const rows = all.filter((r) => r.revenue > 0 || !data?.prevRange).sort((a, b) => b.revenue - a.revenue);
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const hasPrev = !!data?.prevRange;
  const prevTotal = hasPrev ? all.reduce((s, r) => s + (r.prev?.revenue || 0), 0) : null;
  const prevQty = hasPrev ? all.reduce((s, r) => s + (r.prev?.qty || 0), 0) : null;
  const cols: Col[] = [
    { key: 'product_code', label: 'Mã sản phẩm', fmt: (v) => v || '–' },
    { key: 'sku', label: 'SKU', fmt: (v) => v || '–' },
    { key: 'qty', label: 'Số lượng', fmt: (v, r) => <>{int(v)}{dlt(v, r.prev?.qty)}</> },
    { key: 'orders', label: 'Số đơn', fmt: (v, r) => <>{int(v)}{dlt(v, r.prev?.orders)}</> },
    { key: 'avg_price', label: 'Giá TB', fmt: (v) => int(v) },
    { key: 'revenue', label: 'Doanh thu', fmt: (v, r) => <>{int(v)}{dlt(v, r.prev?.revenue)}</> },
    { key: 'share', label: 'Tỉ trọng', fmt: (v) => pct(v) },
    { key: 'return_rate', label: 'Tỉ lệ hoàn', fmt: (v, r) => <>{pct(v)}{dlt(v, r.prev?.return_rate, true)}</>, best: 'min' },
  ];
  const withShare = (hasPrev ? all : rows).map((r) => ({ ...r, share: total ? (r.revenue / total) * 100 : 0, d_revenue: pctChange(r.revenue, r.prev?.revenue) }));
  return (
    <PageShell crumbs={['Báo cáo', 'Báo cáo bán hàng', 'Theo sản phẩm']} title="Bán hàng theo sản phẩm" f={f}>
      <State loading={loading} error={error} empty={!loading && !error && !rows.length} />
      {rows.length > 0 && (
        <>
          <KpiGrid items={[
            { label: 'Doanh thu sản phẩm', icon: '₫', value: money(total), hero: true, cur: total, prev: prevTotal },
            { label: 'Số sản phẩm bán ra', icon: '▤', value: int(rows.length), cur: rows.length, prev: hasPrev ? all.filter((r) => r.prev?.revenue > 0).length : null },
            { label: 'Tổng số lượng', icon: '#', value: int(rows.reduce((s, r) => s + r.qty, 0)), cur: rows.reduce((s, r) => s + r.qty, 0), prev: prevQty },
            { label: 'Sản phẩm bán chạy', icon: '★', value: rows[0].name, sub: `${money(rows[0].revenue)} · ${pct(total ? (rows[0].revenue / total) * 100 : 0)}` },
          ]} />
          <div className="grid2">
            <Card title="Top 10 sản phẩm theo doanh thu" className="span2">
              <Bars data={rows.slice(0, 10)} x="name" rotate bars={[{ key: 'revenue', name: 'Doanh thu', color: '#c8102e' }]} />
            </Card>
          </div>
          <Card title="Bảng chi tiết sản phẩm" sub="Bấm tiêu đề cột để sắp xếp">
            <DataTable first={{ key: 'name', label: 'Sản phẩm' }} cols={cols} rows={withShare} search />
          </Card>
        </>
      )}
    </PageShell>
  );
}

export function Provinces() {
  const f = useFilters();
  const { data, loading, error } = useFetch<any>(`/api/report/sales?view=province&from=${f.from}&to=${f.to}&cmp=${f.cmp}`);
  const all: any[] = data?.rows || [];
  const rows = all.filter((r) => r.revenue > 0 || !data?.prevRange).sort((a, b) => b.revenue - a.revenue);
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const hasPrev = !!data?.prevRange;
  const prevTotal = hasPrev ? all.reduce((s, r) => s + (r.prev?.revenue || 0), 0) : null;
  const withShare = rows.map((r) => ({ ...r, share: total ? (r.revenue / total) * 100 : 0 }));
  return (
    <PageShell crumbs={['Báo cáo', 'Báo cáo bán hàng', 'Theo tỉnh thành']} title="Bán hàng theo tỉnh thành" f={f}>
      <State loading={loading} error={error} empty={!loading && !error && !rows.length} />
      {rows.length > 0 && (
        <>
          <KpiGrid items={[
            { label: 'Doanh thu', icon: '₫', value: money(total), hero: true, cur: total, prev: prevTotal },
            { label: 'Số tỉnh thành có đơn', icon: '⌖', value: int(rows.length), cur: rows.length, prev: hasPrev ? all.filter((r) => r.prev?.revenue > 0).length : null },
            { label: 'Tỉnh dẫn đầu', icon: '★', value: rows[0].province, sub: `${money(rows[0].revenue)} · ${pct(total ? (rows[0].revenue / total) * 100 : 0)}` },
            { label: 'Tỉ lệ hoàn cao nhất', icon: '↩', value: [...rows].filter((r) => r.orders >= 10).sort((a, b) => b.return_rate - a.return_rate)[0]?.province || '–', sub: 'Tỉnh có từ 10 đơn' },
          ]} />
          <div className="grid2">
            <Card title="Top 12 tỉnh thành theo doanh thu"><Bars data={rows.slice(0, 12)} x="province" rotate bars={[{ key: 'revenue', name: 'Doanh thu', color: '#c8102e' }]} /></Card>
            <Card title="Tỉ trọng doanh thu"><Donut data={rows.slice(0, 8)} nameKey="province" valueKey="revenue" center="doanh thu" /></Card>
          </div>
          <Card title="Bảng chi tiết theo tỉnh thành">
            <DataTable first={{ key: 'province', label: 'Tỉnh / thành' }} search rows={withShare} cols={[
              { key: 'orders', label: 'Số đơn', fmt: (v, r) => <>{int(v)}{dlt(v, r.prev?.orders)}</> }, { key: 'revenue', label: 'Doanh thu', fmt: (v, r) => <>{int(v)}{dlt(v, r.prev?.revenue)}</> },
              { key: 'share', label: 'Tỉ trọng', fmt: (v) => pct(v) }, { key: 'aov', label: 'AOV', fmt: (v, r) => <>{int(v)}{dlt(v, r.prev?.aov)}</>, best: 'max' },
              { key: 'return_rate', label: 'Tỉ lệ hoàn', fmt: (v, r) => <>{pct(v)}{dlt(v, r.prev?.return_rate, true)}</>, best: 'min' }, { key: 'cancel_rate', label: 'Tỉ lệ hủy', fmt: (v, r) => <>{pct(v)}{dlt(v, r.prev?.cancel_rate, true)}</>, best: 'min' },
            ]} />
          </Card>
        </>
      )}
    </PageShell>
  );
}

export function Customers() {
  const f = useFilters();
  const { data, loading, error } = useFetch<any>(`/api/report/sales?view=customer&from=${f.from}&to=${f.to}&cmp=${f.cmp}`);
  const t = data?.totals, p = data?.prev?.totals;
  const per = (x: any, a: string, b: string) => (x && x[b] ? x[a] / x[b] : 0);
  return (
    <PageShell crumbs={['Báo cáo', 'Báo cáo bán hàng', 'Khách hàng']} title="Khách hàng" f={f}>
      <State loading={loading} error={error} empty={!loading && !error && data && !t?.customers} />
      {data && t?.customers > 0 && (
        <>
          <KpiGrid items={[
            { label: 'Khách hàng', icon: '☺', value: int(t.customers), hero: true, cur: t.customers, prev: p?.customers },
            { label: 'Khách mới', icon: '＋', value: int(t.new_customers), sub: 'Lần đầu mua trong kỳ', cur: t.new_customers, prev: p?.new_customers },
            { label: 'Khách quay lại', icon: '↻', value: int(t.returning_customers), sub: 'Đã mua trước kỳ', cur: t.returning_customers, prev: p?.returning_customers },
            { label: 'Tỉ lệ quay lại', icon: '%', value: pct(t.repeat_rate), cur: t.repeat_rate, prev: p?.repeat_rate },
            { label: 'Doanh thu / khách', icon: '₫', value: int(per(t, 'revenue', 'customers')), cur: per(t, 'revenue', 'customers'), prev: p ? per(p, 'revenue', 'customers') : null },
            { label: 'Đơn / khách', icon: '#', value: dec(per(t, 'orders', 'customers')), cur: per(t, 'orders', 'customers'), prev: p ? per(p, 'orders', 'customers') : null },
          ]} />
          <div className="grid2">
            <Card title="Khách mới theo ngày" sub={data.prev ? `Kỳ trước có ${int(data.prev.totals.new_customers)} khách mới` : undefined} className="span2"><Bars data={data.daily} x="date" fmt={int} bars={[{ key: 'new_customers', name: 'Khách mới', color: '#059669' }]} /></Card>
            <Card title="Phân bố số đơn / khách (toàn thời gian)"><Donut data={data.dist} nameKey="label" valueKey="customers" fmt={int} center="khách" /></Card>
          </div>
          <Card title="Top 30 khách theo doanh thu" sub="Trong kỳ đã chọn">
            <DataTable first={{ key: 'name', label: 'Khách hàng' }} rows={data.top} cols={[
              { key: 'phone', label: 'SĐT', fmt: (v) => (v ? String(v).replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : '–') },
              { key: 'province', label: 'Tỉnh', fmt: (v) => v || '–' }, { key: 'orders', label: 'Số đơn', fmt: (v) => int(v) },
              { key: 'revenue', label: 'Doanh thu', fmt: (v) => int(v) },
              { key: 'last_order', label: 'Đơn gần nhất', fmt: (v) => (v ? dmy(new Date(v).toISOString().slice(0, 10)) : '–') },
            ]} />
          </Card>
        </>
      )}
    </PageShell>
  );
}

export function Growth() {
  const { data, loading, error } = useFetch<any>('/api/report/ads?growth=1');
  const rows: any[] = data?.rows || [];
  const g = (v: any) => (v == null ? '–' : <span className={v >= 0 ? 'pos' : 'neg'}>{v >= 0 ? '▲' : '▼'} {pct(Math.abs(v))}</span>);
  const last = rows[rows.length - 1];
  return (
    <PageShell crumbs={['Báo cáo', 'Phân tích chi tiết', 'Tăng trưởng theo tháng']} title="Tăng trưởng theo tháng">
      <State loading={loading} error={error} empty={!loading && !error && !rows.length} />
      {rows.length > 0 && (
        <>
          {last && (
            <Insight>
              Tháng gần nhất <b>{last.label}</b>: doanh thu {money(last.revenue)} ({last.g_revenue == null ? 'chưa có kỳ so sánh' : `${last.g_revenue >= 0 ? '+' : ''}${pct(last.g_revenue)} so với tháng trước`}),
              ngân sách {money(last.spend)}, ROAS {dec(last.roas)}.
            </Insight>
          )}
          <div className="grid2">
            <Card title="Doanh thu & ngân sách theo tháng" className="span2"><Bars data={rows} x="label" bars={[{ key: 'revenue', name: 'Doanh thu', color: '#c8102e' }, { key: 'spend', name: 'Ngân sách', color: '#f2b8c0' }]} /></Card>
            <Card title="ROAS theo tháng"><Bars data={rows} x="label" fmt={(v) => dec(v, 1)} bars={[{ key: 'roas', name: 'ROAS', color: '#111827' }]} /></Card>
            <Card title="Số đơn & AOV"><Bars data={rows} x="label" fmt={int} bars={[{ key: 'orders', name: 'Số đơn', color: '#2563eb' }]} /></Card>
          </div>
          <Card title="Bảng tăng trưởng theo tháng" sub="% tăng/giảm so với tháng liền trước">
            <DataTable first={{ key: 'label', label: 'Tháng' }} rows={[...rows].reverse()} cols={[
              { key: 'revenue', label: 'Doanh thu', fmt: (v) => int(v) }, { key: 'g_revenue', label: '± Doanh thu', fmt: (v) => g(v) },
              { key: 'spend', label: 'Ngân sách', fmt: (v) => int(v) }, { key: 'g_spend', label: '± Ngân sách', fmt: (v) => g(v) },
              { key: 'orders', label: 'Số đơn', fmt: (v) => int(v) }, { key: 'g_orders', label: '± Số đơn', fmt: (v) => g(v) },
              { key: 'aov', label: 'AOV', fmt: (v) => int(v) }, { key: 'roas', label: 'ROAS', fmt: (v) => dec(v) },
              { key: 'cp_rev', label: 'CP/DT', fmt: (v) => pct(v) }, { key: 'cost_order', label: 'CP/đơn', fmt: (v) => int(v) },
              { key: 'inbox', label: 'Inbox', fmt: (v) => int(v) }, { key: 'cost_inbox', label: 'CP/Inbox', fmt: (v) => int(v) },
            ]} />
          </Card>
        </>
      )}
    </PageShell>
  );
}
