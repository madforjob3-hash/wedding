'use client';

import type { Review } from '@/types';

interface ReviewSummaryProps {
  review: Review;
}

const SOURCE_ICONS: Record<string, string> = {
  naver: '🟢',
  daum: '🔵',
  directwedding: '💒',
  makemywedding: '💍'
};

const SOURCE_NAMES: Record<string, string> = {
  naver: '네이버',
  daum: '다음',
  directwedding: '다이렉트웨딩',
  makemywedding: '메이크마이웨딩'
};

export default function ReviewSummary({ review }: ReviewSummaryProps) {
  const formatDate = (timestamp: { seconds: number }) => {
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    return `${Math.floor(diffDays / 30)}개월 전`;
  };

  return (
    <a
      href={review.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-rose-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{SOURCE_ICONS[review.source]}</span>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-500">
              {SOURCE_NAMES[review.source]}
            </span>
            <span className="text-xs text-gray-400">
              {formatDate(review.scrapedAt)}
            </span>
          </div>
          
          <p className="text-sm font-medium text-gray-900 mb-2">
            {review.summary}
          </p>
          
          {review.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {review.keywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 bg-rose-50 text-rose-600 rounded-full"
                >
                  #{keyword}
                </span>
              ))}
            </div>
          )}
        </div>

        <svg 
          className="w-5 h-5 text-gray-400 flex-shrink-0"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
          />
        </svg>
      </div>
    </a>
  );
}
