import { NextRequest, NextResponse } from 'next/server';

// API 라우트는 동적 라우트로 처리
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { scrapeAllSources } from '@/lib/scraper';
import { batchSummarizeReviews } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const { hallId, hallName } = await request.json();

    if (!hallId || !hallName) {
      return NextResponse.json(
        { error: 'hallId와 hallName이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`🔍 크롤링 시작: ${hallName}`);

    // 1. 모든 소스에서 후기 크롤링
    const scrapedReviews = await scrapeAllSources(hallName);
    console.log(`📥 ${scrapedReviews.length}개 후기 발견`);

    if (scrapedReviews.length === 0) {
      return NextResponse.json({
        message: '새로운 후기가 없습니다.',
        newReviews: 0
      });
    }

    // 2. 중복 체크
    const reviewsRef = collection(db, 'reviews');
    const existingReviewsQuery = query(
      reviewsRef,
      where('hallId', '==', hallId)
    );
    const existingSnapshot = await getDocs(existingReviewsQuery);
    const existingUrls = new Set(
      existingSnapshot.docs.map(doc => doc.data().sourceUrl)
    );

    const newReviews = scrapedReviews.filter(
      review => !existingUrls.has(review.url)
    );

    console.log(`🆕 ${newReviews.length}개 새로운 후기`);

    if (newReviews.length === 0) {
      return NextResponse.json({
        message: '새로운 후기가 없습니다.',
        newReviews: 0
      });
    }

    // 3. AI 요약 생성 (배치 처리)
    console.log('🤖 AI 요약 생성 중...');
    const summaries = await batchSummarizeReviews(
      newReviews.map(r => r.title)
    );

    // 4. Firestore에 저장
    console.log('💾 Firestore에 저장 중...');
    let savedCount = 0;

    for (let i = 0; i < newReviews.length; i++) {
      const review = newReviews[i];
      const summary = summaries[i] || review.title.substring(0, 30);

      try {
        await addDoc(reviewsRef, {
          hallId,
          source: review.source,
          sourceUrl: review.url,
          originalTitle: review.title,
          summary,
          keywords: [], // 추후 키워드 추출 기능 추가
          scrapedAt: serverTimestamp()
        });
        savedCount++;
      } catch (error) {
        console.error('후기 저장 실패:', error);
      }
    }

    // 5. 크롤링 로그 저장
    const logsRef = collection(db, 'scrapeLogs');
    await addDoc(logsRef, {
      hallId,
      source: 'all',
      status: 'success',
      itemsFound: newReviews.length,
      executedAt: serverTimestamp()
    });

    console.log(`✅ ${savedCount}개 후기 저장 완료`);

    return NextResponse.json({
      message: '후기 업데이트 완료',
      newReviews: savedCount
    });

  } catch (error) {
    console.error('크롤링 실패:', error);
    
    // 에러 로그 저장
    try {
      const logsRef = collection(db, 'scrapeLogs');
      await addDoc(logsRef, {
        hallId: (await request.json()).hallId,
        source: 'all',
        status: 'failed',
        itemsFound: 0,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        executedAt: serverTimestamp()
      });
    } catch (logError) {
      console.error('로그 저장 실패:', logError);
    }

    return NextResponse.json(
      { error: '크롤링 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
