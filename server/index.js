import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crawlerManager from './crawler/manager.js';
import geminiAnalyzer from './ai/gemini.js';
import firestore from './database/firebase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/search
 * 메인 검색 엔드포인트
 */
app.post('/api/search', async (req, res) => {
  const startTime = Date.now();
  const { query, filters = {}, autoCrawl = true } = req.body;

  try {
    console.log(`\n🔍 Search request: "${query}"`);

    // 1. 자동 크롤링
    let crawlResult = null;
    if (autoCrawl) {
      console.log('📥 Auto-crawling enabled...');
      try {
        crawlResult = await crawlerManager.crawl(query, { maxResults: 20 });
        
        // 크롤링한 후기들 자동 분석
        console.log('🧠 Analyzing crawled reviews...');
        for (const review of crawlResult.reviews) {
          await geminiAnalyzer.analyzeReview(review.id);
        }
      } catch (crawlError) {
        console.warn('Auto-crawl failed, using existing data:', crawlError.message);
      }
    }

    // 2. 벡터 검색
    console.log('🔎 Searching similar reviews...');
    const similarReviews = await geminiAnalyzer.searchSimilar(query, 20, filters);

    if (similarReviews.length === 0) {
      return res.json({
        answer: '죄송합니다. 해당 검색어에 대한 후기를 찾을 수 없습니다. 다른 키워드로 검색해보시겠어요?',
        sources: [],
        totalReviews: 0,
        crawlResult: crawlResult
      });
    }

    // 3. AI 답변 생성
    console.log('🤖 Generating AI answer...');
    const result = await geminiAnalyzer.generateAnswer(query, similarReviews);

    // 4. 검색 로그 저장
    const responseTime = Date.now() - startTime;
    await firestore.saveSearchLog({
      query,
      filters,
      resultsCount: result.totalReviews,
      responseTimeMs: responseTime
    });

    console.log(`✅ Search completed in ${responseTime}ms\n`);

    res.json({
      ...result,
      responseTime,
      crawlResult: crawlResult ? {
        jobId: crawlResult.jobId,
        newReviews: crawlResult.sourcesSaved
      } : null
    });

  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ 
      error: 'Search failed', 
      message: error.message 
    });
  }
});

/**
 * POST /api/crawl
 * 수동 크롤링
 */
app.post('/api/crawl', async (req, res) => {
  const { keyword, maxResults = 30 } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  try {
    const crawlPromise = crawlerManager.crawl(keyword, { maxResults });

    res.json({ 
      message: 'Crawl job started',
      status: 'running'
    });

    crawlPromise.then(async (result) => {
      console.log('Crawl completed, starting analysis...');
      
      for (const review of result.reviews) {
        try {
          await geminiAnalyzer.analyzeReview(review.id);
        } catch (error) {
          console.error(`Failed to analyze review ${review.id}:`, error);
        }
      }
    }).catch(console.error);

  } catch (error) {
    res.status(500).json({ 
      error: 'Crawl failed', 
      message: error.message 
    });
  }
});

/**
 * GET /api/crawl/status/:jobId
 */
app.get('/api/crawl/status/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    const status = await crawlerManager.getJobStatus(jobId);
    
    if (!status) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get status', 
      message: error.message 
    });
  }
});

/**
 * GET /api/halls
 */
app.get('/api/halls', async (req, res) => {
  const { 
    query = '', 
    region = '', 
    minReviews = 0,
    sort = 'reviews'
  } = req.query;

  try {
    let halls = await firestore.getHalls({
      region,
      minReviews: parseInt(minReviews),
      sort
    });

    // 클라이언트 측 검색 필터링
    if (query) {
      halls = halls.filter(h => 
        h.hallName.toLowerCase().includes(query.toLowerCase())
      );
    }

    res.json({ halls, total: halls.length });

  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch halls', 
      message: error.message 
    });
  }
});

/**
 * GET /api/halls/:name
 */
app.get('/api/halls/:name', async (req, res) => {
  const { name } = req.params;

  try {
    const hall = await firestore.getHallCache(name);

    if (!hall) {
      return res.status(404).json({ error: 'Hall not found' });
    }

    // 관련 후기 조회
    const analyses = await firestore.getAnalysesByHall(name, 20);
    const reviewIds = analyses.map(a => a.reviewId);
    
    const reviewsPromises = reviewIds.map(id => firestore.getReview(id));
    const reviews = (await Promise.all(reviewsPromises)).filter(Boolean);

    // 분석과 후기 합치기
    const reviewsWithAnalysis = reviews.map(r => {
      const analysis = analyses.find(a => a.reviewId === r.id);
      return { ...r, analysis };
    });

    res.json({
      hall,
      reviews: reviewsWithAnalysis
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch hall details', 
      message: error.message 
    });
  }
});

/**
 * POST /api/analyze/:reviewId
 */
app.post('/api/analyze/:reviewId', async (req, res) => {
  const { reviewId } = req.params;

  try {
    const analysis = await geminiAnalyzer.analyzeReview(reviewId);
    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message 
    });
  }
});

/**
 * GET /api/stats
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await firestore.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to fetch stats', 
      message: error.message 
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Wedding Review AI Server (Gemini + Firebase)`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   Endpoint: http://localhost:${PORT}\n`);
});

export default app;
