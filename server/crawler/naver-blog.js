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
        
        $('.total_wrap .total_area').each((i, elem) => {
          const $elem = $(elem);
          const title = $elem.find('.title_link').text().trim();
          const link = $elem.find('.title_link').attr('href');
          const desc = $elem.find('.total_dsc').text().trim();
          const author = $elem.find('.sub_txt').first().text().trim();
          const date = $elem.find('.sub_time').text().trim();

          if (link && title) {
            results.push({
              title, url: link, description: desc, author,
              publishedAt: this.parseDate(date),
              platform: 'blog', domain: 'blog.naver.com'
            });
          }
        });

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
        headers: { 'User-Agent': process.env.USER_AGENT },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      
      let content = '';
      let title = '';
      let publishedAt = null;
      let author = '';

      if ($('.se-main-container').length > 0) {
        content = $('.se-main-container').html();
        title = $('.se-title-text').text().trim();
      } else if ($('#postViewArea').length > 0) {
        content = $('#postViewArea').html();
        title = $('.pcol1').first().text().trim();
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
