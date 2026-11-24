import { NextRequest, NextResponse } from 'next/server';
import { buildAdsReport, buildGrowthReport } from '@/lib/engine';
import { normalizePlatform } from '@/lib/platformConfig';

export const dynamic = 'force-dynamic';
const DIMS = ['account', 'media', 'product', 'creative', 'page', 'campaign', 'format', 'source', 'ad'];

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const company = p.get('company') || 'Santony';
  const platform = normalizePlatform(p.get('platform'));
  const sheetId = p.get('sheetId');
  const adsTab = p.get('adsTab');
  const saleTab = p.get('saleTab');
  const refresh = p.get('refresh') === '1';

  if (p.get('growth')) {
    const g = await buildGrowthReport({ company, platform, sheetId, adsTab, saleTab, refresh });
    return NextResponse.json(g);
  }

  const dim = p.get('dim') || 'page';
  if (!DIMS.includes(dim)) return NextResponse.json({ error: 'dim không hợp lệ' }, { status: 400 });

  const data = await buildAdsReport({
    dim,
    company,
    platform,
    from: p.get('from') || '2026-04-01',
    to: p.get('to') || '2026-11-24',
    cmp: p.get('cmp') || '',
    sheetId,
    adsTab,
    saleTab,
    refresh,
  });
  return NextResponse.json(data);
}
