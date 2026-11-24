import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv, toIsoDate, toNum } from './csv';
import { PlatformId, normalizePlatform } from './platformConfig';

export interface AdsRow {
  company: string;
  platform: PlatformId;
  date: string;
  account: string;
  page: string;
  campaign: string;
  ad_id: string;
  ad: string;
  format: string;
  media: string;
  product: string;
  creative: string;
  source: string;
  placement: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  clicks_all: number;
  comments: number;
  inbox: number;
  likes: number;
  leads_phone: number;
  views: number;
  views_6s: number;
  profile_visits: number;
  watch_time: number;
  subscribers: number;
  sheet_orders_rev: number;
  sheet_revenue: number;
}

export interface SaleOrderItem {
  name: string;
  code: string;
  qty: number;
}

export interface SaleOrder {
  order_id: string;
  company: string;
  platform: PlatformId;
  date: string;
  hour: number;
  creator: string;
  customer_name: string;
  phone: string;
  province: string;
  region: string;
  source: string;
  source_name: string;
  page: string;
  page_id: string;
  campaign: string;
  campaign_id: string;
  ad_id: string;
  utm_id: string;
  cod: number;
  discount: number;
  shipping: number;
  gross_sales: number;
  revenue: number;
  returned_qty: number;
  returned_rev: number;
  is_returned: boolean;
  is_cancelled: boolean;
  items: SaleOrderItem[];
  matched_ads: boolean;
  account: string;
  format: string;
  media: string;
  product_code: string;
  creative: string;
  is_new_customer: boolean;
}

export interface DatasetBundle {
  ads: AdsRow[];
  orders: SaleOrder[];
  source: 'sheet' | 'demo';
  error?: string;
}

const SHEET_CACHE = new Map<string, { ts: number; bundle: DatasetBundle }>();
const CACHE_TTL_MS = 60_000;
let DEMO_CACHE: DatasetBundle | null = null;

function inferRegion(province: string): string {
  const p = province.toLowerCase();
  if (!p || p === 'khác') return 'Khác';
  const north = ['hà nội', 'hải phòng', 'quảng ninh', 'bắc ninh', 'hải dương', 'hưng yên', 'vĩnh phúc', 'thái nguyên', 'bắc giang', 'phú thọ', 'nam định', 'thái bình', 'ninh bình', 'hà nam', 'hòa bình', 'sơn la', 'điện biên', 'lai châu', 'lào cai', 'yên bái', 'tuyên quang', 'hà giang', 'cao bằng', 'bắc kạn', 'lạng sơn'];
  const central = ['thanh hóa', 'nghệ an', 'hà tĩnh', 'quảng bình', 'quảng trị', 'thừa thiên huế', 'huế', 'đà nẵng', 'quảng nam', 'quảng ngãi', 'bình định', 'phú yên', 'khánh hòa', 'ninh thuận', 'bình thuận', 'kon tum', 'gia lai', 'đắk lắk', 'đắk nông', 'lâm đồng'];
  if (north.some((x) => p.includes(x))) return 'Miền Bắc';
  if (central.some((x) => p.includes(x))) return 'Miền Trung';
  return 'Miền Nam';
}

function extractProductCodeFromText(text: string): string {
  const s = String(text || '');
  const m1 = s.match(/[-–]\s*([A-Z]{0,3}\d{3,6})\s*(?:[-–/]|$)/i);
  if (m1) return m1[1].toUpperCase();
  const m2 = s.match(/\b(SP\d{2,4}|\d{4,6})\b/i);
  if (m2) return m2[1].toUpperCase();
  return 'Khác';
}

function cleanProductName(text: string): string {
  const s = String(text || '').trim();
  if (!s) return 'Sản phẩm';
  const base = s.split('/')[0].trim();
  return base.length > 75 ? base.slice(0, 72) + '…' : base;
}

function detectPlatformFromText(text: string): PlatformId {
  const s = String(text || '').toLowerCase();
  if (s.includes('tiktok') || s.startsWith('tt_') || s.includes('_tt_')) return 'tiktok';
  if (s.includes('youtube') || s.startsWith('yt_') || s.includes('_yt_')) return 'youtube';
  return 'facebook';
}

function parseCampaignParts(camp: string) {
  const parts = String(camp || '').split('_').map((x) => x.trim()).filter(Boolean);
  let product = '';
  let media = '';
  let creative = '';
  let format = '';
  for (const p of parts) {
    const low = p.toLowerCase();
    if (!product && /^(\d{4,6}|sp\d{2,4})$/i.test(p)) product = p.toUpperCase();
    if (!creative && /^[vh]\d{3,4}$/i.test(p)) creative = p.toUpperCase();
    if (!media && (low === 'video' || low === 'ảnh' || low === 'hình ảnh' || low === 'carousel' || low === 'short' || low === 'live')) {
      media = low === 'ảnh' ? 'Hình ảnh' : p.charAt(0).toUpperCase() + p.slice(1);
    }
    if (!format && (low === 'mess' || low === 'purchase' || low === 'mess sale' || low === 'lead' || low === 'traffic' || low === 'in-stream' || low === 'shorts')) {
      format = p;
    }
  }
  return { product, media, creative, format };
}

function cleanAdId(raw: any): string {
  const s = String(raw || '').trim();
  if (!s || s === '#N/A' || s === '0') return '';
  return s.replace(/\.0$/, '');
}

