import React, { useState, useEffect } from 'react';
import { Loader2, Search, Brain, FileText } from 'lucide-react';

function LoadingState() {
  const [step, setStep] = useState(0);

  const steps = [
    { icon: Search, text: '최신 후기 검색 중...', color: 'text-blue-600' },
    { icon: FileText, text: '웹페이지 수집 중...', color: 'text-green-600' },
    { icon: Brain, text: 'AI 분석 중...', color: 'text-purple-600' },
    { icon: Loader2, text: '답변 생성 중...', color: 'text-pink-600' }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % steps.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = steps[step].icon;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <div className="flex flex-col items-center justify-center py-12">
          {/* 아이콘 애니메이션 */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-primary-100 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-white rounded-full p-6 shadow-lg">
              <CurrentIcon className={`w-12 h-12 ${steps[step].color} animate-pulse`} />
            </div>
          </div>

          {/* 현재 단계 */}
          <p className="text-lg font-semibold text-gray-900 mb-2">
            {steps[step].text}
          </p>

          {/* 진행 바 */}
          <div className="w-full max-w-md mt-6">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-500 ease-out"
                style={{ width: `${((step + 1) / steps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* 단계 표시 */}
          <div className="flex items-center justify-center space-x-2 mt-6">
            {steps.map((s, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx <= step ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              ></div>
            ))}
          </div>

          {/* 설명 */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg max-w-md">
            <p className="text-sm text-gray-700 text-center">
              <strong>AI가 실시간으로 작업 중입니다</strong>
              <br />
              웹에서 최신 후기를 수집하고 분석하고 있습니다.
              <br />
              잠시만 기다려주세요... ☕
            </p>
          </div>
        </div>
      </div>

      {/* 팁 */}
      <div className="card mt-6 bg-gradient-to-r from-pink-50 to-purple-50">
        <h4 className="font-semibold mb-3 text-gray-800">💡 검색 팁</h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>• 구체적인 지역명을 포함하면 더 정확한 결과를 얻을 수 있어요</li>
          <li>• "합리적인", "주차 편한" 등의 키워드로 조건을 추가해보세요</li>
          <li>• 첫 검색은 시간이 조금 걸릴 수 있습니다 (최신 데이터 수집)</li>
        </ul>
      </div>
    </div>
  );
}

export default LoadingState;
