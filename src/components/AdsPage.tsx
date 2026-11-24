'use client';
import { Bars, Card, Col, DataTable, Donut, Insight, KpiDef, KpiGrid, PageShell, RankBars, SpendRevenueDaily, State, TimeLines, useFetch, useFilters } from './kit';
import { dec, int, money, pct } from './format';

const cols: Col[] = [
  { key: 'spend', label: 'Ngân sách', group: 'QUẢNG CÁO', fmt: (v) => int(v) },
  { key: 'reach', label: 'Reach', group: 'QUẢNG CÁO', fmt: (v) => int(v) },
  { key: 'impressions', label: 'Hiển thị', group: 'QUẢNG CÁO', fmt: (v) => int(v) },
  { key: 'frequency', label: 'Tần suất', group: 'QUẢNG CÁO', fmt: (v) => dec(v) },
  { key: 'cpm', label: 'CPM', group: 'QUẢNG CÁO', fmt: (v) => int(v), best: 'min' },
  { key: 'clicks_all', label: 'Click (tất cả)', group: 'QUẢNG CÁO', fmt: (v) => int(v) },
  { key: 'ctr_all', label: 'CTR (tất cả)', group: 'QUẢNG CÁO', fmt: (v) => pct(v, 2), best: 'max' },
  { key: 'cpc_all', label: 'CPC (tất cả)', group: 'QUẢNG CÁO', fmt: (v) => int(v), best: 'min' },
  { key: 'link_clicks', label: 'Click liên kết', group: 'QUẢNG CÁO', fmt: (v) => int(v) },
  { key: 'ctr', label: 'CTR liên kết', group: 'QUẢNG CÁO', fmt: (v) => pct(v, 2), best: 'max' },
  { key: 'cpc', label: 'CPC liên kết', group: 'QUẢNG CÁO', fmt: (v) => int(v), best: 'min' },
  { key: 'comments', label: 'Comment', group: 'TƯƠNG TÁC', fmt: (v) => int(v) },
  { key: 'inbox', label: 'Inbox', group: 'TƯƠNG TÁC', fmt: (v) => int(v) },
  { key: 'cost_inbox', label: 'CP/Inbox', group: 'TƯƠNG TÁC', fmt: (v) => int(v), best: 'min' },
  { key: 'inbox_rate', label: 'Inbox/Click', group: 'TƯƠNG TÁC', fmt: (v) => pct(v), best: 'max' },
  { key: 'orders', label: 'Số đơn', group: 'BÁN HÀNG', fmt: (v) => int(v) },
  { key: 'close_rate', label: 'Tỉ lệ chốt', group: 'BÁN HÀNG', fmt: (v) => pct(v), best: 'max' },
  { key: 'cost_order', label: 'Chi phí/đơn', group: 'BÁN HÀNG', fmt: (v) => int(v), best: 'min' },
  { key: 'aov', label: 'AOV', group: 'BÁN HÀNG', fmt: (v) => int(v), best: 'max' },
  { key: 'revenue', label: 'Doanh thu', group: 'BÁN HÀNG', fmt: (v) => int(v) },
  { key: 'roas', label: 'ROAS', group: 'BÁN HÀNG', fmt: (v) => dec(v), best: 'max' },
  { key: 'cp_rev', label: 'CP/Doanh thu', group: 'BÁN HÀNG', fmt: (v) => pct(v), best: 'min' },
  { key: 'nonad_orders', label: 'Đơn ngoài QC', group: 'BÁN HÀNG', fmt: (v) => int(v) },
  { key: 'return_rate', label: 'Tỉ lệ hoàn', group: 'BÁN HÀNG', fmt: (v) => pct(v), best: 'min' },
];

export type AdsConfig = { dim: 'ad' | 'account' | 'media' | 'product' | 'creative' | 'page' | 'campaign' | 'format' | 'source'; title: string; entity: string; plural: string };

