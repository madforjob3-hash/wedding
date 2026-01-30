'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ReviewSummary from '@/components/ReviewSummary';
import type { WeddingHall, Review } from '@/types';
import Link from 'next/link';
import Image from 'next/image';

export default function HallDetailPage({ params }: { params: { id: string } }) {
  const [hall, setHall] = useState<WeddingHall | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  useEffect(() => {
    loadHallData();
  }, [params.id]);

  async function loadHallData() {
    try {
      // 웨딩홀 정보 로드
      const hallDoc = await getDoc(doc(db, 'weddingHalls', params.id));
      if (hallDoc.exists()) {
        setHall({ id: hallDoc.id, ...hallDoc.data() } as WeddingHall);
      }

      // 후기 로드
      const reviewsRef = collection(db, 'reviews');
      const q = query(
        reviewsRef,
        where('hallId', '==', params.id),
        orderBy('scrapedAt', 'desc'),
        firestoreLimit(50)
      );
      
      try {
        const reviewsSnapshot = await getDocs(q);
        const reviewsData = reviewsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            scrapedAt: data.scrapedAt || { seconds: Date.now() / 1000, nanoseconds: 0 }
          };
        }) as Review[];

        setReviews(reviewsData);
      } catch (error) {
        // orderBy 에러 시 기본 쿼리 사용
        console.warn('정렬 쿼리 실패, 기본 쿼리 사용:', error);
        const basicQuery = query(
          reviewsRef,
          where('hallId', '==', params.id),
          firestoreLimit(50)
        );
        const reviewsSnapshot = await getDocs(basicQuery);
        const reviewsData = reviewsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            scrapedAt: data.scrapedAt || { seconds: Date.now() / 1000, nanoseconds: 0 }
          };
        }) as Review[];
        setReviews(reviewsData);
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleScrape() {
    if (!hall) return;
    
    setScraping(true);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hallId: hall.id, hallName: hall.name })
      });

      if (response.ok) {
        // 후기 다시 로드
        await loadHallData();
        alert('후기를 성공적으로 업데이트했습니다!');
      } else {
        alert('후기 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('크롤링 실패:', error);
      alert('후기 업데이트 중 오류가 발생했습니다.');
    } finally {
      setScraping(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-rose-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (!hall) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-600 text-lg">웨딩홀을 찾을 수 없습니다.</p>
        <Link href="/" className="text-rose-600 hover:underline mt-4 inline-block">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 뒤로가기 */}
      <Link href="/" className="inline-flex items-center text-gray-600 hover:text-rose-600 mb-6">
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        목록으로 돌아가기
      </Link>

      {/* 웨딩홀 정보 */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
        <div className="relative h-96">
          {hall.imageUrl ? (
            <Image src={hall.imageUrl} alt={hall.name} fill className="object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-200 text-gray-400">
              이미지 준비 중
            </div>
          )}
        </div>

        <div className="p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{hall.name}</h1>
          
          <div className="grid md:grid-cols-2 gap-4 text-gray-600">
            <p className="flex items-center gap-2">
              <span>📍</span> {hall.address}
            </p>
            <p className="flex items-center gap-2">
              <span>📞</span> {hall.phone}
            </p>
            <p className="flex items-center gap-2">
              <span>👥</span> 최대 {hall.capacity}명
            </p>
            <p className="flex items-center gap-2">
              <span>💰</span> {hall.priceRange}
            </p>
          </div>
        </div>
      </div>

      {/* 후기 업데이트 버튼 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          실시간 후기 <span className="text-rose-600">({reviews.length})</span>
        </h2>
        
        <button
          onClick={handleScrape}
          disabled={scraping}
          className="px-6 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:bg-gray-400 transition-colors"
        >
          {scraping ? '업데이트 중...' : '후기 새로고침'}
        </button>
      </div>

      {/* 후기 목록 */}
      {reviews.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg">
          <p className="text-gray-600 text-lg mb-4">아직 등록된 후기가 없습니다.</p>
          <button
            onClick={handleScrape}
            className="px-6 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600"
          >
            후기 가져오기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review, index) => (
            <div key={review.id}>
              <ReviewSummary review={review} />
              
              {/* 5개당 광고 1개 삽입 */}
              {(index + 1) % 5 === 0 && process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
                <div className="my-6 p-4 bg-gray-100 rounded-lg text-center">
                  <ins
                    className="adsbygoogle"
                    style={{ display: 'block' }}
                    data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
                    data-ad-slot="YOUR_AD_SLOT_ID"
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
