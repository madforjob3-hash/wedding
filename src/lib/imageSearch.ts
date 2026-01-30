/**
 * Google Custom Search API를 사용하여 웨딩홀 이미지 검색
 */

interface GoogleImageResult {
  link: string;
  title: string;
  image: {
    contextLink: string;
    thumbnailLink: string;
  };
}

/**
 * Google Custom Search API로 웨딩홀 이미지 검색
 */
export async function searchWeddingHallImage(
  hallName: string,
  apiKey?: string,
  searchEngineId?: string
): Promise<string | null> {
  // 환경 변수에서 API 키 가져오기
  const GOOGLE_API_KEY = apiKey || process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const SEARCH_ENGINE_ID = searchEngineId || process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

  if (!GOOGLE_API_KEY || !SEARCH_ENGINE_ID) {
    console.warn('Google Custom Search API 키가 설정되지 않았습니다.');
    return null;
  }

  try {
    const query = encodeURIComponent(`${hallName} 웨딩홀`);
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${query}&searchType=image&num=1&safe=active`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Custom Search API 오류: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const firstResult = data.items[0] as GoogleImageResult;
      return firstResult.link;
    }

    return null;
  } catch (error) {
    console.error('이미지 검색 실패:', error);
    return null;
  }
}

/**
 * Google Maps Static API로 웨딩홀 위치 이미지 생성
 */
export async function getGoogleMapsImage(
  address: string,
  apiKey?: string
): Promise<string | null> {
  const GOOGLE_MAPS_API_KEY = apiKey || process.env.GOOGLE_MAPS_API_KEY;

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API 키가 설정되지 않았습니다.');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=16&size=800x400&markers=color:red|${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
    
    return url;
  } catch (error) {
    console.error('Google Maps 이미지 생성 실패:', error);
    return null;
  }
}

/**
 * Unsplash에서 웨딩홀 관련 이미지 가져오기
 */
export function getUnsplashWeddingImage(hallName: string): string {
  // 웨딩홀 관련 키워드로 Unsplash 이미지
  const keywords = ['wedding', 'venue', 'hall', 'ceremony', 'reception'];
  const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
  
  // Unsplash Source API 사용 (무료, API 키 불필요)
  return `https://source.unsplash.com/800x400/?${randomKeyword},wedding`;
}

/**
 * 웨딩홀 이미지 가져오기 (우선순위: Custom Search > Maps > Unsplash)
 */
export async function getWeddingHallImage(
  hallName: string,
  address: string
): Promise<string> {
  // 1순위: Google Custom Search (실제 웨딩홀 이미지)
  const customSearchImage = await searchWeddingHallImage(hallName);
  if (customSearchImage) {
    return customSearchImage;
  }

  // 2순위: Google Maps Static (위치 이미지)
  const mapsImage = await getGoogleMapsImage(address);
  if (mapsImage) {
    return mapsImage;
  }

  // 3순위: Unsplash (기본 이미지)
  return getUnsplashWeddingImage(hallName);
}
