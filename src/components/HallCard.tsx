'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { WeddingHall } from '@/types';

interface HallCardProps {
  hall: WeddingHall;
  reviewCount?: number;
}

const REGION_NAMES: Record<string, string> = {
  gangnam: '강남권',
  seonam: '서남권',
  dongnam: '동남권',
  bukbu: '북부권',
  etc: '기타'
};

export default function HallCard({ hall, reviewCount = 0 }: HallCardProps) {
  return (
    <Link 
      href={`/halls/${hall.id}`}
      className="block bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden"
    >
      <div className="relative h-48 bg-gray-200">
        {hall.imageUrl ? (
          <Image
            src={hall.imageUrl}
            alt={hall.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            이미지 준비 중
          </div>
        )}
        <div className="absolute top-2 right-2 bg-rose-500 text-white px-3 py-1 rounded-full text-sm font-medium">
          {REGION_NAMES[hall.region]}
        </div>
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
