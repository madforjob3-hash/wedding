'use client';

import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="웨딩홀 이름을 검색하세요... (예: 그랜드 인터컨티넨탈)"
          className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-full focus:border-rose-500 focus:outline-none shadow-sm"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors font-medium"
        >
          검색
        </button>
      </div>
    </form>
  );
}
