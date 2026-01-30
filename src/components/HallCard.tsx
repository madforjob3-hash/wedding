'use client';

import Link from 'next/link';
import type { WeddingHall, Review } from '@/types';

interface HallCardProps {
  hall: WeddingHall;
  reviewCount?: number;
  recentReviews?: Review[];
}

const REGION_NAMES: Record<string, string> = {
  gangnam: '강남권',
  seonam: '서남권',
  dongnam: '동남권',
  bukbu: '북부권',
  etc: '기타'
};

export default function HallCard({ hall, reviewCount = 0, recentReviews = [] }: HallCardProps) {
  // 최신 후기 3개만 표시
  const displayReviews = recentReviews.slice(0, 3);

  return (
    <Link 
      href={`/halls/${hall.id}`}
      className="block bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden"
    >
      {/* 후기 헤드라인 영역 */}
      <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 p-4 min-h-[180px]">
        <div className="absolute top-2 right-2 bg-rose-500 text-white px-3 py-1 rounded-full text-sm font-medium z-10">
          {REGION_NAMES[hall.region]}
        </div>
        
        {displayReviews.length > 0 ? (
          <div className="space-y-3 mt-2">
            {displayReviews.map((review, index) => (
              <div 
                key={review.id || index}
                className="flex items-start gap-2 group"
              >
                <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-rose-400 mt-2"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-rose-600 transition-colors">
                    {review.summary || review.originalTitle}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {review.source === 'naver' ? '네이버' : review.source === 'daum' ? '다음' : review.source}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            후기 준비 중
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{hall.name}</h3>
        
        <div className="space-y-1 text-sm text-gray-600 mb-3">
          <p className="flex items-center gap-2">
            <span className="text-gray-400">📍</span>
            {hall.address}
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400">👥</span>
            최대 {hall.capacity}명
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400">💰</span>
            {hall.priceRange}
          </p>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            후기 {reviewCount}개
          </span>
          <span className="text-sm text-rose-600 font-medium">
            상세보기 →
          </span>
        </div>
      </div>
    </Link>
  );
}
