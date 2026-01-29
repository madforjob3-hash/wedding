import React from 'react';
import { ExternalLink, Calendar, User, TrendingUp, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

function SearchResults({ results, onNewSearch }) {
  const { answer, sources, totalReviews, responseTime, crawlResult } = results;

  return (
    <div className="space-y-6">
      {/* 크롤링 정보 */}
      {crawlResult && crawlResult.newReviews > 0 && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-start space-x-3">
            <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-900">
                🔄 최신 후기 {crawlResult.newReviews}개 수집 완료
              </p>
              <p className="text-sm text-green-700 mt-1">
                방금 전 웹에서 최신 정보를 가져왔습니다
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI 답변 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">🤖 AI 분석 결과</h2>
          <div className="text-sm text-gray-500">
            {totalReviews}개 후기 분석 · {responseTime}ms
          </div>
        </div>

        <div className="markdown-content prose prose-sm max-w-none">
          <ReactMarkdown>{answer}</ReactMarkdown>
        </div>
      </div>

      {/* 참고 출처 */}
      {sources && sources.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">
            📚 참고 후기 ({sources.length}개)
          </h3>
          
          <div className="space-y-3">
            {sources.map((source) => (
              <a
                key={source.index}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-bold">
                        {source.index}
                      </span>
                      <h4 className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors">
                        {source.title}
                      </h4>
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary-600" />
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      {source.hallName && (
                        <span className="badge badge-info">
                          {source.hallName}
                        </span>
                      )}
                      {source.author && (
                        <span className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{source.author}</span>
                        </span>
                      )}
                      {source.publishedAt && (
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(source.publishedAt).toLocaleDateString('ko-KR')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 면책 조항 */}
      <div className="card bg-yellow-50 border-yellow-200">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">⚠️ 참고 사항</p>
            <ul className="list-disc list-inside space-y-1">
              <li>본 정보는 공개된 후기를 AI가 자동 분석한 결과입니다</li>
              <li>실제 가격과 서비스는 시기에 따라 변동될 수 있습니다</li>
              <li>계약 전 반드시 웨딩홀에 직접 확인하시기 바랍니다</li>
              <li>모든 출처는 위 "참고 후기" 섹션에서 확인 가능합니다</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 관련 검색어 */}
      <div className="card bg-gray-50">
        <h4 className="font-semibold mb-3 text-gray-700">🔍 관련 검색어</h4>
        <div className="flex flex-wrap gap-2">
          {[
            '가격 비교',
            '주차 정보',
            '혼잡도',
            '예약 방법',
            '할인 정보'
          ].map((keyword) => (
            <button
              key={keyword}
              onClick={() => onNewSearch(`${sources[0]?.hallName || ''} ${keyword}`, {})}
              className="px-3 py-1.5 bg-white border border-gray-300 hover:border-primary-500 hover:text-primary-600 rounded-full text-sm transition-colors"
            >
              {keyword}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SearchResults;
