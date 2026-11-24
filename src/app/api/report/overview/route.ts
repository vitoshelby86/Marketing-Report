import { NextRequest, NextResponse } from 'next/server';
import { buildOverview } from '@/lib/engine';
import { normalizePlatform } from '@/lib/platformConfig';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const data = await buildOverview({
    company: p.get('company') || 'Santony',
    platform: normalizePlatform(p.get('platform')),
    from: p.get('from') || '2026-04-01',
    to: p.get('to') || '2026-11-24',
    cmp: p.get('cmp') || 'prev',
    sheetId: p.get('sheetId'),
    adsTab: p.get('adsTab'),
    saleTab: p.get('saleTab'),
    refresh: p.get('refresh') === '1',
  });
  return NextResponse.json(data);
}
