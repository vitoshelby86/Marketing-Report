'use client';
import { useEffect, useState } from 'react';
import { PageShell } from './kit';
import { int } from './format';
import { extractSheetId, useReportContext } from '@/lib/context';

export default function PoscakePanel() {
  const { sheetId, adsTab, saleTab, dataSource, connectSheet, disconnectSheet } = useReportContext();

  const [sheetInput, setSheetInput] = useState('');
  const [adsTabInput, setAdsTabInput] = useState('BC_Chung');
  const [saleTabInput, setSaleTabInput] = useState('BC_Sale');
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetMsg, setSheetMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sheetInfo, setSheetInfo] = useState<any>(null);

  useEffect(() => {
    if (sheetId) setSheetInput(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
    if (adsTab) setAdsTabInput(adsTab);
    if (saleTab) setSaleTabInput(saleTab);
  }, [sheetId, adsTab, saleTab]);

  const handleTestSheet = async () => {
    const extracted = extractSheetId(sheetInput);
    if (!extracted) {
      setSheetMsg({ ok: false, text: 'Link hoặc ID Google Sheet không hợp lệ. Hãy copy toàn bộ URL từ thanh địa chỉ trình duyệt.' });
      return;
    }
    setSheetBusy(true);
    setSheetMsg(null);
    try {
      const r = await fetch('/api/sheets/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetId: extracted,
          adsTab: adsTabInput || 'BC_Chung',
          saleTab: saleTabInput || 'BC_Sale',
        }),
      }).then((x) => x.json());
      if (!r.ok) {
        setSheetMsg({ ok: false, text: r.message || 'Không kết nối được Google Sheet' });
        setSheetInfo(null);
        return;
      }
      setSheetInfo(r);
      setSheetMsg({
        ok: true,
        text: `Kết nối thành công · Đọc được ${int(r.adsRows)} dòng quảng cáo (${adsTabInput}) và ${int(r.saleRows)} đơn hàng (${saleTabInput}) · Thời gian: ${r.minDate} → ${r.maxDate}`,
      });
    } catch (e: any) {
      setSheetMsg({ ok: false, text: String(e?.message || e) });
    } finally {
      setSheetBusy(false);
    }
  };

  const handleApplySheet = () => {
    const extracted = extractSheetId(sheetInput);
    if (!extracted) {
      setSheetMsg({ ok: false, text: 'Vui lòng nhập Link hoặc ID Google Sheet hợp lệ trước khi lưu.' });
      return;
    }
    connectSheet(extracted, adsTabInput || 'BC_Chung', saleTabInput || 'BC_Sale');
    setSheetMsg({
      ok: true,
      text: `Đã lưu kết nối 2 sheet (${adsTabInput} & ${saleTabInput})! Toàn bộ 15 trang báo cáo đã tự động đồng bộ dữ liệu thật.`,
    });
  };

  const handleDisconnect = () => {
    disconnectSheet();
    setSheetInput('');
    setSheetInfo(null);
    setSheetMsg({ ok: true, text: 'Đã ngắt kết nối Google Sheet. Hệ thống đang chạy trên bộ dữ liệu mẫu đa nền tảng.' });
  };

  const [form, setForm] = useState({ key: '', shop: '' });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [res, setRes] = useState<any>(null);

  const call = async (action: 'test' | 'sync') => {
    setBusy(action); setMsg(null);
    try {
      const r = await fetch('/api/poscake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...form }) }).then((x) => x.json());
      if (!r.ok) { setMsg({ ok: false, text: r.message || 'Có lỗi xảy ra' }); return; }
      if (action === 'test') setMsg({ ok: true, text: `Kết nối Poscake OK${r.total != null ? ` · ${int(r.total)} đơn trong shop` : ''}` });
      else { setRes(r); setMsg({ ok: true, text: `Đã lấy ${int(r.fetched)} đơn trong 7 ngày gần nhất` }); }
    } catch (e: any) {
      setMsg({ ok: false, text: String(e?.message || e) });
    } finally { setBusy(''); }
  };

  return (
    <PageShell crumbs={['Kết nối', 'Google Sheets & Poscake']} title="Kết nối dữ liệu (2 Sheet BC_Chung & BC_Sale)">
      <section className="card">
        <header>
          <div>
            <h3>
              1. Kết nối Google Sheets (Chỉ lấy dữ liệu từ 2 sheet: BC_Chung & BC_Sale){' '}
              <span className={'pill ' + (dataSource === 'sheet' ? 'on' : 'off')}>
                {dataSource === 'sheet' ? 'Đang dùng Live Sheet' : 'Đang dùng Dữ liệu mẫu'}
              </span>
            </h3>
            <p>
              Tool tự động khớp <b>Ads ID</b> & <b>Campaign</b> giữa sheet quảng cáo (<code>BC_Chung</code>) và sheet đơn hàng (<code>BC_Sale</code>), tách mã sản phẩm, media, mã content từ tên camp và nhận diện khách mới/cũ qua SĐT.
            </p>
          </div>
        </header>

        <div className="fld">
          <span>Đường link Google Sheets (Bật chia sẻ “Bất kỳ ai có đường liên kết đều có thể xem”)</span>
          <div className="fld-row">
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
            />
          </div>
        </div>

        <div className="row wrap">
          <label>
            Sheet Quảng cáo
            <input type="text" style={{ width: 150 }} value={adsTabInput} onChange={(e) => setAdsTabInput(e.target.value)} />
          </label>
          <label>
            Sheet Bán hàng
            <input type="text" style={{ width: 150 }} value={saleTabInput} onChange={(e) => setSaleTabInput(e.target.value)} />
          </label>
        </div>

        <div className="row">
          <button type="button" disabled={sheetBusy} onClick={handleTestSheet}>
            {sheetBusy ? 'Đang kiểm tra…' : 'Kiểm tra kết nối 2 sheet'}
          </button>
          <button type="button" className="primary" disabled={sheetBusy} onClick={handleApplySheet}>
            Kết nối & Áp dụng ngay
          </button>
          {sheetId && (
            <button type="button" className="danger" onClick={handleDisconnect}>
              Ngắt kết nối (Về dữ liệu mẫu)
            </button>
          )}
        </div>

        {sheetMsg && <p className={sheetMsg.ok ? 'okbox' : 'warn'}>{sheetMsg.text}</p>}

        {sheetInfo && (
          <ul className="kv" style={{ marginTop: 10 }}>
            <li><b>Sheet 1 ({adsTabInput})</b><span>{int(sheetInfo.adsRows)} dòng chỉ số quảng cáo</span></li>
            <li><b>Sheet 2 ({saleTabInput})</b><span>{int(sheetInfo.saleRows)} đơn hàng (đã gộp dòng sản phẩm con)</span></li>
            <li><b>Công ty / Brand phát hiện</b><span>{sheetInfo.companies.join(' · ')}</span></li>
            <li><b>Nền tảng có dữ liệu</b><span>{sheetInfo.platforms.join(', ')}</span></li>
            <li><b>Khoảng ngày dữ liệu</b><span>{sheetInfo.minDate} → {sheetInfo.maxDate}</span></li>
          </ul>
        )}

        <div className="note" style={{ marginTop: 10 }}>
          <b>Quy tắc khớp dữ liệu tự động:</b>
          <br />• <b>BC_Chung</b>: Đọc <code>Ngày</code>, <code>Tên camp</code> (tự tách mã SP như <code>5101</code>, media <code>Video/Ảnh</code>, mã content <code>V001/V002</code>), <code>Ngân sách</code>, <code>Reach</code>, <code>Tần suất</code>, <code>CPM</code>, <code>Số click</code>, <code>CTR</code>, <code>Số comment</code>, <code>Số inbox</code>, <code>Ads ID</code>, <code>Page</code>, <code>Hình thức</code>, <code>Tài khoản</code>.
          <br />• <b>BC_Sale</b>: Tự động gộp các dòng sản phẩm thuộc cùng <code>Mã đơn hàng</code>, khớp <code>Ad Id / UTM ID / Campaign Name</code> sang <code>BC_Chung</code> để tính CPO, ROAS (Facebook), ROI % (TikTok), CPV (YouTube) và tự nhận diện khách mới / quay lại theo <code>Số điện thoại</code>.
        </div>
      </section>

      <section className="card">
        <header><div><h3>2. Đồng bộ xem trước từ Poscake API</h3><p>Key và Shop ID chỉ dùng cho lần gọi này, không được lưu trên server.</p></div></header>
        <div className="row wrap">
          <label>API key<input type="password" autoComplete="off" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} /></label>
          <label>Shop ID<input type="text" inputMode="numeric" autoComplete="off" value={form.shop} onChange={(e) => setForm({ ...form, shop: e.target.value })} /></label>
          <button disabled={!!busy} onClick={() => call('test')}>{busy === 'test' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}</button>
          <button className="primary" disabled={!!busy} onClick={() => call('sync')}>{busy === 'sync' ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}</button>
        </div>
        {msg && <p className={msg.ok ? 'okbox' : 'warn'}>{msg.text}</p>}
      </section>

      {res && (
        <section className="card">
          <header><div><h3>Kết quả đơn hàng Poscake</h3><p>{int(res.closed)} đơn chốt · doanh thu {int(res.revenue)} (không tính đơn mới, hủy, xóa)</p></div></header>
          <table className="mini"><thead><tr><th>Mã đơn</th><th>Thời gian</th><th>Trạng thái</th><th>Khách</th><th>Tỉnh</th><th>Doanh thu</th></tr></thead>
            <tbody>{res.rows.map((r: any) => (
              <tr key={r.id}><td>{r.id}</td><td>{r.time ? new Date(r.time).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '–'}</td><td>{r.status}</td><td>{r.name || '–'}</td><td>{r.province || '–'}</td><td>{int(r.revenue)}</td></tr>
            ))}</tbody></table>
        </section>
      )}
    </PageShell>
  );
}
