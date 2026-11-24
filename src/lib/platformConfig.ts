export type PlatformId = 'facebook' | 'tiktok' | 'youtube';

export interface PlatformMeta {
  id: PlatformId;
  name: string;
  shortName: string;
  subtitle: string;
  logoChar: string;
  primaryColor: string;
  secondaryColor: string;
  pageLabel: string;
  pageEntity: string;
  pagePlural: string;
  dailyLineKey: 'roas' | 'roi' | 'cpv';
  dailyLineLabel: string;
  dailyLineDecimals: number;
}

export const PLATFORM_META: Record<PlatformId, PlatformMeta> = {
  facebook: {
    id: 'facebook',
    name: 'Facebook Ads',
    shortName: 'Facebook',
    subtitle: 'Meta Ads · ROAS & Mess',
    logoChar: 'f',
    primaryColor: '#1877F2',
    secondaryColor: '#93c5fd',
    pageLabel: 'Theo page',
    pageEntity: 'Page',
    pagePlural: 'page',
    dailyLineKey: 'roas',
    dailyLineLabel: 'ROAS',
    dailyLineDecimals: 2,
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok Ads',
    shortName: 'TikTok',
    subtitle: 'TikTok Ads · ROI & Video',
    logoChar: '♪',
    primaryColor: '#fe2c55',
    secondaryColor: '#fda4af',
    pageLabel: 'Theo kênh TikTok',
    pageEntity: 'Kênh TikTok',
    pagePlural: 'kênh TikTok',
    dailyLineKey: 'roi',
    dailyLineLabel: 'ROI (%)',
    dailyLineDecimals: 1,
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube Ads',
    shortName: 'YouTube',
    subtitle: 'Google Video · CPV & Views',
    logoChar: '▶',
    primaryColor: '#dc2626',
    secondaryColor: '#fca5a5',
    pageLabel: 'Theo kênh YouTube',
    pageEntity: 'Kênh YouTube',
    pagePlural: 'kênh YouTube',
    dailyLineKey: 'cpv',
    dailyLineLabel: 'CPV',
    dailyLineDecimals: 0,
  },
};

export function normalizePlatform(raw?: string | null): PlatformId {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'tiktok' || v === 'tt') return 'tiktok';
  if (v === 'youtube' || v === 'yt') return 'youtube';
  return 'facebook';
}
