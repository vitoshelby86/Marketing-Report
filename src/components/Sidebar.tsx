'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useReportContext } from '@/lib/context';
import { PLATFORM_META, PlatformId } from '@/lib/platformConfig';

export default function Sidebar() {
  const path = usePathname();
  const sp = useSearchParams();
  const { company, setCompany, companies, platform, setPlatform, platformMeta, dataSource, dateSpan, rowStats } = useReportContext();

  const preserved = ['company', 'platform', 'r', 'f', 't', 'cmp']
    .filter((k) => sp.get(k))
    .map((k) => `${k}=${encodeURIComponent(sp.get(k)!)}`)
    .join('&');

  const NAV = [
    { title: 'TỔNG QUAN', items: [['/tong-quan', 'Tổng quan 4 tầng', '◈']] },
    {
      title: 'HIỆU QUẢ QUẢNG CÁO',
      items: [
        ['/theo-tai-khoan', 'Theo tài khoản QC', '☰'],
        ['/theo-page', platformMeta.pageLabel, '▦'],
        ['/theo-hinh-thuc', 'Theo hình thức chạy', '◧'],
        ['/theo-media', 'Theo media', '▶'],
        ['/theo-ma-san-pham', 'Theo mã sản phẩm', '▣'],
        ['/theo-ma-media', 'Theo mã media', '✦'],
        ['/theo-nguon', 'Theo nguồn đơn', '⇄'],
        ['/theo-camp', 'Theo camp', '⚑'],
        ['/theo-quang-cao', 'Theo quảng cáo', '❖'],
      ],
    },
    { title: 'PHÂN TÍCH CHI TIẾT', items: [['/tang-truong', 'Tăng trưởng theo tháng', '↗']] },
    {
      title: 'BÁO CÁO BÁN HÀNG',
      items: [
        ['/ban-hang', 'Tổng quan bán hàng', '◉'],
        ['/san-pham', 'Theo sản phẩm', '▤'],
        ['/tinh-thanh', 'Theo tỉnh thành', '⌖'],
        ['/khach-hang', 'Khách hàng', '☺'],
      ],
    },
    { title: 'KẾT NỐI', items: [['/poscake', 'Google Sheets & Poscake', '⇆']] },
  ];

  const platforms: PlatformId[] = ['facebook', 'tiktok', 'youtube'];

  return (
    <aside className="side">
      <div className="brand">
        <div className="logo">{platformMeta.logoChar}</div>
        <div>
          <b>{company}</b>
          <span>{platformMeta.subtitle}</span>
        </div>
      </div>

      <div className="ws-box">
        <label className="ws-lbl">CÔNG TY / WORKSPACE</label>
        <select value={company} onChange={(e) => setCompany(e.target.value)} className="ws-sel">
          {companies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="ws-lbl" style={{ marginTop: 8 }}>
          NỀN TẢNG ĐO LƯỜNG
        </label>
        <div className="plat-tabs">
          {platforms.map((pid) => {
            const m = PLATFORM_META[pid];
            return (
              <button
                key={pid}
                type="button"
                className={platform === pid ? 'on' : ''}
                onClick={() => setPlatform(pid)}
              >
                {m.shortName}
              </button>
            );
          })}
        </div>
      </div>

      <nav>
        {NAV.map((g) => (
          <div key={g.title}>
            <div className="nav-title">{g.title}</div>
            {g.items.map(([href, label, icon]) => (
              <Link key={href} href={!preserved ? href : `${href}?${preserved}`} className={path === href ? 'on' : ''}>
                <i>{icon}</i>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="side-foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={'dot ' + (dataSource === 'sheet' ? 'good' : 'warn')} />
          <b>{dataSource === 'sheet' ? 'BC_Chung + BC_Sale' : 'Dữ liệu mẫu đa kênh'}</b>
        </div>
        <span>{rowStats || (dateSpan ? `Dữ liệu: ${dateSpan}` : 'Không giới hạn 90 ngày')}</span>
      </div>
    </aside>
  );
}
