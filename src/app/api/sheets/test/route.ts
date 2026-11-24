import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceInfo } from '@/lib/engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { sheetId, adsTab, saleTab } = await req.json();
  if (!sheetId) return NextResponse.json({ ok: false, message: 'Vui lòng nhập Link hoặc ID Google Sheet' }, { status: 400 });
  const info = await getWorkspaceInfo(sheetId, adsTab || 'BC_Chung', saleTab || 'BC_Sale', true);
  if (info.error) {
    return NextResponse.json({ ok: false, message: info.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    adsRows: info.adsRows,
    saleRows: info.saleRows,
    companies: info.companies,
    platforms: info.platforms,
    minDate: info.minDate,
    maxDate: info.maxDate,
  });
}
