'use client';

interface RegionFilterProps {
  selectedRegion: string;
  onRegionChange: (region: string) => void;
}

const REGIONS = [
  { value: 'all', label: '전체' },
  { value: 'gangnam', label: '강남권' },
  { value: 'seonam', label: '서남권' },
  { value: 'dongnam', label: '동남권' },
  { value: 'bukbu', label: '북부권' },
  { value: 'etc', label: '기타' }
];

export default function RegionFilter({ selectedRegion, onRegionChange }: RegionFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {REGIONS.map((region) => (
        <button
          key={region.value}
          onClick={() => onRegionChange(region.value)}
          className={`px-6 py-2 rounded-full font-medium transition-all ${
            selectedRegion === region.value
              ? 'bg-rose-500 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200 hover:border-rose-300'
          }`}
        >
          {region.label}
        </button>
      ))}
    </div>
  );
}