export default function AdsPage({ dim, title, entity, plural }: AdsConfig) {
  const f = useFilters();
  const url = `/api/report/ads?dim=${dim}&from=${f.from}&to=${f.to}&cmp=${f.cmp}`;
  const { data, loading, error } = useFetch<any>(url);
  const t = data?.totals, p = data?.prev;
  const rows: any[] = data?.rows || [];
  const named = rows.filter((r) => r.spend > 0 || r.orders > 0);
  const chartRows = [...named].sort((a, b) => b.spend - a.spend).slice(0, 12);
  const kpi = (label: string, icon: string, key: string, value: string, extra: Partial<KpiDef> = {}): KpiDef => ({ label, icon, value, cur: t?.[key], prev: p?.[key], ...extra });

  const leader = named.filter((r) => r.k !== '-').sort((a, b) => b.revenue - a.revenue)[0];
  const efficient = named.filter((r) => r.spend > (t?.spend || 0) * 0.05 && r.revenue > 0).sort((a, b) => a.cp_rev - b.cp_rev)[0];
  const worst = named.filter((r) => r.spend > (t?.spend || 0) * 0.05 && r.revenue > 0).sort((a, b) => b.cp_rev - a.cp_rev)[0];

  return (
    <PageShell crumbs={['Báo cáo', 'Hiệu quả quảng cáo', title]} title={title} f={f}>
      <State loading={loading} error={error} empty={!loading && !error && !rows.length} />
      {data && rows.length > 0 && t && (
        <>
          <Insight>
            {leader && <>{entity} dẫn đầu doanh thu: <b>{leader.label}</b> · {pct(t.revenue ? (leader.revenue / t.revenue) * 100 : 0)} tổng doanh thu. </>}
            {efficient && <>Hiệu quả nhất (CP/DT thấp): <b>{efficient.label}</b> {pct(efficient.cp_rev)}. </>}
            {worst && worst !== efficient && <>Cần xem lại: <b>{worst.label}</b> với CP/DT {pct(worst.cp_rev)}. </>}
            {t.revenue > 0 && <>{pct((t.nonad_revenue / t.revenue) * 100)} doanh thu đến từ đơn không gắn quảng cáo.</>}
          </Insight>
          <KpiGrid daily={data.daily} items={[
            kpi('Doanh thu', '₫', 'revenue', money(t.revenue), { hero: true, spark: 'revenue' }),
            kpi('Số đơn', '#', 'orders', int(t.orders), { spark: 'orders' }),
            kpi('Ngân sách', '◔', 'spend', money(t.spend), { spark: 'spend', lowerBetter: true }),
            kpi('Chi phí / doanh thu', '%', 'cp_rev', pct(t.cp_rev), { lowerBetter: true, spark: 'cp_rev' }),
            kpi('ROAS', '×', 'roas', dec(t.roas), { spark: 'roas' }),
            kpi('Chi phí / đơn', '÷', 'cost_order', int(t.cost_order), { lowerBetter: true, spark: 'cost_order' }),
            kpi('AOV (giá trị đơn TB)', 'Ø', 'aov', int(t.aov), { spark: 'aov' }),
            kpi('Đơn ngoài quảng cáo', '⌂', 'nonad_orders', int(t.nonad_orders), { sub: `${money(t.nonad_revenue)} doanh thu` }),
            kpi('Inbox', '✉', 'inbox', int(t.inbox), { spark: 'inbox' }),
            kpi('CP / Inbox', '₫', 'cost_inbox', int(t.cost_inbox), { lowerBetter: true, spark: 'cost_inbox' }),
            kpi('Tỉ lệ chốt (đơn/inbox)', '✓', 'close_rate', pct(t.close_rate)),
            kpi('CPM', '◎', 'cpm', int(t.cpm), { lowerBetter: true, spark: 'cpm' }),
            kpi('CTR (tất cả)', '↗', 'ctr_all', pct(t.ctr_all, 2), { spark: 'ctr_all' }),
            kpi('CTR liên kết', '↗', 'ctr', pct(t.ctr, 2), { spark: 'ctr' }),
            kpi('CPC (tất cả)', '☝', 'cpc_all', int(t.cpc_all), { lowerBetter: true }),
            kpi('Tần suất', '↻', 'frequency', dec(t.frequency), { sub: `Reach ${int(t.reach)}` }),
            kpi('Tỉ lệ hoàn', '↩', 'return_rate', pct(t.return_rate), { lowerBetter: true }),
          ]} />

          <div className="grid2">
            {data.series.length > 0 && (
              <Card title={`Doanh thu theo ${entity.toLowerCase()}`} sub={`Theo ${data.bucket === 'week' ? 'tuần' : 'ngày'} · mỗi đường là một ${entity.toLowerCase()}${dim === 'campaign' ? ' (top 6)' : ''}`} className="span2">
                <TimeLines data={data.series} keys={data.seriesKeys} prefix="rev:" />
              </Card>
            )}
            <Card title="Tỉ trọng doanh thu" sub="Gồm cả đơn không gắn quảng cáo">
              <Donut data={rows.filter((r) => r.revenue > 0).slice(0, 8)} nameKey="label" valueKey="revenue" center="tổng doanh thu" />
            </Card>
            <Card title="Ngân sách & doanh thu theo ngày" sub="Cột: ngân sách / doanh thu · đường: ROAS">
              <SpendRevenueDaily daily={data.daily} />
            </Card>
          </div>

          <Card title={`Doanh thu & ngân sách từng ${entity.toLowerCase()}`} sub={dim === 'campaign' ? 'Top 12 theo ngân sách' : undefined}>
            <Bars data={chartRows} x="label" rotate={chartRows.length > 5} bars={[{ key: 'revenue', name: 'Doanh thu', color: '#c8102e' }, { key: 'spend', name: 'Ngân sách', color: '#f2b8c0' }]} />
          </Card>

          <h2 className="sec">So sánh hiệu quả giữa các {plural}</h2>
          <p className="muted">Thanh đỏ là {entity.toLowerCase()} tốt nhất ở chỉ số đó{dim === 'campaign' ? ' (top 12 theo ngân sách)' : ''}</p>
          <div className="grid3">
            <Card title="CP/Doanh thu (thấp là tốt)"><RankBars rows={chartRows} label="label" value="cp_rev" fmt={(v) => pct(v)} better="min" /></Card>
            <Card title="ROAS (cao là tốt)"><RankBars rows={chartRows} label="label" value="roas" fmt={(v) => dec(v)} better="max" /></Card>
            <Card title="CP/Inbox (thấp là tốt)"><RankBars rows={chartRows} label="label" value="cost_inbox" fmt={(v) => int(v)} better="min" /></Card>
            <Card title="Tỉ lệ chốt (cao là tốt)"><RankBars rows={chartRows} label="label" value="close_rate" fmt={(v) => pct(v)} better="max" /></Card>
            <Card title="CPM (thấp là tốt)"><RankBars rows={chartRows} label="label" value="cpm" fmt={(v) => int(v)} better="min" /></Card>
            <Card title="CTR tất cả (cao là tốt)"><RankBars rows={chartRows} label="label" value="ctr_all" fmt={(v) => pct(v, 2)} better="max" /></Card>
          </div>

          {dim === 'source' && data.placement?.length > 0 && (
            <Card title="Theo vị trí hiển thị (placement)" sub="Nền tảng & vị trí hiển thị">
              <DataTable first={{ key: 'name', label: 'Nền tảng · vị trí' }} rows={data.placement.map((r: any) => ({ ...r, name: `${r.platform} · ${r.position}` }))}
                cols={[
                  { key: 'spend', label: 'Ngân sách', fmt: (v) => int(v) }, { key: 'impressions', label: 'Hiển thị', fmt: (v) => int(v) },
                  { key: 'cpm', label: 'CPM', fmt: (v) => int(v), best: 'min' }, { key: 'clicks', label: 'Click', fmt: (v) => int(v) },
                  { key: 'ctr', label: 'CTR', fmt: (v) => pct(v, 2), best: 'max' }, { key: 'inbox', label: 'Inbox', fmt: (v) => int(v) },
                  { key: 'cost_inbox', label: 'CP/Inbox', fmt: (v) => int(v), best: 'min' },
                ]} />
            </Card>
          )}

          <Card title={`Bảng chi tiết · theo ${entity.toLowerCase()}`} sub="Bấm tiêu đề cột để sắp xếp · ô đậm là giá trị tốt nhất của cột">
            <DataTable first={{ key: 'label', label: entity }} cols={cols} rows={rows} total={{ ...t, label: 'Tổng' }} search={dim === 'campaign' || dim === 'ad'} />
          </Card>
          <div className="note">
            <b>Cách tính chỉ số.</b> CPM = Ngân sách ÷ Hiển thị × 1000 · CTR = Click liên kết ÷ Hiển thị · CP/Inbox = Ngân sách ÷ Inbox · Tỉ lệ chốt = Số đơn ÷ Inbox ·
            Chi phí/đơn = Ngân sách ÷ Số đơn · ROAS = Doanh thu ÷ Ngân sách · CP/Doanh thu = Ngân sách ÷ Doanh thu · Tần suất = Hiển thị ÷ Reach.
            Số đơn và doanh thu không tính đơn hủy; “Đơn ngoài QC” là đơn không gắn được camp quảng cáo. Click (tất cả) và CTR (tất cả) như cột “Lượt click (tất cả)” trong Ads Manager. {data.reachMode === 'exact' ? 'Reach là số người duy nhất do Meta trả về cho đúng khoảng ngày (dòng Tổng cộng reach các tài khoản; riêng các báo cáo theo page, hình thức, media, mã sản phẩm, mã media, nguồn, tháng thì từng dòng là tổng reach theo ngày nên có thể lớn hơn thực tế).' : 'Reach đang là tổng reach theo ngày nên có thể lớn hơn reach thực (chưa hỏi được Meta).'} Số liệu Meta dùng cửa sổ phân bổ đã chọn trong Quản trị.
            {dim === 'page' && ' Tổng theo page gồm cả đơn ghi nhận từ page nhưng không gắn camp.'}
          </div>
        </>
      )}
    </PageShell>
  );
}
