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
 * 네이버 검색 결과 URL에서 실제 블로그 글 URL 추출
 */
function extractNaverBlogUrl(searchUrl: string): string | null {
  try {
    const urlObj = new URL(searchUrl);
    
    // 1. url 파라미터에서 직접 추출
    if (urlObj.searchParams.has('url')) {
      const blogUrl = urlObj.searchParams.get('url');
      if (blogUrl && isValidBlogUrl(blogUrl)) {
        return decodeURIComponent(blogUrl);
      }
    }
    
    // 2. data-url 속성에서 추출 (HTML에서)
    // 이건 HTML 파싱 단계에서 처리
    
    // 3. href에서 blog.naver.com이 포함된 경우 직접 사용
    if (urlObj.href.includes('blog.naver.com')) {
      // 리다이렉트 URL이 아닌 직접 링크인 경우
      const match = urlObj.href.match(/https?:\/\/[^/]*blog\.naver\.com\/[^?&]+/);
      if (match) {
        return match[0];
      }
    }
    
    return null;
  } catch {
    return null;
  }
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
      },
      redirect: 'follow' // 리다이렉트를 따라가도록
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results: Array<{title: string, url: string}> = [];
    
    // 네이버 블로그 검색 결과 추출 (여러 선택자 시도)
    $('.total_wrap .total_area, .api_subject_bx, .sh_blog_top, .sh_blog_title').each((_, elem) => {
      const $elem = $(elem);
      
      // 제목 찾기
      let title = $elem.find('.title_link, .api_txt_lines, .sh_blog_title, a.title, .title').first().text().trim();
      if (!title) {
        title = $elem.text().trim();
      }
      
      // 링크 찾기 (여러 방법 시도)
      let url: string | undefined = undefined;
      
      // 1. data-url 속성 확인 (네이버 검색 결과에서 실제 URL이 여기 있을 수 있음)
      url = $elem.find('a').first().attr('data-url') || 
            $elem.attr('data-url') ||
            $elem.find('.title_link, a.title').first().attr('data-url');
      
      // 2. href 속성 확인
      if (!url) {
        url = $elem.find('.title_link, .api_txt_lines, .sh_blog_title, a.title, a').first().attr('href');
      }
      
      // 링크가 없으면 다음 요소로
      if (!url) return;
      
      // 상대 경로를 절대 경로로 변환
      if (url.startsWith('/')) {
        url = 'https://search.naver.com' + url;
      }
      
      // 실제 블로그 글 URL 추출
      let actualUrl = extractNaverBlogUrl(url);
      
      // data-url이 직접 블로그 URL인 경우
      if (!actualUrl && isValidBlogUrl(url)) {
        actualUrl = url;
      }
      
      // 여전히 없으면 href에서 직접 추출 시도
      if (!actualUrl) {
        try {
          const urlObj = new URL(url);
          // url 파라미터 확인
          if (urlObj.searchParams.has('url')) {
            actualUrl = decodeURIComponent(urlObj.searchParams.get('url') || '');
          } else if (url.includes('blog.naver.com')) {
            // 직접 블로그 URL인 경우
            const match = url.match(/https?:\/\/[^/]*blog\.naver\.com\/[^?&]+/);
            if (match) {
              actualUrl = match[0];
            }
          }
        } catch {
          // URL 파싱 실패
        }
      }
      
      // 최종 URL이 없거나 유효하지 않으면 스킵
      if (!actualUrl || !isValidBlogUrl(actualUrl)) {
        return;
      }
      
      // 블로그 메인 페이지가 아닌 실제 글 URL인지 확인
      // blog.naver.com/{blogId} 형태는 메인 페이지, {blogId}/{postId} 형태는 글
      const blogPostPattern = /blog\.naver\.com\/[^/]+\/[^/]+/;
      if (!blogPostPattern.test(actualUrl)) {
        // 메인 페이지 URL이면 스킵
        return;
      }
      
      // 필터링: 유효한 블로그 URL이고, 관련 후기인지 확인
      if (title && actualUrl && 
          isValidBlogUrl(actualUrl) && 
          isRelevantReview(title, hallName) &&
          results.length < maxResults) {
        // 중복 제거 (URL 정규화)
        const normalizedUrl = actualUrl.split('?')[0]; // 쿼리 파라미터 제거
        if (!results.some(r => {
          const rNormalized = r.url.split('?')[0];
          return rNormalized === normalizedUrl || 
                 rNormalized.includes(normalizedUrl) || 
                 normalizedUrl.includes(rNormalized);
        })) {
          results.push({ title, url: actualUrl });
        }
      }
    });

    // 결과가 없으면 더 넓은 범위로 검색 (하지만 여전히 필터링 적용)
    if (results.length === 0) {
      $('a[href*="blog.naver.com"]').each((_, elem) => {
        const $elem = $(elem);
        let url = $elem.attr('href') || $elem.attr('data-url');
        const title = $elem.text().trim();
        
        if (!url) return;
        
        // 상대 경로를 절대 경로로 변환
        if (url.startsWith('/')) {
          url = 'https://search.naver.com' + url;
        }
        
        // 실제 블로그 글 URL 추출
        let actualUrl = extractNaverBlogUrl(url);
        if (!actualUrl && isValidBlogUrl(url)) {
          actualUrl = url;
        }
        
        // 블로그 글 URL인지 확인 (메인 페이지 제외)
        if (actualUrl && !/blog\.naver\.com\/[^/]+\/[^/]+/.test(actualUrl)) {
          return;
        }
        
        // 필터링 적용
        if (actualUrl && title && title.length > 5 && 
            isValidBlogUrl(actualUrl) && 
            isRelevantReview(title, hallName) &&
            results.length < maxResults) {
          const normalizedUrl = actualUrl.split('?')[0];
          if (!results.some(r => {
            const rNormalized = r.url.split('?')[0];
            return rNormalized === normalizedUrl;
          })) {
            results.push({ title, url: actualUrl });
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
 * 다음 검색 결과 URL에서 실제 블로그 글 URL 추출
 */
function extractDaumBlogUrl(searchUrl: string): string | null {
  try {
    const urlObj = new URL(searchUrl);
    
    // url 파라미터에서 직접 추출
    if (urlObj.searchParams.has('url')) {
      const blogUrl = urlObj.searchParams.get('url');
      if (blogUrl && isValidBlogUrl(blogUrl)) {
        return decodeURIComponent(blogUrl);
      }
    }
    
    // 직접 블로그 URL인 경우
    if (urlObj.href.includes('blog.daum.net')) {
      const match = urlObj.href.match(/https?:\/\/[^/]*blog\.daum\.net\/[^?&]+/);
      if (match) {
        return match[0];
      }
    }
    
    return null;
  } catch {
    return null;
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
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const results: Array<{title: string, url: string}> = [];
    
    // 다음 검색 결과 추출
    $('.g_comp .tit_g, .wrap_tit a').each((_, elem) => {
      const $elem = $(elem);
      const title = $elem.text().trim();
      let url = $elem.attr('href') || $elem.attr('data-url');
      
      if (!url) return;
      
      // 상대 경로를 절대 경로로 변환
      if (url.startsWith('/')) {
        url = 'https://search.daum.net' + url;
      }
      
      // 실제 블로그 글 URL 추출
      let actualUrl = extractDaumBlogUrl(url);
      if (!actualUrl && isValidBlogUrl(url)) {
        actualUrl = url;
      }
      
      // 블로그 글 URL인지 확인 (메인 페이지 제외)
      // blog.daum.net/{blogId} 형태는 메인 페이지, {blogId}/{postId} 형태는 글
      if (actualUrl && !/blog\.daum\.net\/[^/]+\/[^/]+/.test(actualUrl)) {
        return;
      }
      
      // 필터링: 유효한 블로그 URL이고, 관련 후기인지 확인
      if (title && actualUrl && 
          isValidBlogUrl(actualUrl) && 
          isRelevantReview(title, hallName) &&
          results.length < maxResults) {
        // 중복 제거
        const normalizedUrl = actualUrl.split('?')[0];
        if (!results.some(r => {
          const rNormalized = r.url.split('?')[0];
          return rNormalized === normalizedUrl;
        })) {
          results.push({ title, url: actualUrl });
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
