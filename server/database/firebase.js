import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Firebase Admin SDK 초기화 (서버용)
let adminDb;
try {
  // 이미 초기화되어 있으면 스킵
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  }
  adminDb = admin.firestore();
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  throw error; // Admin SDK는 필수이므로 실패 시 에러 발생
}

// Firestore 컬렉션 참조
const collections = {
  reviews: 'reviews',
  analysis: 'analysis',
  halls: 'halls',
  crawlJobs: 'crawl_jobs',
  searchLogs: 'search_logs'
};

/**
 * Firestore Helper Functions
 */
class FirestoreHelper {
  constructor() {
    if (!adminDb) {
      throw new Error('Firebase Admin SDK not initialized');
    }
    this.db = adminDb;
  }

  // 리뷰 저장
  async saveReview(reviewData) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const docRef = this.db.collection(collections.reviews).doc(reviewData.id);
    
    // undefined 값 제거 및 데이터 정리
    const cleanData = {};
    for (const [key, value] of Object.entries(reviewData)) {
      if (value !== undefined && value !== null) {
        cleanData[key] = value;
      }
    }
    
    // publishedAt이 Date 객체면 Timestamp로 변환
    if (cleanData.publishedAt instanceof Date) {
      cleanData.publishedAt = admin.firestore.Timestamp.fromDate(cleanData.publishedAt);
    }
    
    // 타임스탬프 추가
    cleanData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    cleanData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await docRef.set(cleanData);
    return reviewData.id;
  }

  // 리뷰 조회
  async getReview(reviewId) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const docRef = this.db.collection(collections.reviews).doc(reviewId);
    const docSnap = await docRef.get();
    return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  // 리뷰 목록 조회
  async getReviews(filters = {}) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    let q = this.db.collection(collections.reviews);
    
    // 필터 적용
    if (filters.platform) {
      q = q.where('sourcePlatform', '==', filters.platform);
    }
    
    if (filters.minTrustScore) {
      q = q.where('trustScore', '>=', filters.minTrustScore);
    }

    if (filters.dateFrom) {
      q = q.where('publishedAt', '>=', admin.firestore.Timestamp.fromDate(new Date(filters.dateFrom)));
    }

    if (filters.dateTo) {
      q = q.where('publishedAt', '<=', admin.firestore.Timestamp.fromDate(new Date(filters.dateTo)));
    }

    // 정렬 없이 limit만 적용 (인덱스 문제 방지)
    
    // 제한
    if (filters.limit) {
      q = q.limit(filters.limit);
    }
    
    const querySnapshot = await q.get();
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // URL로 리뷰 검색
  async getReviewByUrl(url) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const q = this.db.collection(collections.reviews)
      .where('sourceUrl', '==', url)
      .limit(1);
    const querySnapshot = await q.get();
    return querySnapshot.empty ? null : { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
  }

  // 분석 저장
  async saveAnalysis(analysisData) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const docRef = this.db.collection(collections.analysis).doc(analysisData.id);
    await docRef.set({
      ...analysisData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return analysisData.id;
  }

  // 리뷰 ID로 분석 조회
  async getAnalysisByReviewId(reviewId) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const q = this.db.collection(collections.analysis)
      .where('reviewId', '==', reviewId)
      .limit(1);
    const querySnapshot = await q.get();
    return querySnapshot.empty ? null : { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
  }

  // 웨딩홀별 분석 조회
  async getAnalysesByHall(hallName, limitNum = 20) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const q = this.db.collection(collections.analysis)
      .where('hallName', '==', hallName)
      .orderBy('analyzedAt', 'desc')
      .limit(limitNum);
    const querySnapshot = await q.get();
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // 웨딩홀 캐시 저장/업데이트
  async saveHallCache(hallName, cacheData) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const docRef = this.db.collection(collections.halls).doc(hallName);
    await docRef.set({
      ...cacheData,
      hallName,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // 웨딩홀 캐시 조회
  async getHallCache(hallName) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const docRef = this.db.collection(collections.halls).doc(hallName);
    const docSnap = await docRef.get();
    return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  // 웨딩홀 목록 조회
  async getHalls(filters = {}) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    let q = this.db.collection(collections.halls);

    if (filters.region) {
      q = q.where('region', '==', filters.region);
    }

    if (filters.minReviews) {
      q = q.where('totalReviews', '>=', filters.minReviews);
    }

    // 정렬
    const sortField = filters.sort === 'trust' ? 'avgTrustScore' : 
                     filters.sort === 'recent' ? 'lastReviewedAt' : 
                     'totalReviews';
    q = q.orderBy(sortField, 'desc').limit(50);

    const querySnapshot = await q.get();
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // 크롤링 작업 저장
  async saveCrawlJob(jobData) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const docRef = this.db.collection(collections.crawlJobs).doc(jobData.id);
    await docRef.set({
      ...jobData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return jobData.id;
  }

  // 크롤링 작업 업데이트
  async updateCrawlJob(jobId, updates) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const docRef = this.db.collection(collections.crawlJobs).doc(jobId);
    await docRef.update(updates);
  }

  // 크롤링 작업 조회
  async getCrawlJob(jobId) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const docRef = this.db.collection(collections.crawlJobs).doc(jobId);
    const docSnap = await docRef.get();
    return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  // 검색 로그 저장
  async saveSearchLog(logData) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const docRef = this.db.collection(collections.searchLogs).doc();
    await docRef.set({
      ...logData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // 통계 조회
  async getStats() {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }
    const [reviewsSnap, hallsSnap, jobsSnap] = await Promise.all([
      this.db.collection(collections.reviews).get(),
      this.db.collection(collections.halls).get(),
      this.db.collection(collections.crawlJobs).where('status', '==', 'completed').get()
    ]);

    // 평균 신뢰도 계산
    const reviews = reviewsSnap.docs.map(doc => doc.data());
    const avgTrustScore = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.trustScore || 0), 0) / reviews.length
      : 0;

    return {
      totalReviews: reviewsSnap.size,
      totalHalls: hallsSnap.size,
      completedJobs: jobsSnap.size,
      avgTrustScore
    };
  }
}

export { adminDb, collections, FirestoreHelper };
export default new FirestoreHelper();
