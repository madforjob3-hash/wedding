import NaverBlogCrawler from './naver-blog.js';
import firestore from '../database/firebase.js';
import crawlerUtils from './utils.js';
import { v4 as uuidv4 } from 'uuid';

class CrawlerManager {
  constructor() {
    this.naverBlog = new NaverBlogCrawler();
    this.maxConcurrent = parseInt(process.env.MAX_CONCURRENT_CRAWLS) || 5;
  }

  async crawl(keyword, options = {}) {
    const jobId = uuidv4();
    const maxResults = options.maxResults || 30;
    
    console.log(`\n🚀 Starting crawl job: ${jobId}`);
    console.log(`   Keyword: ${keyword}`);
    console.log(`   Max results: ${maxResults}\n`);

    try {
      // 작업 로그 생성
      await firestore.saveCrawlJob({
        id: jobId,
        keyword,
        status: 'running',
        sourcesFound: 0,
        sourcesCrawled: 0,
        sourcesSaved: 0,
        startedAt: new Date()
      });

      // 1단계: 검색 결과 수집
      console.log('📋 Step 1: Collecting search results...');
      const searchResults = await this.collectSearchResults(keyword, maxResults);
      
      await firestore.updateCrawlJob(jobId, {
        sourcesFound: searchResults.length
      });

      if (searchResults.length === 0) {
        throw new Error('No search results found');
      }

      // 2단계: 각 URL 크롤링
      console.log(`\n📥 Step 2: Crawling ${searchResults.length} URLs...`);
      const crawledData = await this.crawlUrls(searchResults);
      
      await firestore.updateCrawlJob(jobId, {
        sourcesCrawled: crawledData.length
      });

      // 3단계: Firestore 저장
      console.log(`\n💾 Step 3: Saving to Firestore...`);
      const savedReviews = await this.saveReviews(crawledData);

      await firestore.updateCrawlJob(jobId, {
        sourcesSaved: savedReviews.length,
        status: 'completed',
        completedAt: new Date()
      });

      console.log(`\n✅ Crawl job completed!`);
      console.log(`   Job ID: ${jobId}`);
      console.log(`   Found: ${searchResults.length}`);
      console.log(`   Crawled: ${crawledData.length}`);
      console.log(`   Saved: ${savedReviews.length}\n`);

      return {
        jobId,
        keyword,
        sourcesFound: searchResults.length,
        sourcesCrawled: crawledData.length,
        sourcesSaved: savedReviews.length,
        reviews: savedReviews
      };

    } catch (error) {
      console.error(`❌ Crawl job failed:`, error);
      
      await firestore.updateCrawlJob(jobId, {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date()
      });

      throw error;
    }
  }

  async collectSearchResults(keyword, maxResults) {
    const results = [];

    try {
      // 네이버 블로그
      const blogResults = await this.naverBlog.search(keyword, maxResults);
      results.push(...blogResults);

      // 중복 제거
      const uniqueResults = Array.from(
        new Map(results.map(r => [r.url, r])).values()
      );

      return uniqueResults.slice(0, maxResults);

    } catch (error) {
      console.error('Error collecting search results:', error);
      return results;
    }
  }

  async crawlUrls(searchResults) {
    const crawledData = [];
    const batches = this.chunkArray(searchResults, this.maxConcurrent);

    for (let i = 0; i < batches.length; i++) {
      console.log(`   Batch ${i + 1}/${batches.length}`);
      
      const promises = batches[i].map(async (result) => {
        try {
          const data = await this.crawlSingleUrl(result);
          if (data) {
            console.log(`   ✓ ${result.url.substring(0, 60)}...`);
            return data;
          }
        } catch (error) {
          console.log(`   ✗ ${result.url.substring(0, 60)}...`);
          return null;
        }
      });

      const batchResults = await Promise.all(promises);
      crawledData.push(...batchResults.filter(Boolean));
    }

    return crawledData;
  }

  async crawlSingleUrl(result) {
    const { url, platform } = result;

    switch (platform) {
      case 'blog':
        return await this.naverBlog.crawlPost(url);
      default:
        return null;
    }
  }

  async saveReviews(crawledData) {
    const savedReviews = [];

    for (const data of crawledData) {
      try {
        // 중복 체크
        const existing = await firestore.getReviewByUrl(data.sourceUrl);
        if (existing) {
          console.log(`   ⊘ Duplicate: ${data.sourceUrl.substring(0, 60)}...`);
          continue;
        }

        // 신뢰도 점수 계산
        const trustScore = crawlerUtils.calculateTrustScore(data);

        // 저장
        const reviewId = uuidv4();
        await firestore.saveReview({
          id: reviewId,
          sourceUrl: data.sourceUrl,
          sourcePlatform: data.sourcePlatform,
          sourceDomain: data.sourceDomain,
          title: data.title,
          author: data.author,
          publishedAt: data.publishedAt,
          rawHtml: data.rawHtml,
          contentMd: data.contentMd,
          wordCount: data.wordCount,
          hasImages: data.hasImages,
          isSponsored: data.isSponsored,
          trustScore: trustScore
        });

        savedReviews.push({ id: reviewId, sourceUrl: data.sourceUrl, title: data.title });
        console.log(`   ✓ Saved: ${data.title?.substring(0, 40)}...`);

      } catch (error) {
        console.error(`   ✗ Failed to save: ${error.message}`);
      }
    }

    return savedReviews;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async getJobStatus(jobId) {
    return await firestore.getCrawlJob(jobId);
  }
}

export default new CrawlerManager();
