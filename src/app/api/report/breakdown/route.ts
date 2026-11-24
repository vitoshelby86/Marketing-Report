import { NextRequest, NextResponse } from 'next/server';
import { buildBreakdownReport } from '@/lib/engine';
import { normalizePlatform } from '@/lib/platformConfig';

export const dynamic = 'force-dynamic';
const DIMS = ['account', 'media', 'product', 'creative', 'region', 'gender', 'age', 'category', 'page', 'campaign', 'format', 'source', 'device', 'hour'];

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const dim = p.get('dim') || 'region';
  if (!DIMS.includes(dim)) return NextResponse.json({ error: 'dim không hợp lệ' }, { status: 400 });

  const data = await buildBreakdownReport({
    dim,
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
