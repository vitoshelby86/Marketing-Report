'use client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PLATFORM_META, PlatformId, PlatformMeta, normalizePlatform } from './platformConfig';

interface ReportContextValue {
  company: string;
  setCompany: (c: string) => void;
  companies: string[];
  platform: PlatformId;
  setPlatform: (p: PlatformId) => void;
  platformMeta: PlatformMeta;
  sheetId: string;
  adsTab: string;
  saleTab: string;
  dataSource: 'sheet' | 'demo';
  dateSpan: string;
  rowStats: string;
  connectSheet: (urlOrId: string, adsTabName?: string, saleTabName?: string) => void;
  disconnectSheet: () => void;
  refreshNonce: number;
  triggerRefresh: () => void;
  buildApiQuery: (extra?: Record<string, string>) => string;
}

const ReportContext = createContext<ReportContextValue | null>(null);

const DEFAULT_SHEET_ID = '1LtTZD65CJfu_heFvZtVn7JtL7DRa1Vd6Giche0hhI3M';

export function extractSheetId(input: string): string {
  const s = String(input || '').trim();
  if (!s) return '';
  const m = s.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  return '';
}

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();

  const platform = normalizePlatform(sp.get('platform'));
  const urlCompany = sp.get('company') || '';

  const [companies, setCompanies] = useState<string[]>(['Santony']);
  const [sheetId, setSheetId] = useState<string>(DEFAULT_SHEET_ID);
  const [adsTab, setAdsTab] = useState<string>('BC_Chung');
  const [saleTab, setSaleTab] = useState<string>('BC_Sale');
  const [dataSource, setDataSource] = useState<'sheet' | 'demo'>('sheet');
  const [dateSpan, setDateSpan] = useState<string>('');
  const [rowStats, setRowStats] = useState<string>('');
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  useEffect(() => {
    try {
      const savedId = localStorage.getItem('report_mkt_sheet_id');
      const savedAds = localStorage.getItem('report_mkt_ads_tab');
      const savedSale = localStorage.getItem('report_mkt_sale_tab');
      if (savedId !== null) setSheetId(savedId);
      if (savedAds) setAdsTab(savedAds);
      if (savedSale) setSaleTab(savedSale);
    } catch {}
  }, []);

  useEffect(() => {
    document.body.dataset.platform = platform;
  }, [platform]);

  const setParam = useCallback(
    (key: string, val: string) => {
      const next = new URLSearchParams(sp.toString());
      if (!val) next.delete(key);
      else next.set(key, val);
      router.replace(`${path}?${next.toString()}`, { scroll: false });
    },
    [sp, router, path]
  );

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams();
    if (sheetId) qs.set('sheetId', sheetId);
    if (adsTab) qs.set('adsTab', adsTab);
    if (saleTab) qs.set('saleTab', saleTab);
    if (refreshNonce > 0) qs.set('refresh', '1');

    fetch(`/api/companies?${qs.toString()}`)
      .then((r) => r.json())
      .then((info) => {
        if (!alive) return;
        if (Array.isArray(info.companies) && info.companies.length > 0) {
          setCompanies(info.companies);
          if (!urlCompany || !info.companies.includes(urlCompany)) {
            setParam('company', info.companies[0]);
          }
        }
        setDataSource(info.source === 'sheet' ? 'sheet' : 'demo');
        if (info.minDate && info.maxDate) {
          setDateSpan(`${info.minDate} → ${info.maxDate}`);
        }
        if (info.adsRows != null || info.saleRows != null) {
          setRowStats(`${info.adsRows || 0} dòng QC · ${info.saleRows || 0} đơn`);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sheetId, adsTab, saleTab, refreshNonce]);

  const company = urlCompany || companies[0] || 'Santony';
  const setCompany = (c: string) => setParam('company', c);
  const setPlatform = (p: PlatformId) => setParam('platform', p);

  const connectSheet = (urlOrId: string, adsTabName = 'BC_Chung', saleTabName = 'BC_Sale') => {
    const id = extractSheetId(urlOrId);
    const t1 = adsTabName.trim() || 'BC_Chung';
    const t2 = saleTabName.trim() || 'BC_Sale';
    setSheetId(id);
    setAdsTab(t1);
    setSaleTab(t2);
    try {
      localStorage.setItem('report_mkt_sheet_id', id);
      localStorage.setItem('report_mkt_ads_tab', t1);
      localStorage.setItem('report_mkt_sale_tab', t2);
    } catch {}
    setRefreshNonce((n) => n + 1);
  };

  const disconnectSheet = () => {
    setSheetId('');
    setDataSource('demo');
    try {
      localStorage.setItem('report_mkt_sheet_id', '');
    } catch {}
    setRefreshNonce((n) => n + 1);
  };

  const triggerRefresh = () => setRefreshNonce((n) => n + 1);

  const buildApiQuery = useCallback(
    (extra: Record<string, string> = {}) => {
      const q = new URLSearchParams();
      q.set('company', company);
      q.set('platform', platform);
      if (sheetId) q.set('sheetId', sheetId);
      if (adsTab) q.set('adsTab', adsTab);
      if (saleTab) q.set('saleTab', saleTab);
      if (refreshNonce > 0) q.set('refresh', '1');
      Object.entries(extra).forEach(([k, v]) => {
        if (v != null && v !== '') q.set(k, v);
      });
      return q.toString();
    },
    [company, platform, sheetId, adsTab, saleTab, refreshNonce]
  );

  return (
    <ReportContext.Provider
      value={{
        company,
        setCompany,
        companies,
        platform,
        setPlatform,
        platformMeta: PLATFORM_META[platform],
        sheetId,
        adsTab,
        saleTab,
        dataSource,
        dateSpan,
        rowStats,
        connectSheet,
        disconnectSheet,
        refreshNonce,
        triggerRefresh,
        buildApiQuery,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
}

export function useReportContext() {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error('useReportContext must be used inside ReportProvider');
  return ctx;
}
