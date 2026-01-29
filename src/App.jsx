import React, { useState } from 'react';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import LoadingState from './components/LoadingState';
import { Search, Sparkles } from 'lucide-react';

function App() {
  const [searchState, setSearchState] = useState({
    isSearching: false,
    results: null,
    error: null
  });

  const handleSearch = async (query, filters) => {
    setSearchState({ isSearching: true, results: null, error: null });

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, filters, autoCrawl: true })
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setSearchState({ isSearching: false, results: data, error: null });
      
    } catch (error) {
      console.error('Search error:', error);
      setSearchState({ 
        isSearching: false, 
        results: null, 
        error: error.message 
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-8 h-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">웨딩홀 리뷰 AI</h1>
              <p className="text-sm text-gray-600">Gemini + Firebase로 실시간 분석</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <SearchBar onSearch={handleSearch} isSearching={searchState.isSearching} />
        </div>

        {!searchState.isSearching && !searchState.results && (
          <div className="card max-w-3xl mx-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">💡 인기 검색어</h3>
            <div className="flex flex-wrap gap-2">
              {['강남 웨딩홀', '잠실 웨딩홀', '합리적인 웨딩홀', '주차 편한 웨딩홀', '소규모 웨딩홀'].map((keyword) => (
                <button
                  key={keyword}
                  onClick={() => handleSearch(keyword, {})}
                  className="px-4 py-2 bg-gray-100 hover:bg-primary-100 hover:text-primary-700 rounded-full text-sm font-medium transition-colors"
                >
                  {keyword}
                </button>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>🤖 Gemini AI가 자동으로:</strong><br />
                1. 최신 웨딩홀 후기를 실시간 수집<br />
                2. 장단점과 가격 정보를 분석<br />
                3. Firebase에 저장하고 출처와 함께 답변 생성
              </p>
            </div>
          </div>
        )}

        {searchState.isSearching && <LoadingState />}

        {searchState.results && (
          <SearchResults 
            results={searchState.results}
            onNewSearch={handleSearch}
          />
        )}

        {searchState.error && (
          <div className="card max-w-3xl mx-auto bg-red-50 border-red-200">
            <p className="text-red-700">
              ❌ 검색 중 오류가 발생했습니다: {searchState.error}
            </p>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-2">⚠️ 본 정보는 공개된 후기를 AI가 분석한 결과입니다.</p>
            <p className="mt-4 text-gray-500">Powered by Gemini AI + Firebase</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
