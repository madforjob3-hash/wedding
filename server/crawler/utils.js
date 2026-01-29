import robotsParser from 'robots-parser';
import axios from 'axios';

class CrawlerUtils {
  constructor() {
    this.robotsCache = new Map();
    this.lastRequestTime = new Map();
    this.rateLimit = parseInt(process.env.CRAWL_RATE_LIMIT) || 2000;
  }

  async canCrawl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.origin;
      const robotsUrl = `${domain}/robots.txt`;

      if (!this.robotsCache.has(domain)) {
        try {
          const response = await axios.get(robotsUrl, { timeout: 5000 });
          const robots = robotsParser(robotsUrl, response.data);
          this.robotsCache.set(domain, robots);
        } catch (error) {
          console.log(`No robots.txt for ${domain}, allowing crawl`);
          return true;
        }
      }

      const robots = this.robotsCache.get(domain);
      const userAgent = process.env.USER_AGENT || 'WeddingReviewBot/1.0';
      
      return robots ? robots.isAllowed(url, userAgent) : true;
    } catch (error) {
      console.error('Error checking robots.txt:', error.message);
      return false;
    }
  }

  async waitForRateLimit(domain) {
    const now = Date.now();
    const lastTime = this.lastRequestTime.get(domain) || 0;
    const timeSinceLastRequest = now - lastTime;

    if (timeSinceLastRequest < this.rateLimit) {
      const waitTime = this.rateLimit - timeSinceLastRequest;
      console.log(`⏱️  Rate limiting: waiting ${waitTime}ms for ${domain}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime.set(domain, Date.now());
  }

  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  isValidReviewUrl(url) {
    const invalidPatterns = [
      /login/i, /signup/i, /mypage/i, /admin/i,
      /cart/i, /payment/i, /\.pdf$/i, /\.zip$/i
    ];
    return !invalidPatterns.some(pattern => pattern.test(url));
  }

  detectSponsored(text) {
    const sponsoredKeywords = [
      '협찬', '광고', '제공받', '원고료', '서포터즈',
      '체험단', '#ad', '#sponsored', '#협찬'
    ];
    const lowerText = text.toLowerCase();
    return sponsoredKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  calculateTrustScore(review) {
    let score = 0.5;
    
    if (review.wordCount >= 300) score += 0.2;
    if (review.hasImages) score += 0.1;
    if (review.isSponsored) score -= 0.2;

    const daysSincePublished = (Date.now() - new Date(review.publishedAt)) / (1000 * 60 * 60 * 24);
    if (daysSincePublished <= 30) score += 0.2;
    else if (daysSincePublished <= 90) score += 0.1;

    const platformBonus = {
      'wed21': 0.1, 'wef': 0.1,
      'community': 0.1, 'blog': 0.05
    };
    score += platformBonus[review.sourcePlatform] || 0;

    return Math.max(0, Math.min(1, score));
  }
}

export default new CrawlerUtils();
