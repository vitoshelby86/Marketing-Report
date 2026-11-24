import { NextRequest, NextResponse } from 'next/server';
import { buildSalesReport } from '@/lib/engine';
import { normalizePlatform } from '@/lib/platformConfig';

export const dynamic = 'force-dynamic';
const VIEWS = ['overview', 'product', 'province', 'customer'];

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const view = p.get('view') || 'overview';
  if (!VIEWS.includes(view)) return NextResponse.json({ error: 'view không hợp lệ' }, { status: 400 });

  const data = await buildSalesReport({
    view,
    company: p.get('company') || 'Santony',
    platform: normalizePlatform(p.get('platform')),
    from: p.get('from') || '2026-04-01',
    to: p.get('to') || '2026-11-24',
    cmp: p.get('cmp') || '',
    sheetId: p.get('sheetId'),
    adsTab: p.get('adsTab'),
    saleTab: p.get('saleTab'),
    refresh: p.get('refresh') === '1',
  });
  return NextResponse.json(data);
}
