import { GoogleGenerativeAI } from '@google/generative-ai';
import firestore from '../database/firebase.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

class GeminiAnalyzer {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // REST API 직접 호출 방식 사용 (v1beta 지원)
    this.apiKey = process.env.GEMINI_API_KEY;
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
    // 임베딩 모델은 일단 사용 안 함
    this.embeddingModel = null;
  }

  /**
   * 텍스트를 임베딩 벡터로 변환
   */
  async createEmbedding(text) {
    // 임베딩 모델이 없으면 null 반환 (키워드 기반 검색 사용)
    if (!this.embeddingModel) {
      return null;
    }
    try {
      const result = await this.embeddingModel.embedContent(text.substring(0, 8000));
      return result.embedding.values;
    } catch (error) {
      console.warn('Embedding creation failed (continuing without embedding):', error.message);
      return null;
    }
  }

  /**
   * 두 벡터의 코사인 유사도 계산
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 후기 분석 및 임베딩 생성
   */
  async analyzeReview(reviewId) {
    try {
      // 후기 조회
      const review = await firestore.getReview(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      console.log(`🧠 Analyzing review: ${review.title?.substring(0, 40)}...`);

      // 1. 임베딩 생성 (실패해도 계속 진행)
      const embedding = await this.createEmbedding(review.contentMd);
      
      // 임베딩 저장 (Firestore에 배열로 저장) - 임베딩이 있을 때만
      if (embedding && firestore.db) {
        await firestore.db.collection('reviews').doc(reviewId).update({
          embedding: embedding
        });
      }

      // 2. Gemini로 구조화된 분석
      const analysis = await this.extractStructuredData(review);

      // 3. 분석 결과 저장
      const analysisId = uuidv4();
      await firestore.saveAnalysis({
        id: analysisId,
        reviewId: reviewId,
        hallName: analysis.hallName,
        pros: analysis.pros,
        cons: analysis.cons,
        pricing: analysis.pricing,
        evidence: analysis.evidence,
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        modelVersion: 'gemini-pro',
        analyzedAt: new Date()
      });

      console.log(`✅ Analysis completed for: ${analysis.hallName}`);

      return analysis;

    } catch (error) {
      console.error('Analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Gemini로 구조화된 데이터 추출
   */
  async extractStructuredData(review) {
    const systemInstruction = `당신은 웨딩홀 후기 분석 전문가입니다. 
블로그 후기에서 웨딩홀 이름, 장단점, 가격 정보를 정확히 추출하세요.
반드시 JSON 형식으로만 응답하세요.`;

    const prompt = `다음은 웨딩홀 후기입니다. JSON 형식으로 정보를 추출해주세요.

제목: ${review.title}
내용:
${review.contentMd.substring(0, 6000)}

다음 형식으로 응답해주세요 (반드시 유효한 JSON만):
{
  "hallName": "웨딩홀 이름 (정확한 이름만)",
  "pros": ["장점1", "장점2", "장점3"],
  "cons": ["단점1", "단점2", "단점3"],
  "pricing": {
    "mealCost": "식대 (예: 8만원, 10만원대)",
    "guaranteeMin": 200,
    "venueFee": "대관료 정보",
    "otherCosts": "기타 비용"
  },
  "evidence": {
    "parking": "주차 관련 내용",
    "traffic": "교통/동선",
    "facility": "시설",
    "food": "음식/식대",
    "service": "서비스",
    "congestion": "혼잡도"
  },
  "sentiment": "positive/negative/neutral/mixed",
  "sentimentScore": 0.8
}

중요:
- hallName은 정확한 웨딩홀 이름만
- pros/cons는 최대 5개
- 정보 없으면 빈 문자열/배열
- 반드시 유효한 JSON만 응답`;

    try {
      // REST API 직접 호출 (v1beta 지원)
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          tools: [{ googleSearchRetrieval: {} }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      let text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('AI 응답이 없습니다.');
      }

      // JSON 추출 (마크다운 코드 블록 제거)
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsed = JSON.parse(text);
      
      return {
        hallName: parsed.hallName || '알 수 없음',
        pros: parsed.pros || [],
        cons: parsed.cons || [],
        pricing: parsed.pricing || {},
        evidence: parsed.evidence || {},
        sentiment: parsed.sentiment || 'neutral',
        sentimentScore: parsed.sentimentScore || 0.5
      };

    } catch (error) {
      console.error('Gemini extraction failed:', error.message);
      
      // 실패 시 기본값
      return {
        hallName: review.title?.split(' ')[0] || '알 수 없음',
        pros: [],
        cons: [],
        pricing: {},
        evidence: {},
        sentiment: 'neutral',
        sentimentScore: 0.5
      };
    }
  }

  /**
   * 벡터 유사도 검색 (Firestore 기반)
   */
  async searchSimilar(query, limitNum = 20, filters = {}) {
    try {
      // 쿼리 임베딩 (실패해도 계속)
      const queryEmbedding = await this.createEmbedding(query);

      // Firestore에서 모든 리뷰 가져오기 (필터 적용)
      const reviews = await firestore.getReviews({
        ...filters,
        limit: 100 // 먼저 100개 가져와서 클라이언트에서 유사도 계산
      });

      console.log(`🔍 Searching ${reviews.length} reviews for: "${query}"`);

      // 임베딩이 없으면 키워드 기반 검색으로 대체
      if (!queryEmbedding) {
        console.log('⚠️  Embedding unavailable, using keyword-based search');
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
        
        // 키워드가 없으면 모든 리뷰 반환
        if (queryWords.length === 0) {
          return reviews.slice(0, limitNum);
        }
        
        const keywordMatches = reviews.filter(r => {
          const title = (r.title || '').toLowerCase();
          const content = (r.contentMd || '').substring(0, 2000).toLowerCase(); // 처음 2000자
          
          // 키워드 중 하나라도 포함되면 매칭
          const matches = queryWords.some(word => 
            title.includes(word) || content.includes(word)
          );
          
          return matches;
        });
        
        console.log(`   Found ${keywordMatches.length} matches`);
        
        // 매칭 개수로 정렬
        keywordMatches.sort((a, b) => {
          const aTitle = (a.title || '').toLowerCase();
          const aContent = (a.contentMd || '').substring(0, 2000).toLowerCase();
          const bTitle = (b.title || '').toLowerCase();
          const bContent = (b.contentMd || '').substring(0, 2000).toLowerCase();
          
          const aMatches = queryWords.filter(w => aTitle.includes(w) || aContent.includes(w)).length;
          const bMatches = queryWords.filter(w => bTitle.includes(w) || bContent.includes(w)).length;
          
          return bMatches - aMatches;
        });
        
        return keywordMatches.slice(0, limitNum);
      }

      // 임베딩이 있는 리뷰만 필터링
      const reviewsWithEmbedding = reviews.filter(r => r.embedding && r.embedding.length > 0);

      if (reviewsWithEmbedding.length === 0) {
        // 임베딩이 없으면 키워드 기반 검색
        const queryLower = query.toLowerCase();
        const keywordMatches = reviews.filter(r => {
          const title = (r.title || '').toLowerCase();
          const content = (r.contentMd || '').toLowerCase();
          return title.includes(queryLower) || content.includes(queryLower);
        });
        return keywordMatches.slice(0, limitNum);
      }

      // 유사도 계산
      const withSimilarity = reviewsWithEmbedding.map(review => ({
        ...review,
        similarity: this.cosineSimilarity(queryEmbedding, review.embedding)
      }));

      // 유사도 순 정렬
      withSimilarity.sort((a, b) => b.similarity - a.similarity);

      // 상위 N개 반환
      return withSimilarity.slice(0, limitNum);

    } catch (error) {
      console.error('Search failed:', error.message);
      return [];
    }
  }

  /**
   * 종합 답변 생성 (Perplexity 스타일)
   */
  async generateAnswer(query, similarReviews) {
    try {
      // 각 리뷰의 분석 데이터 조회
      const analysesPromises = similarReviews.map(r => 
        firestore.getAnalysisByReviewId(r.id)
      );
      const analyses = (await Promise.all(analysesPromises)).filter(Boolean);

      // 프롬프트 구성
      const context = analyses.map((a, idx) => `
[출처 ${idx + 1}] ${similarReviews[idx].title}
작성자: ${similarReviews[idx].author || '익명'}
날짜: ${similarReviews[idx].publishedAt?.toDate?.()?.toISOString().split('T')[0] || 'N/A'}
웨딩홀: ${a.hallName}
장점: ${a.pros?.join(', ') || '없음'}
단점: ${a.cons?.join(', ') || '없음'}
가격: ${JSON.stringify(a.pricing || {})}
`).join('\n');

      const systemPrompt = `당신은 웨딩홀 전문 컨설턴트입니다.

규칙:
1. 여러 후기를 종합하여 객관적이고 균형잡힌 답변 제공
2. 모든 주장에 반드시 [출처 번호] 표기 (예: [1], [2])
3. 가격/시설/서비스 정보는 표 형식으로 정리
4. 장단점은 최대 3개씩만 핵심 요약
5. 추천 웨딩홀은 최대 3곳
6. 마크다운 형식 사용 (##, ###, |표|)
7. 답변 끝에 "## 참고 후기" 섹션 추가`;

      const userPrompt = `질문: ${query}

참고 후기:
${context}

위 정보를 바탕으로 답변해주세요.`;

      // REST API 직접 호출
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          tools: [{ googleSearchRetrieval: {} }],
          generationConfig: { responseMimeType: 'text/plain' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const answer = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!answer) {
        throw new Error('AI 응답이 없습니다.');
      }

      // 출처 정보 구성
      const sources = analyses.map((a, idx) => ({
        index: idx + 1,
        title: similarReviews[idx].title,
        url: similarReviews[idx].sourceUrl,
        author: similarReviews[idx].author,
        publishedAt: similarReviews[idx].publishedAt?.toDate?.() || null,
        hallName: a.hallName
      }));

      return {
        answer,
        sources,
        totalReviews: analyses.length
      };

    } catch (error) {
      console.error('Answer generation failed:', error.message);
      throw error;
    }
  }

  /**
   * 웨딩홀 캐시 업데이트
   */
  async updateHallCache(hallName) {
    try {
      const analyses = await firestore.getAnalysesByHall(hallName, 100);
      
      if (analyses.length === 0) return;

      // 통계 계산
      const totalReviews = analyses.length;
      
      // 신뢰도 평균 (리뷰에서)
      const reviewIds = analyses.map(a => a.reviewId).filter(Boolean);
      if (reviewIds.length === 0) {
        return; // 리뷰가 없으면 스킵
      }
      const reviewsPromises = reviewIds.map(id => firestore.getReview(id));
      const reviews = (await Promise.all(reviewsPromises)).filter(Boolean);
      
      const avgTrustScore = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.trustScore || 0), 0) / reviews.length
        : 0;

      // 최근 후기 날짜
      const lastReviewedAt = reviews
        .map(r => r.publishedAt?.toDate?.() || new Date(0))
        .sort((a, b) => b - a)[0];

      // pros/cons 집계
      const allPros = analyses.flatMap(a => a.pros || []);
      const allCons = analyses.flatMap(a => a.cons || []);
      
      // 빈도수 계산
      const prosCount = {};
      const consCount = {};
      
      allPros.forEach(p => prosCount[p] = (prosCount[p] || 0) + 1);
      allCons.forEach(c => consCount[c] = (consCount[c] || 0) + 1);
      
      const topPros = Object.entries(prosCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key]) => key);
      
      const topCons = Object.entries(consCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key]) => key);

      // 캐시 저장
      await firestore.saveHallCache(hallName, {
        totalReviews,
        avgTrustScore,
        topPros,
        topCons,
        lastReviewedAt
      });

      console.log(`✅ Cache updated for: ${hallName}`);

    } catch (error) {
      console.error('Cache update failed:', error.message);
    }
  }
}

export default new GeminiAnalyzer();
