import { NextResponse } from 'next/server';

// API 라우트는 동적 라우트로 처리
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// 초기 웨딩홀 데이터 (유명 웨딩홀)
const INITIAL_HALLS = [
  // 강남권
  {
    name: '그랜드 인터컨티넨탈 서울 파르나스',
    region: 'gangnam',
    address: '서울 강남구 테헤란로 521',
    phone: '02-555-5656',
    imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
    capacity: 500,
    priceRange: '식대 15만원~'
  },
  {
    name: '쉐라톤 서울 팔래스 강남',
    region: 'gangnam',
    address: '서울 서초구 팔래스로 160',
    phone: '02-2299-8888',
    imageUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800',
    capacity: 600,
    priceRange: '식대 12만원~'
  },
  {
    name: '노보텔 앰배서더 강남',
    region: 'gangnam',
    address: '서울 강남구 언주로 567',
    phone: '02-567-1101',
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    capacity: 400,
    priceRange: '식대 10만원~'
  },
  {
    name: '리버사이드 호텔',
    region: 'gangnam',
    address: '서울 서초구 잠원동 19-3',
    phone: '02-3463-1234',
    imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800',
    capacity: 300,
    priceRange: '식대 8만원~'
  },
  {
    name: '더 그레이스 청담',
    region: 'gangnam',
    address: '서울 강남구 선릉로 831',
    phone: '02-6207-5000',
    imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
    capacity: 200,
    priceRange: '식대 12만원~'
  },
  {
    name: '코엑스 컨벤션센터',
    region: 'gangnam',
    address: '서울 강남구 영동대로 513',
    phone: '02-6000-0000',
    imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
    capacity: 1000,
    priceRange: '식대 10만원~'
  },
  {
    name: '더컨벤션웨딩',
    region: 'gangnam',
    address: '서울 강남구 테헤란로 152',
    phone: '02-6000-1000',
    imageUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800',
    capacity: 800,
    priceRange: '식대 9만원~'
  },

  // 서남권
  {
    name: '쉐라톤 서울 디큐브시티',
    region: 'seonam',
    address: '서울 구로구 경인로 662',
    phone: '02-2211-1700',
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    capacity: 700,
    priceRange: '식대 10만원~'
  },
  {
    name: '콘래드 서울',
    region: 'seonam',
    address: '서울 영등포구 국제금융로 10',
    phone: '02-6137-7000',
    imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800',
    capacity: 500,
    priceRange: '식대 15만원~'
  },
  {
    name: '페어몬트 앰배서더 서울',
    region: 'seonam',
    address: '서울 영등포구 여의대로 108',
    phone: '02-3467-8888',
    imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
    capacity: 400,
    priceRange: '식대 13만원~'
  },
  {
    name: '밀레니엄 힐튼 서울',
    region: 'seonam',
    address: '서울 중구 남대문로 50',
    phone: '02-317-3000',
    imageUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800',
    capacity: 600,
    priceRange: '식대 11만원~'
  },
  {
    name: '롯데호텔 월드',
    region: 'seonam',
    address: '서울 송파구 올림픽로 300',
    phone: '02-419-7000',
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    capacity: 1000,
    priceRange: '식대 12만원~'
  },
  {
    name: '그랜드 힐튼 서울',
    region: 'seonam',
    address: '서울 용산구 한강대로 366',
    phone: '02-2015-8000',
    imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800',
    capacity: 600,
    priceRange: '식대 11만원~'
  },

  // 동남권
  {
    name: '잠실 롯데월드타워',
    region: 'dongnam',
    address: '서울 송파구 올림픽로 300',
    phone: '02-3213-1000',
    imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
    capacity: 800,
    priceRange: '식대 13만원~'
  },
  {
    name: '잠실 센트럴파크',
    region: 'dongnam',
    address: '서울 송파구 올림픽로 240',
    phone: '02-2143-7000',
    imageUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800',
    capacity: 500,
    priceRange: '식대 10만원~'
  },
  {
    name: '올림픽파크텔',
    region: 'dongnam',
    address: '서울 송파구 올림픽로 424',
    phone: '02-410-2114',
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    capacity: 400,
    priceRange: '식대 9만원~'
  },
  {
    name: '강동 프리미어웨딩',
    region: 'dongnam',
    address: '서울 강동구 천호대로 1017',
    phone: '02-481-7000',
    imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800',
    capacity: 300,
    priceRange: '식대 8만원~'
  },
  {
    name: '송파 웨딩컨벤션',
    region: 'dongnam',
    address: '서울 송파구 올림픽로 300',
    phone: '02-2143-8000',
    imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
    capacity: 600,
    priceRange: '식대 11만원~'
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
