import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '웨딩홀 후기 통합검색 | 서울 웨딩홀 실시간 후기 모음',
  description: '서울 강남, 서남권 웨딩홀 후기를 한 곳에서! 네이버, 다음, 웨딩카페 후기를 한눈에 비교하세요.',
  keywords: '웨딩홀 후기, 서울 웨딩홀, 강남 웨딩홀, 예식장 후기, 웨딩홀 추천',
  openGraph: {
    title: '웨딩홀 후기 통합검색',
    description: '서울 웨딩홀 실시간 후기를 한 곳에서 확인하세요',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* Google AdSense */}
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <h1 className="text-2xl font-bold text-rose-600">
                💍 웨딩홀 후기 통합검색
              </h1>
            </div>
          </header>
          
          <main>
            {children}
          </main>

          <footer className="bg-white border-t mt-20">
            <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500 text-sm">
              <p>© 2026 웨딩홀 후기 통합검색. All rights reserved.</p>
              <p className="mt-2">
                본 사이트의 모든 후기는 원본 링크를 통해 확인하실 수 있습니다.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
