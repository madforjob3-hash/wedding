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
    
    for (const review of result.reviews) {
      try {
        await geminiAnalyzer.analyzeReview(review.id);
        analyzed++;
        console.log(`   ✓ Analyzed ${analyzed}/${result.reviews.length}`);
      } catch (error) {
        console.error(`   ✗ Failed: ${error.message}`);
      }
    }

    console.log('\n🔄 Updating hall caches...\n');
    const analyses = await firestore.db.collection('analysis')
      .where('reviewId', 'in', result.reviews.map(r => r.id))
      .get();
    
    const uniqueHalls = new Set();
    analyses.docs.forEach(doc => uniqueHalls.add(doc.data().hallName));

    for (const hallName of uniqueHalls) {
      try {
        await geminiAnalyzer.updateHallCache(hallName);
      } catch (error) {
        console.error(`   ✗ Failed for ${hallName}`);
      }
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
