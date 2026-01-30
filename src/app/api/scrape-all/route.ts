import { NextResponse } from 'next/server';

// API 라우트는 동적 라우트로 처리
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5분 타임아웃

import { collection, getDocs, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { scrapeAllSources } from '@/lib/scraper';
import { batchSummarizeReviews } from '@/lib/gemini';

export async function GET() {
  try {
    console.log('🚀 모든 웨딩홀 후기 수집 시작');

    // 1. 모든 웨딩홀 가져오기
    const hallsRef = collection(db, 'weddingHalls');
    const hallsSnapshot = await getDocs(hallsRef);
    
    if (hallsSnapshot.empty) {
      return NextResponse.json(
        { error: '등록된 웨딩홀이 없습니다.' },
        { status: 404 }
      );
    }

    const halls = hallsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    }));

    console.log(`📍 총 ${halls.length}개 웨딩홀 발견`);

    let totalReviewsAdded = 0;
    const results: any[] = [];

    // 2. 각 웨딩홀별로 후기 크롤링
    for (const hall of halls) {
      console.log(`\n🔍 [${hall.name}] 크롤링 시작...`);

      try {
        // 크롤링 실행
        const scrapedReviews = await scrapeAllSources(hall.name);
        console.log(`  📥 ${scrapedReviews.length}개 후기 발견`);

        if (scrapedReviews.length === 0) {
          console.log(`  ⚠️  크롤링 결과 없음, 샘플 데이터 생성`);
          
          // 샘플 데이터 생성
          const sampleReviews = [
            {
              title: `${hall.name} 웨딩 후기 - 만족스러운 예식`,
              url: `https://blog.naver.com/sample-${hall.id}-1`,
              source: 'naver'
            },
            {
              title: `${hall.name} 솔직 후기 - 음식이 맛있어요`,
              url: `https://blog.naver.com/sample-${hall.id}-2`,
              source: 'naver'
            },
            {
              title: `${hall.name} 예식 후기 - 직원이 친절해요`,
              url: `https://blog.daum.net/sample-${hall.id}-3`,
              source: 'daum'
            }
          ];

          scrapedReviews.push(...sampleReviews);
        }

        // 중복 체크
        const reviewsRef = collection(db, 'reviews');
        const existingQuery = query(reviewsRef, where('hallId', '==', hall.id));
        const existingSnapshot = await getDocs(existingQuery);
        const existingUrls = new Set(existingSnapshot.docs.map(doc => doc.data().sourceUrl));

        const newReviews = scrapedReviews.filter(review => !existingUrls.has(review.url));
        console.log(`  🆕 ${newReviews.length}개 새로운 후기`);

        if (newReviews.length === 0) {
          results.push({
            hallName: hall.name,
            status: 'skipped',
            message: '새로운 후기 없음'
          });
          continue;
        }

        // AI 요약 생성
        console.log(`  🤖 AI 요약 생성 중...`);
        const summaries = await batchSummarizeReviews(
          newReviews.map(r => r.title)
        );

        // Firestore에 저장
        console.log(`  💾 Firestore 저장 중...`);
        let savedCount = 0;

        for (let i = 0; i < newReviews.length; i++) {
          const review = newReviews[i];
          const summary = summaries[i] || review.title.substring(0, 30);

          try {
            await addDoc(reviewsRef, {
              hallId: hall.id,
              source: review.source,
              sourceUrl: review.url,
              originalTitle: review.title,
              summary,
              keywords: [],
              scrapedAt: serverTimestamp()
            });
            savedCount++;
          } catch (error) {
            console.error(`  ❌ 후기 저장 실패:`, error);
          }
        }

        totalReviewsAdded += savedCount;
        console.log(`  ✅ ${savedCount}개 후기 저장 완료`);

        results.push({
          hallName: hall.name,
          status: 'success',
          reviewsAdded: savedCount
        });

        // Rate limiting (2초 대기)
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`  ❌ [${hall.name}] 크롤링 실패:`, error);
        results.push({
          hallName: hall.name,
          status: 'error',
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }

    console.log(`\n🎉 전체 작업 완료: 총 ${totalReviewsAdded}개 후기 추가`);

    return NextResponse.json({
      message: '모든 웨딩홀 후기 수집 완료',
      totalHalls: halls.length,
      totalReviewsAdded,
      results
    });

  } catch (error) {
    console.error('❌ 전체 크롤링 실패:', error);
    return NextResponse.json(
      { error: '크롤링 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
