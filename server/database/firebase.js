import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Firebase Client SDK 초기화 (프론트엔드용)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Firebase Admin SDK 초기화 (서버용)
let adminDb;
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
  adminDb = admin.firestore();
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.warn('⚠️  Firebase Admin initialization failed, using client SDK only');
  adminDb = db;
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
    this.db = adminDb;
  }

  // 리뷰 저장
  async saveReview(reviewData) {
    const docRef = doc(this.db, collections.reviews, reviewData.id);
    await setDoc(docRef, {
      ...reviewData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    return reviewData.id;
  }

  // 리뷰 조회
  async getReview(reviewId) {
    const docRef = doc(this.db, collections.reviews, reviewId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  // 리뷰 목록 조회
  async getReviews(filters = {}) {
    let q = collection(this.db, collections.reviews);
    
    // 필터 적용
    const constraints = [];
    
    if (filters.platform) {
      constraints.push(where('sourcePlatform', '==', filters.platform));
    }
    
    if (filters.minTrustScore) {
      constraints.push(where('trustScore', '>=', filters.minTrustScore));
    }

    if (filters.dateFrom) {
      constraints.push(where('publishedAt', '>=', Timestamp.fromDate(new Date(filters.dateFrom))));
    }

    if (filters.dateTo) {
      constraints.push(where('publishedAt', '<=', Timestamp.fromDate(new Date(filters.dateTo))));
    }

    // 정렬
    constraints.push(orderBy('publishedAt', 'desc'));
    
    // 제한
    if (filters.limit) {
      constraints.push(limit(filters.limit));
    }

    q = query(q, ...constraints);
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // URL로 리뷰 검색
  async getReviewByUrl(url) {
    const q = query(
      collection(this.db, collections.reviews),
      where('sourceUrl', '==', url),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty ? null : { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
  }

  // 분석 저장
  async saveAnalysis(analysisData) {
    const docRef = doc(this.db, collections.analysis, analysisData.id);
    await setDoc(docRef, {
      ...analysisData,
      createdAt: Timestamp.now()
    });
    return analysisData.id;
  }

  // 리뷰 ID로 분석 조회
  async getAnalysisByReviewId(reviewId) {
    const q = query(
      collection(this.db, collections.analysis),
      where('reviewId', '==', reviewId),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty ? null : { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
  }

  // 웨딩홀별 분석 조회
  async getAnalysesByHall(hallName, limitNum = 20) {
    const q = query(
      collection(this.db, collections.analysis),
      where('hallName', '==', hallName),
      orderBy('analyzedAt', 'desc'),
      limit(limitNum)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // 웨딩홀 캐시 저장/업데이트
  async saveHallCache(hallName, cacheData) {
    const docRef = doc(this.db, collections.halls, hallName);
    await setDoc(docRef, {
      ...cacheData,
      hallName,
      lastUpdated: Timestamp.now()
    }, { merge: true });
  }

  // 웨딩홀 캐시 조회
  async getHallCache(hallName) {
    const docRef = doc(this.db, collections.halls, hallName);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  // 웨딩홀 목록 조회
  async getHalls(filters = {}) {
    let q = collection(this.db, collections.halls);
    const constraints = [];

    if (filters.region) {
      constraints.push(where('region', '==', filters.region));
    }

    if (filters.minReviews) {
      constraints.push(where('totalReviews', '>=', filters.minReviews));
    }

    // 정렬
    const sortField = filters.sort === 'trust' ? 'avgTrustScore' : 
                     filters.sort === 'recent' ? 'lastReviewedAt' : 
                     'totalReviews';
    constraints.push(orderBy(sortField, 'desc'));
    constraints.push(limit(50));

    q = query(q, ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // 크롤링 작업 저장
  async saveCrawlJob(jobData) {
    const docRef = doc(this.db, collections.crawlJobs, jobData.id);
    await setDoc(docRef, {
      ...jobData,
      createdAt: Timestamp.now()
    });
    return jobData.id;
  }

  // 크롤링 작업 업데이트
  async updateCrawlJob(jobId, updates) {
    const docRef = doc(this.db, collections.crawlJobs, jobId);
    await updateDoc(docRef, updates);
  }

  // 크롤링 작업 조회
  async getCrawlJob(jobId) {
    const docRef = doc(this.db, collections.crawlJobs, jobId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  // 검색 로그 저장
  async saveSearchLog(logData) {
    const docRef = doc(collection(this.db, collections.searchLogs));
    await setDoc(docRef, {
      ...logData,
      createdAt: Timestamp.now()
    });
  }

  // 통계 조회
  async getStats() {
    const [reviewsSnap, hallsSnap, jobsSnap] = await Promise.all([
      getDocs(collection(this.db, collections.reviews)),
      getDocs(collection(this.db, collections.halls)),
      getDocs(query(collection(this.db, collections.crawlJobs), where('status', '==', 'completed')))
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

export { db, adminDb, collections, FirestoreHelper };
export default new FirestoreHelper();
