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
 * 네이버 블로그 검색 결과 크롤링
 */
export async function scrapeNaverBlogs(hallName: string, maxResults = 10): Promise<Array<{title: string, url: string}>> {
  try {
    const searchUrl = SOURCES.naver.searchUrl(hallName);
    
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
    
    // 네이버 블로그 검색 결과 추출
    $('.total_wrap .total_area').each((_, elem) => {
      const title = $(elem).find('.title_link').text().trim();
      const url = $(elem).find('.title_link').attr('href');
      
      if (title && url && results.length < maxResults) {
        results.push({ title, url });
      }
    });

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
      const url = $(elem).attr('href');
      
      if (title && url && results.length < maxResults) {
        results.push({ title, url });
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
