'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import HallCard from '@/components/HallCard';
import SearchBar from '@/components/SearchBar';
import RegionFilter from '@/components/RegionFilter';
import type { WeddingHall } from '@/types';

export default function HomePage() {
  const [halls, setHalls] = useState<WeddingHall[]>([]);
  const [filteredHalls, setFilteredHalls] = useState<WeddingHall[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // 웨딩홀 목록 로드
  useEffect(() => {
    loadHalls();
  }, []);

  // 필터링
  useEffect(() => {
    let filtered = halls;

    // 지역 필터
    if (selectedRegion !== 'all') {
      filtered = filtered.filter(hall => hall.region === selectedRegion);
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(hall =>
        hall.name.toLowerCase().includes(query) ||
        hall.address.toLowerCase().includes(query)
      );
    }

    setFilteredHalls(filtered);
  }, [halls, selectedRegion, searchQuery]);

  async function loadHalls() {
    try {
      const hallsRef = collection(db, 'weddingHalls');
      const q = query(hallsRef, orderBy('name'));
      const snapshot = await getDocs(q);
      
      const hallsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WeddingHall[];

      // 데이터가 없으면 초기화 API 호출
      if (hallsData.length === 0) {
        console.log('웨딩홀 데이터가 없습니다. 초기화 중...');
        try {
          const initResponse = await fetch('/api/init-halls');
          if (initResponse.ok) {
            // 다시 로드
            const newSnapshot = await getDocs(q);
            const newHallsData = newSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as WeddingHall[];
            setHalls(newHallsData);
            setFilteredHalls(newHallsData);
          }
        } catch (initError) {
          console.error('초기화 실패:', initError);
        }
      } else {
        setHalls(hallsData);
        setFilteredHalls(hallsData);
      }
    } catch (error) {
      console.error('웨딩홀 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 검색 영역 */}
      <div className="mb-12">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            서울 웨딩홀 후기를 한 곳에서
          </h2>
          <p className="text-lg text-gray-600">
            네이버, 다음 등 여러 사이트의 후기를 실시간으로 모아봅니다
          </p>
        </div>
        
        <SearchBar onSearch={setSearchQuery} />
      </div>

      {/* 지역 필터 */}
      <div className="mb-8">
        <RegionFilter 
          selectedRegion={selectedRegion}
          onRegionChange={setSelectedRegion}
        />
      </div>

      {/* 웨딩홀 목록 */}
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-rose-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">웨딩홀 정보를 불러오는 중...</p>
        </div>
      ) : filteredHalls.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-600 text-lg">
            {searchQuery ? '검색 결과가 없습니다.' : '등록된 웨딩홀이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHalls.map((hall, index) => (
            <div key={hall.id}>
              <HallCard hall={hall} />
              
              {/* 4개당 광고 1개 삽입 */}
              {(index + 1) % 4 === 0 && process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
                <div className="my-6 p-4 bg-gray-100 rounded-lg text-center text-gray-500 text-sm">
                  <ins
                    className="adsbygoogle"
                    style={{ display: 'block' }}
                    data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
                    data-ad-slot="YOUR_AD_SLOT_ID"
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                  />
                  <script
                    dangerouslySetInnerHTML={{
                      __html: '(adsbygoogle = window.adsbygoogle || []).push({});'
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 하단 광고 */}
      {process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID && (
        <div className="mt-12 p-4 bg-gray-100 rounded-lg text-center">
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID}
            data-ad-slot="YOUR_AD_SLOT_ID"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
          <script
            dangerouslySetInnerHTML={{
              __html: '(adsbygoogle = window.adsbygoogle || []).push({});'
            }}
          />
        </div>
      )}
    </div>
  );
}
