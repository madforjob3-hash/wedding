import { NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// 초기 웨딩홀 데이터
const INITIAL_HALLS = [
  // 강남권
  {
    name: '그랜드 인터컨티넨탈 서울 파르나스',
    region: 'gangnam',
    address: '서울 강남구 테헤란로 521',
    phone: '02-555-5656',
    imageUrl: '',
    capacity: 500,
    priceRange: '식대 15만원~'
  },
  {
    name: '쉐라톤 서울 팔래스 강남',
    region: 'gangnam',
    address: '서울 서초구 팔래스로 160',
    phone: '02-2299-8888',
    imageUrl: '',
    capacity: 600,
    priceRange: '식대 12만원~'
  },
  {
    name: '노보텔 앰배서더 강남',
    region: 'gangnam',
    address: '서울 강남구 언주로 567',
    phone: '02-567-1101',
    imageUrl: '',
    capacity: 400,
    priceRange: '식대 10만원~'
  },
  {
    name: '리버사이드 호텔',
    region: 'gangnam',
    address: '서울 서초구 잠원동 19-3',
    phone: '02-3463-1234',
    imageUrl: '',
    capacity: 300,
    priceRange: '식대 8만원~'
  },
  {
    name: '더 그레이스 청담',
    region: 'gangnam',
    address: '서울 강남구 선릉로 831',
    phone: '02-6207-5000',
    imageUrl: '',
    capacity: 200,
    priceRange: '식대 12만원~'
  },

  // 서남권
  {
    name: '쉐라톤 서울 디큐브시티',
    region: 'seonam',
    address: '서울 구로구 경인로 662',
    phone: '02-2211-1700',
    imageUrl: '',
    capacity: 700,
    priceRange: '식대 10만원~'
  },
  {
    name: '콘래드 서울',
    region: 'seonam',
    address: '서울 영등포구 국제금융로 10',
    phone: '02-6137-7000',
    imageUrl: '',
    capacity: 500,
    priceRange: '식대 15만원~'
  },
  {
    name: '페어몬트 앰배서더 서울',
    region: 'seonam',
    address: '서울 영등포구 여의대로 108',
    phone: '02-3467-8888',
    imageUrl: '',
    capacity: 400,
    priceRange: '식대 13만원~'
  },
  {
    name: '밀레니엄 힐튼 서울',
    region: 'seonam',
    address: '서울 중구 남대문로 50',
    phone: '02-317-3000',
    imageUrl: '',
    capacity: 600,
    priceRange: '식대 11만원~'
  },
  {
    name: '임페리얼 팰리스 서울',
    region: 'seonam',
    address: '서울 강남구 논현동 640-7',
    phone: '02-3440-8000',
    imageUrl: '',
    capacity: 800,
    priceRange: '식대 9만원~'
  }
];

export async function GET() {
  try {
    const hallsRef = collection(db, 'weddingHalls');
    let addedCount = 0;

    for (const hall of INITIAL_HALLS) {
      await addDoc(hallsRef, {
        ...hall,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      addedCount++;
    }

    return NextResponse.json({
      message: '웨딩홀 데이터 초기화 완료',
      count: addedCount
    });

  } catch (error) {
    console.error('초기화 실패:', error);
    return NextResponse.json(
      { error: '초기화 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
