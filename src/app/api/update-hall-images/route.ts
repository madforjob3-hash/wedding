import { NextResponse } from 'next/server';

// API 라우트는 동적 라우트로 처리
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getWeddingHallImage } from '@/lib/imageSearch';

export async function GET() {
  try {
    console.log('🖼️  웨딩홀 이미지 업데이트 시작...');

    const hallsRef = collection(db, 'weddingHalls');
    const q = query(hallsRef, orderBy('name'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json(
        { error: '등록된 웨딩홀이 없습니다.' },
        { status: 404 }
      );
    }

    const results: any[] = [];
    let updatedCount = 0;

    for (const docSnap of snapshot.docs) {
      const hall = docSnap.data();
      const hallId = docSnap.id;

      // 이미 이미지가 있고 Unsplash가 아닌 경우 스킵
      if (hall.imageUrl && !hall.imageUrl.includes('unsplash.com')) {
        console.log(`⏭️  [${hall.name}] 이미지 이미 존재, 스킵`);
        results.push({
          hallName: hall.name,
          status: 'skipped',
          reason: '이미지 이미 존재'
        });
        continue;
      }

      try {
        console.log(`🔍 [${hall.name}] 이미지 검색 중...`);
        
        // 이미지 검색 (우선순위: Custom Search > Maps > Unsplash)
        const imageUrl = await getWeddingHallImage(hall.name, hall.address);

        if (imageUrl) {
          // Firestore 업데이트
          const hallRef = doc(db, 'weddingHalls', hallId);
          await updateDoc(hallRef, {
            imageUrl,
            updatedAt: new Date()
          });

          updatedCount++;
          console.log(`✅ [${hall.name}] 이미지 업데이트 완료: ${imageUrl.substring(0, 50)}...`);

          results.push({
            hallName: hall.name,
            status: 'success',
            imageUrl: imageUrl.substring(0, 100) // 로그용 일부만
          });

          // Rate limiting (API 호출 제한 방지)
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log(`⚠️  [${hall.name}] 이미지를 찾을 수 없음`);
          results.push({
            hallName: hall.name,
            status: 'failed',
            reason: '이미지를 찾을 수 없음'
          });
        }
      } catch (error) {
        console.error(`❌ [${hall.name}] 이미지 업데이트 실패:`, error);
        results.push({
          hallName: hall.name,
          status: 'error',
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }

    console.log(`\n🎉 이미지 업데이트 완료: ${updatedCount}개 업데이트`);

    return NextResponse.json({
      message: '웨딩홀 이미지 업데이트 완료',
      totalHalls: snapshot.size,
      updated: updatedCount,
      results
    });

  } catch (error) {
    console.error('❌ 이미지 업데이트 실패:', error);
    return NextResponse.json(
      { error: '이미지 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
