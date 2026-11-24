import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Be_Vietnam_Pro } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import { ReportProvider } from '@/lib/context';
import './globals.css';

const font = Be_Vietnam_Pro({ subsets: ['vietnamese', 'latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Report MKT · Đa Nền Tảng & Đa Công Ty',
  description: 'Dashboard báo cáo quảng cáo Facebook, TikTok, YouTube & bán hàng kết nối Google Sheets',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={font.className} data-platform="facebook">
        <Suspense fallback={null}>
          <ReportProvider>
            <div className="shell">
              <Sidebar />
              <main>{children}</main>
            </div>
          </ReportProvider>
        </Suspense>
      </body>
    </html>
  );
}
