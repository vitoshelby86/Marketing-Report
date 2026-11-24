import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceInfo } from '@/lib/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const info = await getWorkspaceInfo(p.get('sheetId'), p.get('adsTab'), p.get('saleTab'), p.get('refresh') === '1');
  return NextResponse.json(info);
}
