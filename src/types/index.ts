// Firebase Timestamp 타입
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

// 웨딩홀 기본 정보
export interface WeddingHall {
  id: string;
  name: string;
  region: 'gangnam' | 'seonam' | 'dongnam' | 'bukbu' | 'etc';
  address: string;
  phone: string;
  imageUrl: string;
  capacity: number;
  priceRange: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  reviewCount?: number; // 후기 개수 (선택적)
}

// 크롤링된 후기
export interface Review {
  id: string;
  hallId: string;
  source: 'naver' | 'daum' | 'directwedding' | 'makemywedding';
  sourceUrl: string;
  originalTitle: string;
  summary: string; // AI 생성 한줄 요약
  scrapedAt: FirestoreTimestamp;
  rating?: number;
  keywords: string[];
}

// 크롤링 로그
export interface ScrapeLog {
  id: string;
  hallId: string;
  source: string;
  status: 'success' | 'failed';
  itemsFound: number;
  executedAt: FirestoreTimestamp;
  error?: string;
}

// 크롤링 소스 설정
export interface ScraperSource {
  searchUrl: (hallName: string) => string;
  selector: string;
}
