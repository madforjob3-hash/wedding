import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import crawlerUtils from './utils.js';

class NaverBlogCrawler {
  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    this.baseUrl = 'https://search.naver.com/search.naver';
  }

  async search(keyword, maxResults = 30) {
    console.log(`🔍 Searching Naver blogs for: ${keyword}`);
    const results = [];

    try {
      if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
        return await this.searchWithAPI(keyword, maxResults);
      }

      for (let start = 1; start <= maxResults; start += 10) {
        const url = `${this.baseUrl}?where=blog&query=${encodeURIComponent(keyword + ' 후기')}&start=${start}`;
        
        await crawlerUtils.waitForRateLimit('search.naver.com');
        
        const response = await axios.get(url, {
          headers: { 'User-Agent': process.env.USER_AGENT },
          timeout: 10000
        });

        const $ = cheerio.load(response.data);
        
        // 최신 네이버 블로그 검색 결과 구조 (2025년)
        // 여러 선택자 시도
        $('.api_subject_bx, .total_wrap, .sh_blog_top, .blog_sect').each((i, elem) => {
          const $elem = $(elem);
          
          // 제목과 링크 찾기 (여러 패턴 시도)
          let title = $elem.find('.api_txt_lines, .title_link, .sh_blog_title, a.title').text().trim();
          let link = $elem.find('.api_txt_lines, .title_link, .sh_blog_title, a.title').attr('href') || 
                     $elem.find('a').first().attr('href');
          
          // 링크가 없으면 다음 요소로
          if (!link) return;
          
          // 상대 경로를 절대 경로로 변환
          if (link.startsWith('/')) {
            link = 'https://search.naver.com' + link;
          }
          
          const desc = $elem.find('.api_txt_lines.dsc_txt, .total_dsc, .sh_blog_passage').text().trim();
          const author = $elem.find('.sub_txt, .sh_blog_name, .sub_info').first().text().trim();
          const date = $elem.find('.sub_time, .sh_blog_date').text().trim();

          if (link && title) {
            results.push({
              title, url: link, description: desc, author,
              publishedAt: this.parseDate(date),
              platform: 'blog', domain: 'blog.naver.com'
            });
          }
        });
        
        // 결과가 없으면 더 넓은 범위로 검색
        if (results.length === 0) {
          $('a[href*="blog.naver.com"]').each((i, elem) => {
            const $elem = $(elem);
            const link = $elem.attr('href');
            const title = $elem.text().trim();
            
            if (link && title && title.length > 5) {
              results.push({
                title, 
                url: link.startsWith('/') ? 'https://search.naver.com' + link : link,
                description: '',
                author: '',
                publishedAt: null,
                platform: 'blog',
                domain: 'blog.naver.com'
              });
            }
          });
        }

        if (results.length >= maxResults) break;
      }

      console.log(`✅ Found ${results.length} blog posts`);
      return results.slice(0, maxResults);

    } catch (error) {
      console.error('❌ Naver blog search failed:', error.message);
      return results;
    }
  }

  async searchWithAPI(keyword, maxResults = 30) {
    const results = [];
    
    try {
      const response = await axios.get('https://openapi.naver.com/v1/search/blog.json', {
        params: {
          query: keyword + ' 웨딩홀 후기',
          display: Math.min(maxResults, 100),
          sort: 'date'
        },
        headers: {
          'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET
        }
      });

      response.data.items.forEach(item => {
        results.push({
          title: this.cleanHtml(item.title),
          url: item.link,
          description: this.cleanHtml(item.description),
          author: item.bloggername,
          publishedAt: this.parseDate(item.postdate),
          platform: 'blog',
          domain: 'blog.naver.com'
        });
      });

      console.log(`✅ Found ${results.length} blog posts via API`);
      return results;

    } catch (error) {
      console.error('❌ Naver API search failed:', error.message);
      return [];
    }
  }

  async crawlPost(url) {
    try {
      if (!await crawlerUtils.canCrawl(url)) {
        console.log(`🚫 Blocked by robots.txt: ${url}`);
        return null;
      }

      const domain = crawlerUtils.getDomain(url);
      await crawlerUtils.waitForRateLimit(domain);

      let actualUrl = url;
      if (url.includes('blog.naver.com') && !url.includes('PostView')) {
        actualUrl = await this.getActualBlogUrl(url);
      }

      const response = await axios.get(actualUrl, {
        headers: { 
          'User-Agent': process.env.USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      
      let content = '';
      let title = '';
      let publishedAt = null;
      let author = '';

      // 여러 패턴 시도
      if ($('.se-main-container').length > 0) {
        content = $('.se-main-container').html();
        title = $('.se-title-text').text().trim() || $('h3.se-title-text').text().trim();
      } else if ($('#postViewArea').length > 0) {
        content = $('#postViewArea').html();
        title = $('.pcol1').first().text().trim() || $('h3').first().text().trim();
      } else if ($('.post-view').length > 0) {
        content = $('.post-view').html();
        title = $('h3, .title').first().text().trim();
      } else {
        // 최후의 수단: body 전체에서 본문 추출
        content = $('body').html();
        title = $('title').text().trim() || '제목 없음';
      }

      publishedAt = $('.se_publishDate').text().trim() || 
                    $('.post_date').text().trim() ||
                    $('meta[property="article:published_time"]').attr('content');

      author = $('.nick').text().trim() || 
               $('meta[property="og:article:author"]').attr('content');

      const contentMd = content ? this.turndown.turndown(content) : '';
      const hasImages = $(content).find('img').length > 0;
      const isSponsored = crawlerUtils.detectSponsored(contentMd);

      return {
        sourceUrl: actualUrl,
        sourcePlatform: 'blog',
        sourceDomain: domain,
        title, author,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        rawHtml: content,
        contentMd,
        wordCount: contentMd.replace(/\s/g, '').length,
        hasImages,
        isSponsored
      };

    } catch (error) {
      console.error(`❌ Failed to crawl ${url}:`, error.message);
      return null;
    }
  }

  async getActualBlogUrl(url) {
    try {
      const response = await axios.get(url, {
        maxRedirects: 5,
        headers: { 'User-Agent': process.env.USER_AGENT }
      });
      return response.request.res.responseUrl || url;
    } catch {
      return url;
    }
  }

  cleanHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
    if (match) {
      return new Date(match[1], match[2] - 1, match[3]);
    }
    try {
      return new Date(dateStr);
    } catch {
      return null;
    }
  }
}

export default NaverBlogCrawler;