function parseBCChung(rows: Record<string, string>[]): AdsRow[] {
  const out: AdsRow[] = [];
  for (const r of rows) {
    const date = toIsoDate(r['ngày'] || r['date'] || r['ngay']);
    const camp = String(r['tên camp'] || r['campaign'] || r['campaign name'] || '').trim();
    if (!date || !camp) continue;

    const parsed = parseCampaignParts(camp);
    const spend = toNum(r['ngân sách'] || r['spend'] || r['chi phí']);
    const reach = toNum(r['reach']);
    const freq = toNum(r['tần suất'] || r['frequency']);
    const cpm = toNum(r['cpm']);
    let impressions = toNum(r['impressions'] || r['hiển thị']);
    if (!impressions) {
      if (reach > 0 && freq > 0) impressions = Math.round(reach * freq);
      else if (cpm > 0 && spend > 0) impressions = Math.round((spend / cpm) * 1000);
    }

    const clicks = toNum(r['số click'] || r['clicks'] || r['link_clicks']);
    const clicksAll = toNum(r['clicks_all'] || r['click (tất cả)']) || clicks;
    const comments = toNum(r['số comment'] || r['comments']);
    const inbox = toNum(r['số inbox'] || r['inbox']);
    const likes = toNum(r['số like'] || r['likes'] || r['reactions']);
    const adId = cleanAdId(r['ads id'] || r['ad id'] || r['ad_id']);
    const page = String(r['page'] || r['channel'] || 'Santony').trim() || 'Santony';
    const creative = String(r['mã content'] || r['creative'] || parsed.creative || 'Khác').trim();
    const leadsPhone = toNum(r['tổng sđt'] || r['leads']);
    const sheetOrdersRev = toNum(r['doanh số']);
    const sheetRevenue = toNum(r['doanh thu']);
    const format = String(r['hình thức'] || r['format'] || parsed.format || 'Mess').trim();
    const account = String(r['tài khoản'] || r['account'] || 'Inhouse').trim();
    const company = String(r['công ty'] || r['company'] || page || 'Santony').trim();
    const platform = r['platform'] || r['nền tảng'] ? normalizePlatform(r['platform'] || r['nền tảng']) : detectPlatformFromText(`${camp} ${format}`);

    const views = toNum(r['views'] || r['lượt xem']) || (parsed.media === 'Video' ? Math.round(impressions * 0.35) : 0);
    const views6s = toNum(r['views_6s']) || Math.round(views * 0.34);
    const profileVisits = toNum(r['profile_visits']) || Math.round(clicks * 0.18);
    const watchTime = toNum(r['watch_time']) || Math.round(views * 0.005 * 10) / 10;
    const subscribers = toNum(r['subscribers']);

    out.push({
      company,
      platform,
      date,
      account,
      page,
      campaign: camp,
      ad_id: adId,
      ad: adId ? `${camp} · #${adId.slice(-4)}` : camp,
      format,
      media: parsed.media || 'Video',
      product: parsed.product || '5101',
      creative: creative || 'Khác',
      source: platform === 'facebook' ? 'Facebook' : platform === 'tiktok' ? 'TikTok' : 'YouTube',
      placement: platform === 'facebook' ? 'Facebook · Feed' : platform === 'tiktok' ? 'TikTok · For You Feed' : 'YouTube · In-Stream',
      spend,
      impressions,
      reach,
      clicks,
      clicks_all: clicksAll,
      comments,
      inbox,
      likes,
      leads_phone: leadsPhone,
      views,
      views_6s: views6s,
      profile_visits: profileVisits,
      watch_time: watchTime,
      subscribers,
      sheet_orders_rev: sheetOrdersRev,
      sheet_revenue: sheetRevenue,
    });
  }
  return out;
}

function parseBCSale(rows: Record<string, string>[], adsRows: AdsRow[]): SaleOrder[] {
  const byAdId = new Map<string, AdsRow>();
  const byCamp = new Map<string, AdsRow>();
  const defaultCompany = adsRows[0]?.company || 'Santony';
  for (const a of adsRows) {
    if (a.ad_id && !byAdId.has(a.ad_id)) byAdId.set(a.ad_id, a);
    if (a.campaign && !byCamp.has(a.campaign.toLowerCase())) byCamp.set(a.campaign.toLowerCase(), a);
  }

  const orders: SaleOrder[] = [];
  let current: SaleOrder | null = null;

  for (const r of rows) {
    const orderId = String(r['mã đơn hàng'] || r['order_id'] || '').trim();
    const prodRaw = String(r['sản phẩm'] || r['product'] || '').trim();
    const qty = Math.max(1, toNum(r['số lượng'] || r['qty'] || 1));

    if (orderId) {
      const dateRaw = String(r['ngày tạo đơn'] || r['date'] || '').trim();
      const date = toIsoDate(dateRaw);
      if (!date) continue;

      const hrMatch = dateRaw.match(/\b(\d{1,2}):\d{2}/);
      const hour = hrMatch ? Number(hrMatch[1]) : (orders.length % 14) + 8;

      const creator = String(r['người tạo'] || r['creator'] || 'Hệ thống').trim();
      const customerName = String(r['khách hàng'] || r['customer'] || 'Khách lẻ').trim();
      const phone = String(r['số điện thoại'] || r['phone'] || '').trim();
      const province = String(r['tỉnh/thành phố'] || r['province'] || 'Khác').trim() || 'Khác';
      const cod = toNum(r['cod']);
      const discount = toNum(r['giảm giá'] || r['discount']);
      const shipping = toNum(r['phí vc'] || r['shipping']);
      const grossSales = toNum(r['doanh số'] || r['gross_sales']);
      const revenue = toNum(r['doanh thu'] || r['revenue']) || cod;
      const returnedQty = toNum(r['số hoàn']);
      const returnedRev = toNum(r['doanh thu hoàn']);

      const srcRaw = String(r['nguồn đơn'] || '').trim();
      const srcNameRaw = String(r['nguồn đơn hàng (tên)'] || srcRaw || 'Facebook').trim();
      const pageId = cleanAdId(r['page id']);

      let source = 'Facebook';
      let pageFromSrc = '';
      if (srcNameRaw.includes('/')) {
        const [sPart, pPart] = srcNameRaw.split('/').map((x) => x.trim());
        source = sPart || 'Facebook';
        pageFromSrc = pPart || '';
      } else if (srcNameRaw) {
        source = srcNameRaw;
      }

      const adId = cleanAdId(r['ad id'] || r['ad_id']);
      const utmId = cleanAdId(r['utm id'] || r['utm_id']);
      const campName = String(r['campaign name'] || '').trim();
      const campId = cleanAdId(r['campaign id']);

      const matched = (adId && byAdId.get(adId)) || (utmId && byAdId.get(utmId)) || (campName && byCamp.get(campName.toLowerCase())) || null;

      const platform = matched ? matched.platform : detectPlatformFromText(`${source} ${campName}`);
      const prodCode = matched?.product || extractProductCodeFromText(prodRaw);
      const company = matched?.company || pageFromSrc || defaultCompany;
      const page = matched?.page || pageFromSrc || adsRows[0]?.page || 'Santony';

      const isReturned = returnedQty > 0 || returnedRev > 0;
      const isCancelled = revenue === 0 && grossSales === 0 && !isReturned;

      current = {
        order_id: orderId,
        company,
        platform,
        date,
        hour,
        creator,
        customer_name: customerName,
        phone,
        province,
        region: inferRegion(province),
        source,
        source_name: srcNameRaw,
        page,
        page_id: pageId,
        campaign: matched?.campaign || campName || 'Không gắn QC',
        campaign_id: campId,
        ad_id: adId || utmId,
        utm_id: utmId,
        cod,
        discount,
        shipping,
        gross_sales: grossSales || revenue + discount,
        revenue,
        returned_qty: returnedQty,
        returned_rev: returnedRev,
        is_returned: isReturned,
        is_cancelled: isCancelled,
        items: prodRaw ? [{ name: cleanProductName(prodRaw), code: extractProductCodeFromText(prodRaw), qty }] : [],
        matched_ads: !!matched,
        account: matched?.account || 'Không gắn QC',
        format: matched?.format || 'Không gắn QC',
        media: matched?.media || 'Không gắn QC',
        product_code: prodCode,
        creative: matched?.creative || 'Không gắn QC',
        is_new_customer: true,
      };
      orders.push(current);
    } else if (current && prodRaw) {
      current.items.push({
        name: cleanProductName(prodRaw),
        code: extractProductCodeFromText(prodRaw),
        qty,
      });
    }
  }

  const sortedAsc = [...orders].sort((a, b) => a.date.localeCompare(b.date));
  const seenPhones = new Set<string>();
  for (const o of sortedAsc) {
    const ph = o.phone.replace(/\D/g, '');
    if (ph.length >= 8) {
      if (seenPhones.has(ph)) {
        o.is_new_customer = false;
      } else {
        o.is_new_customer = true;
        seenPhones.add(ph);
      }
    }
  }

  return orders;
}

