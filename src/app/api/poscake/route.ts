import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE = 'https://pos.pages.fm/api/v1';
const n = (v: any) => (v == null || v === '' ? 0 : Number(v) || 0);

export async function POST(req: NextRequest) {
  const { action, key, shop } = await req.json();
  const shopId = String(shop || '').replace(/\D/g, '');
  if (!key || !shopId) return NextResponse.json({ ok: false, message: 'Nhập API key và Shop ID' }, { status: 400 });
  const url = (page: number, size: number, extra = '') =>
    `${BASE}/shops/${shopId}/orders?api_key=${encodeURIComponent(String(key))}&page_size=${size}&page_number=${page}${extra}`;
  try {
    if (action === 'test') {
      const res = await fetch(url(1, 1));
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || j.success === false) throw new Error(j.message || res.statusText);
      return NextResponse.json({ ok: true, total: j.total_entries ?? null });
    }
    const end = Math.floor(Date.now() / 1000), start = end - 7 * 86400;
    const orders: any[] = [];
    for (let page = 1; page <= 5; page++) {
      const res = await fetch(url(page, 100, `&startDateTime=${start}&endDateTime=${end}`));
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok || j.success === false) throw new Error(j.message || res.statusText);
      orders.push(...(j.data || []));
      if (!(j.data || []).length || page >= (j.total_pages || 1)) break;
    }
    const closed = orders.filter((o) => ![0, 6, 7].includes(n(o.status)));
    const rows = orders.slice(0, 20).map((o) => ({
      id: String(o.display_id ?? o.system_id ?? o.id),
      time: o.inserted_at
        ? new Date(new Date(String(o.inserted_at).replace(' ', 'T') + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(String(o.inserted_at)) ? '' : 'Z')).getTime()).toISOString()
        : null,
      status: n(o.status),
      name: o.bill_full_name || o.shipping_address?.full_name || '',
      province: o.shipping_address?.province_name || '',
      revenue: n(o.total_price_after_sub_discount),
    }));
    return NextResponse.json({
      ok: true,
      fetched: orders.length,
      closed: closed.length,
      revenue: closed.reduce((s, o) => s + n(o.total_price_after_sub_discount), 0),
      rows,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: String(e?.message || e) }, { status: 400 });
  }
}
