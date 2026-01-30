import * as cheerio from 'cheerio';
import type { ScraperSource } from '@/types';

// 크롤링 대상 사이트 설정
export const SOURCES: Record<string, ScraperSource> = {
  naver: {
    searchUrl: (hallName) => 
      `https://search.naver.com/search.naver?query=${encodeURIComponent(hallName + ' 후기')}`,
    selector: '.total_wrap'
  },
  daum: {
    searchUrl: (hallName) => 
      `https://search.daum.net/search?q=${encodeURIComponent(hallName + ' 후기')}`,
    selector: '.g_comp'
  },
  directwedding: {
    searchUrl: (hallName) => 
      `https://www.directwedding.co.kr/search?keyword=${encodeURIComponent(hallName)}`,
    selector: '.review-item'
  },
  makemywedding: {
    searchUrl: (hallName) => 
      `https://www.makemywedding.co.kr/search?q=${encodeURIComponent(hallName)}`,
    selector: '.content-list'
  }
};

// User-Agent 랜덤 선택
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Rate limiting을 위한 지연 함수
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * URL이 신뢰할 수 있는 블로그인지 확인
 */
function isValidBlogUrl(url: string): boolean {
  const validDomains = [
    'blog.naver.com',
    'blog.daum.net',
    'brunch.co.kr',
    'post.naver.com',
    'm.blog.naver.com'
  ];
  
  try {
    const urlObj = new URL(url);
    return validDomains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * 제목이 웨딩홀 후기와 관련이 있는지 확인
 */
function isRelevantReview(title: string, hallName: string): boolean {
  const titleLower = title.toLowerCase();
  const hallNameLower = hallName.toLowerCase();
  
  // 웨딩홀 이름이 제목에 포함되어야 함
  if (!titleLower.includes(hallNameLower)) {
    return false;
  }
  
  // 관련 키워드가 하나라도 있어야 함
  const relevantKeywords = [
    '후기', '리뷰', '예식', '웨딩', '결혼', '식장',
    '식대', '주차', '음식', '서비스', '만족', '추천'
  ];
  
  return relevantKeywords.some(keyword => titleLower.includes(keyword));
}

/**
 * 네이버 블로그 검색 결과 크롤링
 */
export async function scrapeNaverBlogs(hallName: string, maxResults = 10): Promise<Array<{title: string, url: string}>> {
  try {
    const searchUrl = SOURCES.naver.searchUrl(hallName);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results: Array<{title: string, url: string}> = [];
    
    // 네이버 블로그 검색 결과 추출 (여러 선택자 시도)
    $('.total_wrap .total_area, .api_subject_bx, .sh_blog_top').each((_, elem) => {
      const $elem = $(elem);
      
      // 제목과 링크 찾기
      let title = $elem.find('.title_link, .api_txt_lines, .sh_blog_title, a.title').first().text().trim();
      let url = $elem.find('.title_link, .api_txt_lines, .sh_blog_title, a.title').first().attr('href');
      
      // 링크가 없으면 다음 요소로
      if (!url) return;
      
      // 상대 경로를 절대 경로로 변환
      if (url.startsWith('/')) {
        url = 'https://search.naver.com' + url;
      }
      
      // 실제 블로그 URL 추출 (네이버 검색 결과는 리다이렉트 URL이므로)
      try {
        const urlObj = new URL(url);
        // 네이버 검색 결과 URL에서 실제 블로그 URL 추출
        if (urlObj.searchParams.has('url')) {
          url = urlObj.searchParams.get('url') || url;
        }
      } catch {
        // URL 파싱 실패 시 원본 사용
      }
      
      // 필터링: 유효한 블로그 URL이고, 관련 후기인지 확인
      if (title && url && 
          isValidBlogUrl(url) && 
          isRelevantReview(title, hallName) &&
          results.length < maxResults) {
        // 중복 제거
        if (!results.some(r => r.url === url || r.url.includes(url) || url.includes(r.url))) {
          results.push({ title, url });
        }
      }
    });

    // 결과가 없으면 더 넓은 범위로 검색 (하지만 여전히 필터링 적용)
    if (results.length === 0) {
      $('a[href*="blog.naver.com"]').each((_, elem) => {
        const $elem = $(elem);
        let url = $elem.attr('href');
        const title = $elem.text().trim();
        
        if (!url) return;
        
        // 상대 경로를 절대 경로로 변환
        if (url.startsWith('/')) {
          url = 'https://search.naver.com' + url;
        }
        
        // 실제 블로그 URL 추출
        try {
          const urlObj = new URL(url);
          if (urlObj.searchParams.has('url')) {
            url = urlObj.searchParams.get('url') || url;
          }
        } catch {}
        
        // 필터링 적용
        if (url && title && title.length > 5 && 
            isValidBlogUrl(url) && 
            isRelevantReview(title, hallName) &&
            results.length < maxResults) {
          if (!results.some(r => r.url === url || r.url.includes(url) || url.includes(r.url))) {
            results.push({ title, url });
          }
        }
      });
    }

    await delay(2000); // 2초 대기
    return results;
  } catch (error) {
    console.error('네이버 블로그 크롤링 실패:', error);
    return [];
  }
}

/**
 * 다음 블로그 검색 결과 크롤링
 */
export async function scrapeDaumBlogs(hallName: string, maxResults = 10): Promise<Array<{title: string, url: string}>> {
  try {
    const searchUrl = SOURCES.daum.searchUrl(hallName);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent()
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results: Array<{title: string, url: string}> = [];
    
    // 다음 검색 결과 추출
    $('.g_comp .tit_g').each((_, elem) => {
      const title = $(elem).text().trim();
      let url = $(elem).attr('href');
      
      if (!url) return;
      
      // 상대 경로를 절대 경로로 변환
      if (url.startsWith('/')) {
        url = 'https://search.daum.net' + url;
      }
      
      // 실제 블로그 URL 추출
      try {
        const urlObj = new URL(url);
        if (urlObj.searchParams.has('url')) {
          url = urlObj.searchParams.get('url') || url;
        }
      } catch {}
      
      // 필터링: 유효한 블로그 URL이고, 관련 후기인지 확인
      if (title && url && 
          isValidBlogUrl(url) && 
          isRelevantReview(title, hallName) &&
          results.length < maxResults) {
        // 중복 제거
        if (!results.some(r => r.url === url || r.url.includes(url) || url.includes(r.url))) {
          results.push({ title, url });
        }
      }
    });

    await delay(2000); // 2초 대기
    return results;
  } catch (error) {
    console.error('다음 블로그 크롤링 실패:', error);
    return [];
  }
}

/**
 * 모든 소스에서 후기 크롤링
 */
export async function scrapeAllSources(hallName: string): Promise<Array<{title: string, url: string, source: string}>> {
  const results: Array<{title: string, url: string, source: string}> = [];

  // 네이버 크롤링
  const naverResults = await scrapeNaverBlogs(hallName);
  results.push(...naverResults.map(r => ({ ...r, source: 'naver' })));

  // 다음 크롤링
  const daumResults = await scrapeDaumBlogs(hallName);
  results.push(...daumResults.map(r => ({ ...r, source: 'daum' })));

  return results;
}