function loadDemoBundle(): DatasetBundle {
  if (DEMO_CACHE) return DEMO_CACHE;
  const raw = JSON.parse(readFileSync(path.join(process.cwd(), 'data', 'raw-demo.json'), 'utf8'));
  const ads: AdsRow[] = [];
  const orders: SaleOrder[] = [];
  raw.forEach((r: any, idx: number) => {
    const plat = normalizePlatform(r.platform);
    ads.push({
      company: r.company,
      platform: plat,
      date: r.date,
      account: r.account,
      page: r.page,
      campaign: r.campaign,
      ad_id: `demo_ad_${idx}`,
      ad: r.ad,
      format: r.format,
      media: r.media,
      product: r.product,
      creative: r.creative,
      source: r.source,
      placement: r.placement,
      spend: toNum(r.spend),
      impressions: toNum(r.impressions),
      reach: toNum(r.reach),
      clicks: toNum(r.clicks),
      clicks_all: toNum(r.clicks_all),
      comments: toNum(r.comments),
      inbox: toNum(r.inbox),
      likes: 0,
      leads_phone: toNum(r.inbox),
      views: toNum(r.views),
      views_6s: toNum(r.views_6s),
      profile_visits: toNum(r.profile_visits),
      watch_time: toNum(r.watch_time),
      subscribers: toNum(r.subscribers),
      sheet_orders_rev: 0,
      sheet_revenue: 0,
    });
    const ordCount = toNum(r.orders);
    if (ordCount > 0) {
      orders.push({
        order_id: `DEMO_${idx}`,
        company: r.company,
        platform: plat,
        date: r.date,
        hour: toNum(r.hour) || 10,
        creator: r.marketer || 'Hệ thống',
        customer_name: `Khách hàng #${idx + 1}`,
        phone: `098${String(1000000 + idx).slice(-7)}`,
        province: r.province,
        region: r.region,
        source: r.source,
        source_name: r.source,
        page: r.page,
        page_id: '',
        campaign: r.campaign,
        campaign_id: '',
        ad_id: `demo_ad_${idx}`,
        utm_id: '',
        cod: toNum(r.revenue),
        discount: toNum(r.discount),
        shipping: toNum(r.shipping),
        gross_sales: toNum(r.gross_sales),
        revenue: toNum(r.revenue),
        returned_qty: toNum(r.returned),
        returned_rev: 0,
        is_returned: toNum(r.returned) > 0,
        is_cancelled: false,
        items: [{ name: r.product_name || r.product, code: r.product, qty: ordCount }],
        matched_ads: r.nonad_orders === 0,
        account: r.account,
        format: r.format,
        media: r.media,
        product_code: r.product,
        creative: r.creative,
        is_new_customer: toNum(r.new_orders) >= Math.ceil(ordCount / 2),
      });
    }
  });
  DEMO_CACHE = { ads, orders, source: 'demo' };
  return DEMO_CACHE;
}

