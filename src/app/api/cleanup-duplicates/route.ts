import { NextResponse } from 'next/server';

// API 라우트는 동적 라우트로 처리
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { collection, getDocs, query, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    console.log('🧹 중복 웨딩홀 정리 시작...');

    const hallsRef = collection(db, 'weddingHalls');
    const snapshot = await getDocs(hallsRef);

    if (snapshot.empty) {
      return NextResponse.json({
        message: '정리할 웨딩홀이 없습니다.',
        removed: 0
      });
    }

    // 이름과 주소를 기준으로 그룹화
    const hallsMap = new Map<string, any[]>();
    
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const key = `${data.name}|${data.address}`.toLowerCase().trim();
      
      if (!hallsMap.has(key)) {
        hallsMap.set(key, []);
      }
      
      hallsMap.get(key)!.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || null
      });
    });

    // 중복 찾기 및 삭제
    const batch = writeBatch(db);
    let removedCount = 0;
    const duplicates: any[] = [];

    hallsMap.forEach((halls, key) => {
      if (halls.length > 1) {
        // 생성일이 가장 오래된 것을 제외하고 나머지 삭제
        halls.sort((a, b) => {
          const dateA = a.createdAt || new Date(0);
          const dateB = b.createdAt || new Date(0);
          return dateA.getTime() - dateB.getTime();
        });

        // 첫 번째(가장 오래된 것)는 유지, 나머지 삭제
        const toKeep = halls[0];
        const toRemove = halls.slice(1);

        toRemove.forEach(hall => {
          const hallRef = doc(db, 'weddingHalls', hall.id);
          batch.delete(hallRef);
          removedCount++;
        });

        duplicates.push({
          name: toKeep.name,
          address: toKeep.address,
          kept: toKeep.id,
          removed: toRemove.map(h => h.id)
        });
      }
    });

    // 배치 삭제 실행
    if (removedCount > 0) {
      await batch.commit();
      console.log(`✅ ${removedCount}개 중복 웨딩홀 삭제 완료`);
    } else {
      console.log('✅ 중복 웨딩홀 없음');
    }

    return NextResponse.json({
      message: '중복 웨딩홀 정리 완료',
      removed: removedCount,
      duplicates: duplicates
    });

  } catch (error) {
    console.error('❌ 중복 정리 실패:', error);
    return NextResponse.json(
      { error: '중복 정리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
