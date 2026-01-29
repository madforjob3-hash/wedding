#!/usr/bin/env node
import crawlerManager from '../crawler/manager.js';
import geminiAnalyzer from '../ai/gemini.js';
import firestore from '../database/firebase.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const keyword = process.argv[2] || '웨딩홀 후기';
  const maxResults = parseInt(process.argv[3]) || 20;

  console.log('='.repeat(60));
  console.log('  Wedding Review AI - Manual Crawl (Gemini + Firebase)');
  console.log('='.repeat(60));
  console.log(`  Keyword: ${keyword}`);
  console.log(`  Max Results: ${maxResults}`);
  console.log('='.repeat(60));
  console.log('');

  try {
    const result = await crawlerManager.crawl(keyword, { maxResults });

    console.log('\n📊 Analyzing reviews...\n');
    let analyzed = 0;
    
    // 저장된 리뷰가 없으면 기존 리뷰 분석
    let reviewsToAnalyze = result.reviews;
    if (reviewsToAnalyze.length === 0) {
      console.log('   ℹ️  No new reviews, analyzing existing reviews...');
      reviewsToAnalyze = await firestore.getReviews({ limit: 10 }); // 최근 10개 리뷰 분석
    }
    
    for (const review of reviewsToAnalyze) {
      try {
        // 이미 분석된 리뷰인지 확인
        const existingAnalysis = await firestore.getAnalysisByReviewId(review.id);
        if (existingAnalysis) {
          console.log(`   ⊘ Already analyzed: ${review.title?.substring(0, 40)}...`);
          continue;
        }
        
        await geminiAnalyzer.analyzeReview(review.id);
        analyzed++;
        console.log(`   ✓ Analyzed ${analyzed}/${reviewsToAnalyze.length}`);
      } catch (error) {
        console.error(`   ✗ Failed: ${error.message}`);
      }
    }

    console.log('\n🔄 Updating hall caches...\n');
    
    // 분석된 리뷰 ID 목록
    const reviewIds = result.reviews.map(r => r.id).filter(Boolean);
    const uniqueHalls = new Set();
    
    if (reviewIds.length > 0) {
      // Firestore에서 분석 결과 조회 (빈 배열 체크)
      const analyses = await firestore.db.collection('analysis')
        .where('reviewId', 'in', reviewIds)
        .get();
      
      analyses.docs.forEach(doc => {
        const hallName = doc.data().hallName;
        if (hallName && hallName !== '알 수 없음') {
          uniqueHalls.add(hallName);
        }
      });

      for (const hallName of uniqueHalls) {
        try {
          await geminiAnalyzer.updateHallCache(hallName);
        } catch (error) {
          console.error(`   ✗ Failed for ${hallName}: ${error.message}`);
        }
      }
    } else {
      console.log('   ⚠️  No reviews to analyze');
    }

    console.log('\n' + '='.repeat(60));
    console.log('  ✅ Complete!');
    console.log('='.repeat(60));
    console.log(`  Job ID: ${result.jobId}`);
    console.log(`  Found: ${result.sourcesFound}`);
    console.log(`  Crawled: ${result.sourcesCrawled}`);
    console.log(`  Saved: ${result.sourcesSaved}`);
    console.log(`  Analyzed: ${analyzed}`);
    console.log(`  Halls: ${uniqueHalls.size}`);
    console.log('='.repeat(60));
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  }
}

main();