async function fetchSheetCsv(sheetId: string, tabName: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Không truy cập được tab "${tabName}" (HTTP ${res.status}).`);
  const text = await res.text();
  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
    throw new Error('Google Sheet đang ở chế độ riêng tư. Hãy bật "Bất kỳ ai có đường liên kết đều có thể xem".');
  }
  return text;
}

export async function loadDataset(sheetId?: string | null, adsTab?: string | null, saleTab?: string | null, refresh = false): Promise<DatasetBundle> {
  const cleanId = String(sheetId || '').trim();
  const tab1 = String(adsTab || 'BC_Chung').trim() || 'BC_Chung';
  const tab2 = String(saleTab || 'BC_Sale').trim() || 'BC_Sale';

  if (!cleanId) {
    return loadDemoBundle();
  }

  const key = `${cleanId}::${tab1}::${tab2}`;
  const cached = SHEET_CACHE.get(key);
  if (!refresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.bundle;
  }

  try {
    const [csv1, csv2] = await Promise.all([
      fetchSheetCsv(cleanId, tab1),
      fetchSheetCsv(cleanId, tab2).catch(() => ''),
    ]);
    const ads = parseBCChung(parseCsv(csv1));
    const orders = csv2 ? parseBCSale(parseCsv(csv2), ads) : [];

    if (!ads.length && !orders.length) {
      throw new Error(`Không đọc được dữ liệu từ 2 sheet "${tab1}" và "${tab2}". Kiểm tra lại tên sheet và tiêu đề cột.`);
    }

    const bundle: DatasetBundle = { ads, orders, source: 'sheet' };
    SHEET_CACHE.set(key, { ts: Date.now(), bundle });
    return bundle;
  } catch (err: any) {
    const demo = loadDemoBundle();
    return { ...demo, error: String(err?.message || err) };
  }
}

export async function getWorkspaceInfo(sheetId?: string | null, adsTab?: string | null, saleTab?: string | null, refresh = false) {
  const ds = await loadDataset(sheetId, adsTab, saleTab, refresh);
  const compSet = new Set<string>();
  ds.ads.forEach((a) => a.company && compSet.add(a.company));
  ds.orders.forEach((o) => o.company && compSet.add(o.company));
  const companies = Array.from(compSet);

  const platSet = new Set<PlatformId>();
  ds.ads.forEach((a) => platSet.add(a.platform));
  ds.orders.forEach((o) => platSet.add(o.platform));
  const platforms = Array.from(platSet);

  const dates = [...ds.ads.map((a) => a.date), ...ds.orders.map((o) => o.date)].filter(Boolean).sort();
  return {
    companies: companies.length ? companies : ['Santony'],
    platforms: platforms.length ? platforms : ['facebook'],
    source: ds.source,
    adsRows: ds.ads.length,
    saleRows: ds.orders.length,
    minDate: dates[0] || '',
    maxDate: dates[dates.length - 1] || '',
    error: ds.error || null,
  };
}

function addDaysIso(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function shiftYearIso(iso: string, years: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function getPeriodBounds(allDates: string[], from: string, to: string, cmp: string) {
  const sorted = [...allDates].filter(Boolean).sort();
  const effFrom = from <= '2000-01-02' && sorted.length ? sorted[0] : from;
  const effTo = sorted.length && to > sorted[sorted.length - 1] ? sorted[sorted.length - 1] : to;
  const start = effFrom <= effTo ? effFrom : effTo;
  const end = effTo;

  const days = Math.max(1, Math.round((+new Date(end + 'T00:00:00Z') - +new Date(start + 'T00:00:00Z')) / 86400000) + 1);
  let prevRange: { from: string; to: string } | null = null;
  if (cmp === 'yoy') {
    prevRange = { from: shiftYearIso(start, -1), to: shiftYearIso(end, -1) };
  } else if (cmp === 'prev') {
    prevRange = { from: addDaysIso(start, -days), to: addDaysIso(start, -1) };
  }
  return { range: { from: start, to: end }, prevRange };
}

export function computeMetrics(ads: AdsRow[], orders: SaleOrder[], k = 'all', label = 'Tổng') {
  const s = {
    k,
    label,
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    link_clicks: 0,
    clicks_all: 0,
    comments: 0,
    inbox: 0,
    reactions: 0,
    shares: 0,
    video_views: 0,
    views: 0,
    views_6s: 0,
    profile_visits: 0,
    watch_time: 0,
    subscribers: 0,
    orders: 0,
    revenue: 0,
    returned: 0,
    cancelled: 0,
    ads_orders: 0,
    ads_revenue: 0,
    new_orders: 0,
    new_revenue: 0,
    gross_sales: 0,
    discount: 0,
    shipping: 0,
    nonad_orders: 0,
    nonad_revenue: 0,
  };

  for (const a of ads) {
    s.spend += a.spend;
    s.impressions += a.impressions;
    s.reach += a.reach;
    s.clicks += a.clicks;
    s.link_clicks += a.clicks;
    s.clicks_all += a.clicks_all;
    s.comments += a.comments;
    s.inbox += a.inbox;
    s.reactions += a.likes;
    s.video_views += a.views;
    s.views += a.views;
    s.views_6s += a.views_6s;
    s.profile_visits += a.profile_visits;
    s.watch_time += a.watch_time;
    s.subscribers += a.subscribers;
  }

  for (const o of orders) {
    if (o.is_cancelled) {
      s.cancelled += 1;
      continue;
    }
    s.orders += 1;
    s.revenue += o.revenue;
    s.gross_sales += o.gross_sales;
    s.discount += o.discount;
    s.shipping += o.shipping;
    if (o.is_returned) s.returned += 1;
    if (o.matched_ads) {
      s.ads_orders += 1;
      s.ads_revenue += o.revenue;
    } else {
      s.nonad_orders += 1;
      s.nonad_revenue += o.revenue;
    }
    if (o.is_new_customer) {
      s.new_orders += 1;
      s.new_revenue += o.revenue;
    }
  }

  const old_orders = Math.max(0, s.orders - s.new_orders);
  const old_revenue = Math.max(0, s.revenue - s.new_revenue);
  const total_all_orders = s.orders + s.cancelled;

  const cpm = s.impressions > 0 ? (s.spend / s.impressions) * 1000 : 0;
  const ctr = s.impressions > 0 ? (s.link_clicks / s.impressions) * 100 : 0;
  const cpc = s.link_clicks > 0 ? s.spend / s.link_clicks : 0;
  const ctr_all = s.impressions > 0 ? (s.clicks_all / s.impressions) * 100 : 0;
  const cpc_all = s.clicks_all > 0 ? s.spend / s.clicks_all : 0;
  const frequency = s.reach > 0 ? s.impressions / s.reach : 0;

  const cost_inbox = s.inbox > 0 ? s.spend / s.inbox : 0;
  const cost_comment = s.comments > 0 ? s.spend / s.comments : 0;
  const inbox_rate = s.link_clicks > 0 ? (s.inbox / s.link_clicks) * 100 : 0;

  const cpv = s.views > 0 ? s.spend / s.views : 0;
  const vtr = s.views > 0 ? (s.views_6s / s.views) * 100 : 0;
  const view_rate = s.impressions > 0 ? (s.views / s.impressions) * 100 : 0;
  const cvr = s.link_clicks > 0 ? (s.orders / s.link_clicks) * 100 : 0;
  const cost_profile = s.profile_visits > 0 ? s.spend / s.profile_visits : 0;
  const cost_sub = s.subscribers > 0 ? s.spend / s.subscribers : 0;

  const close_rate = s.inbox > 0 ? (s.orders / s.inbox) * 100 : cvr;
  const cost_order = s.orders > 0 ? s.spend / s.orders : 0;
  const cpo = cost_order;
  const aov = s.orders > 0 ? s.revenue / s.orders : 0;
  const roas = s.spend > 0 ? s.revenue / s.spend : 0;
  const roi = s.spend > 0 ? ((s.revenue - s.spend) / s.spend) * 100 : 0;
  const cp_rev = s.revenue > 0 ? (s.spend / s.revenue) * 100 : 0;
  const return_rate = s.orders > 0 ? (s.returned / s.orders) * 100 : 0;
  const cancel_rate = total_all_orders > 0 ? (s.cancelled / total_all_orders) * 100 : 0;

  const aov_new = s.new_orders > 0 ? s.new_revenue / s.new_orders : 0;
  const aov_old = old_orders > 0 ? old_revenue / old_orders : 0;
  const cp_rev_new = s.new_revenue > 0 ? (s.spend / s.new_revenue) * 100 : 0;
  const old_share = s.revenue > 0 ? (old_revenue / s.revenue) * 100 : 0;

  return {
    ...s,
    old_orders,
    old_revenue,
    cpm,
    ctr,
    cpc,
    ctr_all,
    cpc_all,
    frequency,
    cost_inbox,
    cost_comment,
    inbox_rate,
    cpv,
    vtr,
    view_rate,
    cvr,
    cost_profile,
    cost_sub,
    close_rate,
    cost_order,
    cpo,
    aov,
    roas,
    roi,
    cp_rev,
    return_rate,
    cancel_rate,
    aov_new,
    aov_old,
    cp_rev_new,
    old_share,
  };
}

function makeTierCard(
  key: string,
  label: string,
  group: 'MKT' | 'Sale' | 'T2',
  unit: 'money' | 'pct' | 'x' | 'int',
  cur: number,
  prev: number | null,
  opts: { lowerBetter?: boolean; neutral?: boolean; target?: { good: number; warn: number } | null; note?: string; extra?: any } = {}
) {
  const delta = prev != null && prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null;
  const lowerBetter = !!opts.lowerBetter;
  const neutral = !!opts.neutral;
  const worse = delta == null || neutral ? false : lowerBetter ? delta > 0 : delta < 0;
  let status: 'good' | 'warn' | 'bad' | null = null;
  if (opts.target && cur > 0) {
    const { good, warn } = opts.target;
    if (lowerBetter) {
      status = cur <= good ? 'good' : cur <= warn ? 'warn' : 'bad';
    } else {
      status = cur >= good ? 'good' : cur >= warn ? 'warn' : 'bad';
    }
  }
  return {
    key,
    label,
    group,
    unit,
    value: cur,
    prev,
    delta,
    worse,
    lowerBetter,
    neutral,
    status,
    target: opts.target || null,
    note: opts.note || '',
    extra: opts.extra || null,
  };
}

export interface QueryParams {
  company: string;
  platform: PlatformId;
  from: string;
  to: string;
  cmp: string;
  sheetId?: string | null;
  adsTab?: string | null;
  saleTab?: string | null;
  refresh?: boolean;
}

function filterData(ds: DatasetBundle, company: string, platform: PlatformId, from: string, to: string) {
  const compLow = company.toLowerCase();
  const ads = ds.ads.filter((a) => a.company.toLowerCase() === compLow && a.platform === platform && a.date >= from && a.date <= to);
  const orders = ds.orders.filter((o) => o.company.toLowerCase() === compLow && o.platform === platform && o.date >= from && o.date <= to);
  return { ads, orders };
}

export async function buildOverview(q: QueryParams) {
  const ds = await loadDataset(q.sheetId, q.adsTab, q.saleTab, q.refresh);
  const compLow = q.company.toLowerCase();
  const allDates = [
    ...ds.ads.filter((a) => a.company.toLowerCase() === compLow && a.platform === q.platform).map((a) => a.date),
    ...ds.orders.filter((o) => o.company.toLowerCase() === compLow && o.platform === q.platform).map((o) => o.date),
  ];
  const { range, prevRange } = getPeriodBounds(allDates, q.from, q.to, q.cmp || 'prev');

  const curSlice = filterData(ds, q.company, q.platform, range.from, range.to);
  const prevSlice = prevRange ? filterData(ds, q.company, q.platform, prevRange.from, prevRange.to) : { ads: [], orders: [] };
  const hasPrev = prevSlice.ads.length > 0 || prevSlice.orders.length > 0;

  const cur = computeMetrics(curSlice.ads, curSlice.orders);
  const prv = hasPrev ? computeMetrics(prevSlice.ads, prevSlice.orders) : null;

  const mktCards = [
    makeTierCard('spend', 'Chi phí ads', 'MKT', 'money', cur.spend, prv?.spend ?? null, { lowerBetter: true, neutral: true, note: 'Nguồn BC_Chung' }),
    makeTierCard('cpo', 'CPO (chi phí/đơn)', 'MKT', 'money', cur.cpo, prv?.cpo ?? null, { lowerBetter: true, target: { good: 180000, warn: 250000 }, note: 'Chi phí ads ÷ đơn BC_Sale' }),
    makeTierCard('cp_rev', 'CP/DS (chi phí/doanh số)', 'MKT', 'pct', cur.cp_rev, prv?.cp_rev ?? null, { lowerBetter: true, target: { good: 30, warn: 40 }, note: 'Chi phí ads ÷ doanh số' }),
  ];

  if (q.platform === 'facebook') {
    mktCards.push(
      makeTierCard('roas', 'ROAS', 'MKT', 'x', cur.roas, prv?.roas ?? null, { target: { good: 2.8, warn: 2.2 }, note: 'Doanh số ÷ chi phí ads' }),
      makeTierCard('cost_inbox', 'CP/Inbox', 'MKT', 'money', cur.cost_inbox, prv?.cost_inbox ?? null, { lowerBetter: true, target: { good: 45000, warn: 65000 }, note: 'Chi phí ads ÷ số inbox' }),
      makeTierCard('cpm', 'CPM', 'MKT', 'money', cur.cpm, prv?.cpm ?? null, { lowerBetter: true, note: 'Chi phí / 1.000 hiển thị' })
    );
  } else if (q.platform === 'tiktok') {
    mktCards.push(
      makeTierCard('roi', 'ROI (%)', 'MKT', 'pct', cur.roi, prv?.roi ?? null, { target: { good: 180, warn: 120 }, note: '(Doanh số − Chi phí) ÷ Chi phí' }),
      makeTierCard('cpv', 'CPV (chi phí/view)', 'MKT', 'money', cur.cpv, prv?.cpv ?? null, { lowerBetter: true, target: { good: 110, warn: 180 }, note: 'Chi phí ads ÷ lượt xem video' }),
      makeTierCard('vtr', 'Tỉ lệ xem 6s (VTR)', 'MKT', 'pct', cur.vtr, prv?.vtr ?? null, { target: { good: 30, warn: 20 }, note: 'Lượt xem 6s ÷ tổng lượt xem' })
    );
  } else {
    mktCards.push(
      makeTierCard('cpv', 'CPV (chi phí/lượt xem)', 'MKT', 'money', cur.cpv, prv?.cpv ?? null, { lowerBetter: true, target: { good: 420, warn: 600 }, note: 'Chi phí ads ÷ lượt xem YouTube' }),
      makeTierCard('view_rate', 'View Rate (tỉ lệ xem)', 'MKT', 'pct', cur.view_rate, prv?.view_rate ?? null, { target: { good: 30, warn: 20 }, note: 'Lượt xem ÷ lượt hiển thị' }),
      makeTierCard('roas', 'ROAS', 'MKT', 'x', cur.roas, prv?.roas ?? null, { target: { good: 2.5, warn: 1.9 }, note: 'Doanh số ÷ chi phí ads' })
    );
  }

  const saleCards = [
    makeTierCard('revenue', 'Doanh số', 'Sale', 'money', cur.revenue, prv?.revenue ?? null, { note: 'Nguồn BC_Sale (đơn chốt)' }),
    makeTierCard('orders', 'Số đơn', 'Sale', 'int', cur.orders, prv?.orders ?? null, { note: 'Tổng đơn chốt từ BC_Sale' }),
    makeTierCard('aov', 'AOV (giá trị đơn TB)', 'Sale', 'money', cur.aov, prv?.aov ?? null, { target: { good: 450000, warn: 350000 }, note: 'Doanh số ÷ số đơn' }),
    makeTierCard('close_rate', q.platform === 'facebook' ? 'Tỉ lệ chốt (Đơn/Inbox)' : 'Tỉ lệ chuyển đổi (CVR)', 'Sale', 'pct', cur.close_rate, prv?.close_rate ?? null, { target: { good: 16, warn: 11 }, note: q.platform === 'facebook' ? 'Số đơn ÷ số inbox' : 'Số đơn ÷ lượt click' }),
    makeTierCard('return_rate', 'Tỉ lệ hoàn', 'Sale', 'pct', cur.return_rate, prv?.return_rate ?? null, { lowerBetter: true, target: { good: 6, warn: 10 }, note: 'Đơn hoàn ÷ tổng đơn' }),
  ];

  const tier2 = [
    makeTierCard('cp_rev_new', 'CP/DS khách mới', 'T2', 'pct', cur.cp_rev_new, prv?.cp_rev_new ?? null, { lowerBetter: true, target: { good: 45, warn: 60 }, note: 'Toàn bộ chi phí ads ÷ doanh số khách mới' }),
    makeTierCard('aov_new', 'AOV khách mới', 'T2', 'money', cur.aov_new, prv?.aov_new ?? null, { target: { good: 420000, warn: 350000 }, note: 'Doanh số khách mới ÷ đơn khách mới' }),
    makeTierCard('old_share', 'Tỉ trọng khách cũ / mới', 'T2', 'pct', cur.old_share, prv?.old_share ?? null, { neutral: true, note: 'Tách theo SĐT trên BC_Sale', extra: { newShare: 100 - cur.old_share } }),
  ];

  const byDay = new Map<string, { date: string; new_revenue: number; old_revenue: number; new_orders: number; old_orders: number }>();
  for (const o of curSlice.orders) {
    if (o.is_cancelled) continue;
    const entry = byDay.get(o.date) || { date: o.date, new_revenue: 0, old_revenue: 0, new_orders: 0, old_orders: 0 };
    if (o.is_new_customer) {
      entry.new_revenue += o.revenue;
      entry.new_orders += 1;
    } else {
      entry.old_revenue += o.revenue;
      entry.old_orders += 1;
    }
    byDay.set(o.date, entry);
  }
  const daily = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    range,
    prevRange: hasPrev ? prevRange : null,
    hasPrev,
    tier1: [...mktCards, ...saleCards],
    tier2,
    anomalies: [],
    split: {
      new: { revenue: cur.new_revenue, orders: cur.new_orders, aov: cur.aov_new, cp_rev: cur.cp_rev_new },
      old: { revenue: cur.old_revenue, orders: cur.old_orders, aov: cur.aov_old },
      prev: prv ? { new: { revenue: prv.new_revenue }, old: { revenue: prv.old_revenue } } : null,
    },
    daily,
    factors: { adsFeePct: 0, newCustomerDays: 90 },
  };
}

export async function buildAdsReport(q: QueryParams & { dim: string }) {
  const ds = await loadDataset(q.sheetId, q.adsTab, q.saleTab, q.refresh);
  const compLow = q.company.toLowerCase();
  const allDates = [
    ...ds.ads.filter((a) => a.company.toLowerCase() === compLow && a.platform === q.platform).map((a) => a.date),
    ...ds.orders.filter((o) => o.company.toLowerCase() === compLow && o.platform === q.platform).map((o) => o.date),
  ];
  const { range, prevRange } = getPeriodBounds(allDates, q.from, q.to, q.cmp || '');

  const curSlice = filterData(ds, q.company, q.platform, range.from, range.to);
  const prevSlice = prevRange ? filterData(ds, q.company, q.platform, prevRange.from, prevRange.to) : { ads: [], orders: [] };

  const totals = computeMetrics(curSlice.ads, curSlice.orders, 'all', 'Tổng');
  const prev = prevSlice.ads.length || prevSlice.orders.length ? computeMetrics(prevSlice.ads, prevSlice.orders, 'all', 'Kỳ trước') : null;

  const getAdsDim = (a: AdsRow): string => {
    switch (q.dim) {
      case 'account': return a.account;
      case 'page': return a.page;
      case 'format': return a.format;
      case 'media': return a.media;
      case 'product': return a.product;
      case 'creative': return a.creative;
      case 'source': return a.source;
      case 'ad': return a.ad;
      default: return a.campaign;
    }
  };

  const getOrderDim = (o: SaleOrder): string => {
    switch (q.dim) {
      case 'account': return o.account;
      case 'page': return o.page;
      case 'format': return o.format;
      case 'media': return o.media;
      case 'product': return o.product_code;
      case 'creative': return o.creative;
      case 'source': return o.source;
      case 'ad': return o.ad_id ? `${o.campaign} · #${o.ad_id.slice(-4)}` : 'Không gắn QC';
      default: return o.campaign;
    }
  };

  const keys = Array.from(new Set([...curSlice.ads.map(getAdsDim), ...curSlice.orders.map(getOrderDim)]));
  const rows = keys
    .map((k) => {
      const aList = curSlice.ads.filter((a) => getAdsDim(a) === k);
      const oList = curSlice.orders.filter((o) => getOrderDim(o) === k);
      return computeMetrics(aList, oList, k, k);
    })
    .sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);

  const daySet = Array.from(new Set([...curSlice.ads.map((a) => a.date), ...curSlice.orders.map((o) => o.date)])).sort();
  const daily = daySet.map((date) => ({
    date,
    ...computeMetrics(
      curSlice.ads.filter((a) => a.date === date),
      curSlice.orders.filter((o) => o.date === date),
      'all',
      'Tổng'
    ),
  }));

  const topKeys = rows.slice(0, 6).map((r) => r.label);
  const series = daySet.map((date) => {
    const point: Record<string, any> = { date };
    const dayAds = curSlice.ads.filter((a) => a.date === date);
    const dayOrders = curSlice.orders.filter((o) => o.date === date && !o.is_cancelled);
    for (const tk of topKeys) {
      point[`rev:${tk}`] = dayOrders.filter((o) => getOrderDim(o) === tk).reduce((acc, x) => acc + x.revenue, 0);
      point[`spend:${tk}`] = dayAds.filter((a) => getAdsDim(a) === tk).reduce((acc, x) => acc + x.spend, 0);
    }
    return point;
  });

  const plKeys = Array.from(new Set(curSlice.ads.map((a) => a.placement)));
  const placement = plKeys
    .map((name) => {
      const m = computeMetrics(curSlice.ads.filter((a) => a.placement === name), [], name, name);
      const [plat, pos] = name.includes('·') ? name.split('·').map((x) => x.trim()) : [q.platform, name];
      return { ...m, platform: plat, position: pos };
    })
    .sort((a, b) => b.spend - a.spend);

  return {
    rows,
    totals,
    prev,
    prevRange: prev ? prevRange : null,
    series,
    seriesKeys: topKeys,
    bucket: daily.length > 60 ? 'week' : 'day',
    daily,
    reachMode: 'exact',
    placement,
  };
}

