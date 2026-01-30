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
  const [scrapingAll, setScrapingAll] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<string>('');
  const [cleaningUp, setCleaningUp] = useState(false);

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

  async function handleScrapeAll() {
    if (!confirm('모든 웨딩홀의 후기를 수집하시겠습니까? (2-5분 소요)')) {
      return;
    }

    setScrapingAll(true);
    setScrapeProgress('후기 수집을 시작합니다...');

    try {
      const response = await fetch('/api/scrape-all');
      const data = await response.json();

      if (response.ok) {
        setScrapeProgress(`✅ 완료! ${data.totalReviewsAdded}개 후기가 추가되었습니다.`);
        
        // 2초 후 자동 새로고침
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setScrapeProgress(`❌ 오류: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('후기 수집 실패:', error);
      setScrapeProgress('❌ 네트워크 오류가 발생했습니다.');
    } finally {
      setTimeout(() => {
        setScrapingAll(false);
        setScrapeProgress('');
      }, 3000);
    }
  }

  async function handleCleanupDuplicates() {
    if (!confirm('중복된 웨딩홀을 정리하시겠습니까?')) {
      return;
    }

    setCleaningUp(true);
    setScrapeProgress('중복 웨딩홀을 정리하는 중...');

    try {
      const response = await fetch('/api/cleanup-duplicates');
      const data = await response.json();

      if (response.ok) {
        setScrapeProgress(`✅ 완료! ${data.removed}개 중복 웨딩홀이 삭제되었습니다.`);
        
        // 2초 후 자동 새로고침
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setScrapeProgress(`❌ 오류: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('중복 정리 실패:', error);
      setScrapeProgress('❌ 네트워크 오류가 발생했습니다.');
    } finally {
      setTimeout(() => {
        setCleaningUp(false);
        setScrapeProgress('');
      }, 3000);
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

      {/* 지역 필터 및 관리 버튼 */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <RegionFilter 
          selectedRegion={selectedRegion}
          onRegionChange={setSelectedRegion}
        />
        
        {/* 관리 버튼 그룹 */}
        <div className="flex gap-2">
          {/* 중복 정리 버튼 */}
          <button
            onClick={handleCleanupDuplicates}
            disabled={cleaningUp || loading}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {cleaningUp ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>정리 중...</span>
              </>
            ) : (
              <>
                <span>🧹</span>
                <span>중복 정리</span>
              </>
            )}
          </button>

          {/* 모든 후기 수집 버튼 */}
          <button
            onClick={handleScrapeAll}
            disabled={scrapingAll || loading}
            className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {scrapingAll ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>수집 중...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>모든 후기 수집</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 진행 상황 표시 */}
      {scrapeProgress && (
        <div className={`mb-4 p-4 rounded-lg ${
          scrapeProgress.includes('✅') 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : scrapeProgress.includes('❌')
            ? 'bg-red-50 text-red-800 border border-red-200'
            : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <p className="font-medium">{scrapeProgress}</p>
        </div>
      )}

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
