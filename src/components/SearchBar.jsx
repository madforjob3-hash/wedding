import React, { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';

function SearchBar({ onSearch, isSearching }) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    platform: '',
    minTrustScore: 0.5,
    dateFrom: '',
    dateTo: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query, filters);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 메인 검색창 */}
        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Sparkles className="w-5 h-5 text-primary-500" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="웨딩홀을 검색해보세요 (예: 강남 웨딩홀 추천, 합리적인 웨딩홀)"
            className="w-full pl-12 pr-32 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
            disabled={isSearching}
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute inset-y-0 right-2 px-6 m-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2"
          >
            <Search className="w-4 h-4" />
            <span>검색</span>
          </button>
        </div>

        {/* 필터 토글 */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
          >
            {showFilters ? '필터 숨기기 ▲' : '고급 필터 ▼'}
          </button>
        </div>

        {/* 필터 옵션 */}
        {showFilters && (
          <div className="card bg-gray-50">
            <h4 className="font-semibold mb-4 text-gray-700">검색 필터</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 플랫폼 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  플랫폼
                </label>
                <select
                  value={filters.platform}
                  onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                  className="input"
                >
                  <option value="">전체</option>
                  <option value="blog">블로그</option>
                  <option value="cafe">카페</option>
                  <option value="community">커뮤니티</option>
                  <option value="wed21">웨딩21</option>
                </select>
              </div>

              {/* 신뢰도 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  최소 신뢰도: {filters.minTrustScore * 100}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={filters.minTrustScore}
                  onChange={(e) => setFilters({ ...filters, minTrustScore: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* 날짜 범위 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시작 날짜
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  종료 날짜
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            {/* 필터 초기화 */}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setFilters({
                  platform: '',
                  minTrustScore: 0.5,
                  dateFrom: '',
                  dateTo: ''
                })}
                className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
              >
                필터 초기화
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default SearchBar;