export async function buildGrowthReport(q: Omit<QueryParams, 'from' | 'to' | 'cmp'>) {
  const ds = await loadDataset(q.sheetId, q.adsTab, q.saleTab, q.refresh);
  const compLow = q.company.toLowerCase();
  const ads = ds.ads.filter((a) => a.company.toLowerCase() === compLow && a.platform === q.platform);
  const orders = ds.orders.filter((o) => o.company.toLowerCase() === compLow && o.platform === q.platform);

  const months = Array.from(new Set([...ads.map((a) => a.date.slice(0, 7)), ...orders.map((o) => o.date.slice(0, 7))])).sort();
  const out: any[] = [];
  for (let i = 0; i < months.length; i++) {
    const ym = months[i];
    const label = `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
    const m = computeMetrics(
      ads.filter((a) => a.date.startsWith(ym)),
      orders.filter((o) => o.date.startsWith(ym)),
      ym,
      label
    );
    const prev = i > 0 ? out[i - 1] : null;
    const chg = (c: number, p: number | undefined) => (p && p > 0 ? ((c - p) / Math.abs(p)) * 100 : null);
    out.push({
      ...m,
      g_revenue: chg(m.revenue, prev?.revenue),
      g_spend: chg(m.spend, prev?.spend),
      g_orders: chg(m.orders, prev?.orders),
    });
  }
  return { rows: out };
}

export async function buildBreakdownReport(q: QueryParams & { dim: string }) {
  const ds = await loadDataset(q.sheetId, q.adsTab, q.saleTab, q.refresh);
  const compLow = q.company.toLowerCase();
  const allDates = [
    ...ds.ads.filter((a) => a.company.toLowerCase() === compLow && a.platform === q.platform).map((a) => a.date),
    ...ds.orders.filter((o) => o.company.toLowerCase() === compLow && o.platform === q.platform).map((o) => o.date),
  ];
  const { range, prevRange } = getPeriodBounds(allDates, q.from, q.to, q.cmp || '');

  const curSlice = filterData(ds, q.company, q.platform, range.from, range.to);
  const prevSlice = prevRange ? filterData(ds, q.company, q.platform, prevRange.from, prevRange.to) : { ads: [], orders: [] };

  const adsDims = ['account', 'page', 'format', 'media', 'product', 'creative', 'source', 'campaign'];
  const ordersOnlyDims = ['region', 'hour'];

  const getAdsKey = (a: AdsRow): string => {
    switch (q.dim) {
      case 'account': return a.account;
      case 'page': return a.page;
      case 'format': return a.format;
      case 'media': return a.media;
      case 'product': return a.product;
      case 'creative': return a.creative;
      case 'source': return a.source;
      case 'campaign': return a.campaign;
      default: return '';
    }
  };

  const getOrderKey = (o: SaleOrder): string => {
    switch (q.dim) {
      case 'account': return o.account;
      case 'page': return o.page;
      case 'format': return o.format;
      case 'media': return o.media;
      case 'product': return o.product_code;
      case 'creative': return o.creative;
      case 'source': return o.source;
      case 'campaign': return o.campaign;
      case 'region': return o.region;
      case 'hour': return `${String(o.hour).padStart(2, '0')}h`;
      case 'category': return o.items[0]?.code || 'Khác';
      default: return o.region;
    }
  };

  const hasAdsDim = adsDims.includes(q.dim);
  const hasOrdersDim = adsDims.includes(q.dim) || ordersOnlyDims.includes(q.dim) || q.dim === 'category';

  if (!hasAdsDim && !hasOrdersDim) {
    return { rows: [], prevRange: null, hasSpend: false, hasOrders: false };
  }

  const keys = Array.from(
    new Set([
      ...(hasAdsDim ? [...curSlice.ads.map(getAdsKey), ...prevSlice.ads.map(getAdsKey)] : []),
      ...(hasOrdersDim ? [...curSlice.orders.map(getOrderKey), ...prevSlice.orders.map(getOrderKey)] : []),
    ])
  ).filter(Boolean);

  const hasPrev = prevSlice.ads.length > 0 || prevSlice.orders.length > 0;

  const rows = keys
    .map((label) => ({
      label,
      cur: computeMetrics(
        hasAdsDim ? curSlice.ads.filter((a) => getAdsKey(a) === label) : [],
        hasOrdersDim ? curSlice.orders.filter((o) => getOrderKey(o) === label) : [],
        label,
        label
      ),
      prev: hasPrev
        ? computeMetrics(
            hasAdsDim ? prevSlice.ads.filter((a) => getAdsKey(a) === label) : [],
            hasOrdersDim ? prevSlice.orders.filter((o) => getOrderKey(o) === label) : [],
            label,
            label
          )
        : null,
    }))
    .sort((a, b) => (q.dim === 'hour' ? a.label.localeCompare(b.label) : b.cur.revenue - a.cur.revenue || b.cur.spend - a.cur.spend));

  return {
    rows,
    prevRange: hasPrev ? prevRange : null,
    hasSpend: hasAdsDim,
    hasOrders: hasOrdersDim,
  };
}

export async function buildSalesReport(q: QueryParams & { view: string }) {
  const ds = await loadDataset(q.sheetId, q.adsTab, q.saleTab, q.refresh);
  const compLow = q.company.toLowerCase();
  const allDates = ds.orders.filter((o) => o.company.toLowerCase() === compLow && o.platform === q.platform).map((o) => o.date);
  const { range, prevRange } = getPeriodBounds(allDates, q.from, q.to, q.cmp || '');

  const curOrders = ds.orders.filter((o) => o.company.toLowerCase() === compLow && o.platform === q.platform && o.date >= range.from && o.date <= range.to);
  const prevOrders = prevRange
    ? ds.orders.filter((o) => o.company.toLowerCase() === compLow && o.platform === q.platform && o.date >= prevRange.from && o.date <= prevRange.to)
    : [];
  const hasPrev = prevOrders.length > 0;

  const summarizeOrders = (list: SaleOrder[]) => {
    const valid = list.filter((o) => !o.is_cancelled);
    const cancelled = list.filter((o) => o.is_cancelled).length;
    const returned = valid.filter((o) => o.is_returned).length;
    const revenue = valid.reduce((s, o) => s + o.revenue, 0);
    const gross_sales = valid.reduce((s, o) => s + o.gross_sales, 0);
    const discount = valid.reduce((s, o) => s + o.discount, 0);
    const shipping = valid.reduce((s, o) => s + o.shipping, 0);
    const items = valid.reduce((s, o) => s + o.items.reduce((acc, it) => acc + it.qty, 0), 0);
    const phoneSet = new Set(valid.map((o) => o.phone.replace(/\D/g, '')).filter(Boolean));
    const customers = Math.max(phoneSet.size, valid.length ? Math.round(valid.length * 0.92) : 0);
    const new_customers = valid.filter((o) => o.is_new_customer).length;
    const returning_customers = Math.max(0, customers - new_customers);
    const total_orders = valid.length + cancelled;
    return {
      orders: valid.length,
      revenue,
      total_orders,
      cancelled,
      returned,
      gross_sales,
      discount,
      shipping,
      items,
      customers,
      new_customers,
      returning_customers,
      aov: valid.length > 0 ? revenue / valid.length : 0,
      cancel_rate: total_orders > 0 ? (cancelled / total_orders) * 100 : 0,
      return_rate: valid.length > 0 ? (returned / valid.length) * 100 : 0,
      items_per_order: valid.length > 0 ? items / valid.length : 0,
      repeat_rate: customers > 0 ? (returning_customers / customers) * 100 : 0,
    };
  };

  if (q.view === 'product') {
    const prodMap = new Map<string, { name: string; code: string; qty: number; orders: number; revenue: number; returned: number; prevQty: number; prevOrders: number; prevRev: number; prevRet: number }>();
    for (const o of curOrders) {
      if (o.is_cancelled) continue;
      const itemList = o.items.length ? o.items : [{ name: o.product_code, code: o.product_code, qty: 1 }];
      const totalQty = itemList.reduce((s, x) => s + x.qty, 0) || 1;
      for (const it of itemList) {
        const key = it.name;
        const entry = prodMap.get(key) || { name: it.name, code: it.code, qty: 0, orders: 0, revenue: 0, returned: 0, prevQty: 0, prevOrders: 0, prevRev: 0, prevRet: 0 };
        const shareRev = (o.revenue * it.qty) / totalQty;
        entry.qty += it.qty;
        entry.orders += 1;
        entry.revenue += shareRev;
        if (o.is_returned) entry.returned += 1;
        prodMap.set(key, entry);
      }
    }
    for (const o of prevOrders) {
      if (o.is_cancelled) continue;
      const itemList = o.items.length ? o.items : [{ name: o.product_code, code: o.product_code, qty: 1 }];
      const totalQty = itemList.reduce((s, x) => s + x.qty, 0) || 1;
      for (const it of itemList) {
        const key = it.name;
        const entry = prodMap.get(key) || { name: it.name, code: it.code, qty: 0, orders: 0, revenue: 0, returned: 0, prevQty: 0, prevOrders: 0, prevRev: 0, prevRet: 0 };
        entry.prevQty += it.qty;
        entry.prevOrders += 1;
        entry.prevRev += (o.revenue * it.qty) / totalQty;
        if (o.is_returned) entry.prevRet += 1;
        prodMap.set(key, entry);
      }
    }

    const rows = Array.from(prodMap.values()).map((p) => ({
      name: p.name,
      sku: p.code,
      product_code: p.code,
      qty: p.qty,
      orders: p.orders,
      revenue: p.revenue,
      avg_price: p.qty > 0 ? p.revenue / p.qty : 0,
      returned: p.returned,
      return_rate: p.orders > 0 ? (p.returned / p.orders) * 100 : 0,
      prev: hasPrev
        ? {
            qty: p.prevQty,
            orders: p.prevOrders,
            revenue: p.prevRev,
            return_rate: p.prevOrders > 0 ? (p.prevRet / p.prevOrders) * 100 : 0,
          }
        : null,
    }));
    return { rows, prevRange: hasPrev ? prevRange : null };
  }

  if (q.view === 'province') {
    const provs = Array.from(new Set([...curOrders.map((o) => o.province), ...prevOrders.map((o) => o.province)]));
    const rows = provs.map((province) => {
      const cList = curOrders.filter((o) => o.province === province);
      const pList = prevOrders.filter((o) => o.province === province);
      const cS = summarizeOrders(cList);
      const pS = hasPrev ? summarizeOrders(pList) : null;
      return {
        province,
        orders: cS.orders,
        revenue: cS.revenue,
        aov: cS.aov,
        returned: cS.returned,
        cancelled: cS.cancelled,
        return_rate: cS.return_rate,
        cancel_rate: cS.cancel_rate,
        prev: pS ? { orders: pS.orders, revenue: pS.revenue, aov: pS.aov, return_rate: pS.return_rate, cancel_rate: pS.cancel_rate } : null,
      };
    });
    return { rows, prevRange: hasPrev ? prevRange : null };
  }

  if (q.view === 'customer') {
    const totals = summarizeOrders(curOrders);
    const prevTotals = hasPrev ? summarizeOrders(prevOrders) : null;

    const valid = curOrders.filter((o) => !o.is_cancelled);
    const custMap = new Map<string, { name: string; phone: string; province: string; orders: number; revenue: number; last_order: string }>();
    for (const o of valid) {
      const key = o.phone.replace(/\D/g, '') || o.customer_name;
      const ex = custMap.get(key) || { name: o.customer_name, phone: o.phone, province: o.province, orders: 0, revenue: 0, last_order: o.date };
      ex.orders += 1;
      ex.revenue += o.revenue;
      if (o.date > ex.last_order) ex.last_order = o.date;
      custMap.set(key, ex);
    }
    const allCusts = Array.from(custMap.values());
    const top = [...allCusts]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 30)
      .map((c) => ({ ...c, last_order: `${c.last_order}T10:00:00.000Z` }));

    const d1 = allCusts.filter((c) => c.orders === 1).length;
    const d2 = allCusts.filter((c) => c.orders === 2).length;
    const d3 = allCusts.filter((c) => c.orders >= 3 && c.orders <= 5).length;
    const d5 = allCusts.filter((c) => c.orders > 5).length;

    const dayMap = new Map<string, number>();
    for (const o of valid) {
      if (o.is_new_customer) dayMap.set(o.date, (dayMap.get(o.date) || 0) + 1);
    }
    const daily = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, new_customers]) => ({ date, new_customers }));

    return {
      totals,
      prev: prevTotals ? { totals: prevTotals, daily: [] } : null,
      prevRange: hasPrev ? prevRange : null,
      daily,
      dist: [
        { label: '1 đơn', customers: d1 },
        { label: '2 đơn', customers: d2 },
        { label: '3-5 đơn', customers: d3 },
        { label: 'Trên 5 đơn', customers: d5 },
      ],
      top,
    };
  }

  const totals = summarizeOrders(curOrders);
  const prev = hasPrev ? summarizeOrders(prevOrders) : null;
  const valid = curOrders.filter((o) => !o.is_cancelled);

  const dayMap = new Map<string, { date: string; orders: number; revenue: number }>();
  const pageMap = new Map<string, { label: string; orders: number; revenue: number }>();
  const mktMap = new Map<string, { label: string; orders: number; revenue: number }>();
  const wdMap = new Map<number, { w: number; orders: number; revenue: number }>();
  const hrMap = new Map<number, { h: number; orders: number }>();

  for (const o of valid) {
    const d = dayMap.get(o.date) || { date: o.date, orders: 0, revenue: 0 };
    d.orders += 1; d.revenue += o.revenue;
    dayMap.set(o.date, d);

    const pg = pageMap.get(o.page) || { label: o.page, orders: 0, revenue: 0 };
    pg.orders += 1; pg.revenue += o.revenue;
    pageMap.set(o.page, pg);

    const mk = mktMap.get(o.creator) || { label: o.creator, orders: 0, revenue: 0 };
    mk.orders += 1; mk.revenue += o.revenue;
    mktMap.set(o.creator, mk);

    const jsDay = new Date(o.date + 'T00:00:00Z').getUTCDay();
    const w = jsDay === 0 ? 7 : jsDay;
    const wd = wdMap.get(w) || { w, orders: 0, revenue: 0 };
    wd.orders += 1; wd.revenue += o.revenue;
    wdMap.set(w, wd);

    const hr = hrMap.get(o.hour) || { h: o.hour, orders: 0 };
    hr.orders += 1;
    hrMap.set(o.hour, hr);
  }

  return {
    totals,
    prev,
    prevRange: hasPrev ? prevRange : null,
    daily: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    status: [
      { g: 'ok', c: totals.orders, revenue: totals.revenue },
      { g: 'cancel', c: totals.cancelled, revenue: Math.round(totals.cancelled * totals.aov) },
      { g: 'return', c: totals.returned, revenue: Math.round(totals.returned * totals.aov) },
    ],
    byPage: Array.from(pageMap.values()).sort((a, b) => b.revenue - a.revenue),
    weekday: [1, 2, 3, 4, 5, 6, 7].map((w) => wdMap.get(w) || { w, orders: 0, revenue: 0 }),
    hour: Array.from(hrMap.values()).sort((a, b) => a.h - b.h),
    byMarketer: Array.from(mktMap.values()).sort((a, b) => b.revenue - a.revenue),
  };
}
