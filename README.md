# 🤖 Wedding Review AI (Gemini + Firebase Edition)

AI가 자동으로 웨딩홀 후기를 수집·분석하여 Perplexity처럼 출처와 함께 종합 답변을 제공하는 시스템입니다.

**이 버전은 Google Gemini AI와 Firebase를 사용합니다!**

## ✨ 주요 기능

- 🔍 **자동 크롤링**: 네이버 블로그에서 최신 후기 자동 수집
- 🧠 **Gemini AI 분석**: Google의 최신 AI로 장단점, 가격 정보 추출
- 🔥 **Firebase 저장**: Firestore로 실시간 데이터베이스 관리
- 📊 **벡터 검색**: Gemini 임베딩으로 의미 기반 검색
- 💬 **종합 답변**: Perplexity 스타일로 출처 포함 답변

## 🚀 빠른 시작

### 1. Firebase 프로젝트 설정

Firebase Console(https://console.firebase.google.com)에서:

1. **새 프로젝트 생성**
2. **Firestore Database 활성화**
   - 테스트 모드로 시작
   - 위치 선택 (asia-northeast3 권장)
3. **웹 앱 추가**
   - 설정 정보 복사 (apiKey, projectId 등)
4. **서비스 계정 키 생성**
   - 프로젝트 설정 → 서비스 계정
   - Firebase Admin SDK → 새 비공개 키 생성
   - JSON 파일 다운로드

### 2. Gemini API 키 발급

1. Google AI Studio 접속: https://makersuite.google.com/app/apikey
2. **Get API key** 클릭
3. API 키 복사

### 3. 환경 설정

```bash
# 프로젝트 클론 후
cd wedding-review-ai

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
```

**.env 파일 편집:**

```env
# Gemini API
GEMINI_API_KEY=AIzaSy...  # 위에서 발급받은 키

# Firebase 웹 설정 (Firebase Console에서 복사)
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-app.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Admin (서비스 계정 JSON에서 복사)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 4. 서버 실행

```bash
# 개발 모드
npm run dev

# 프론트엔드: http://localhost:3000
# 백엔드: http://localhost:3001
```

## 📋 Firestore 컬렉션 구조

자동으로 생성됩니다:

- **reviews**: 크롤링한 원본 후기
  - id, sourceUrl, title, contentMd, embedding, trustScore 등
  
- **analysis**: AI 분석 결과
  - reviewId, hallName, pros, cons, pricing, evidence 등
  
- **halls**: 웨딩홀 캐시 (집계 데이터)
  - hallName, totalReviews, topPros, topCons 등
  
- **crawl_jobs**: 크롤링 작업 로그
  - keyword, status, sourcesFound 등
  
- **search_logs**: 검색 쿼리 로그

## 🔧 사용 방법

### 웹 인터페이스

1. `http://localhost:3000` 접속
2. "강남 웨딩홀 추천" 검색
3. AI가 자동으로:
   - 최신 후기 크롤링
   - Gemini로 분석
   - Firebase에 저장
   - 출처와 함께 답변 생성

### CLI 크롤링

```bash
node server/scripts/crawl.js "잠실 웨딩홀" 30
```

### API 직접 호출

```bash
# 검색
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "강남 웨딩홀", "autoCrawl": true}'

# 통계
curl http://localhost:3001/api/stats
```

## 💡 주요 차이점 (vs PostgreSQL 버전)

| 항목 | Gemini + Firebase | OpenAI + PostgreSQL |
|------|-------------------|---------------------|
| AI | Google Gemini | OpenAI GPT-4 |
| DB | Firebase Firestore | PostgreSQL + pgvector |
| 벡터 검색 | 클라이언트 계산 | pgvector ivfflat |
| 설치 | 클라우드 (0 설치) | 로컬 DB 설치 필요 |
| 확장성 | 자동 스케일링 | 수동 관리 |
| 비용 | 무료 티어 넉넉함 | 서버 필요 |

## 📊 Firebase 보안 규칙

Firestore 보안 규칙 설정 권장:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 읽기는 허용, 쓰기는 서버만
    match /{document=**} {
      allow read: if true;
      allow write: if false;  // 서버 SDK만 가능
    }
  }
}
```

## 🔥 Gemini API 할당량

- **무료 티어**: 분당 60 요청
- **임베딩**: 분당 1,500 요청
- 자세한 정보: https://ai.google.dev/pricing

## 🐛 트러블슈팅

### Firebase 연결 오류
```bash
# .env 파일의 FIREBASE_ADMIN_PRIVATE_KEY 확인
# \n이 실제 줄바꿈이 아닌 문자열인지 확인
```

### Gemini API 오류
```bash
# API 키 확인
# 할당량 초과 여부 확인
# 모델 이름 확인: gemini-pro, embedding-001
```

### 크롤링 실패
```bash
# robots.txt 차단 확인
# Rate limit 설정 확인 (기본 2초)
# 네트워크 연결 확인
```

## 📦 배포

### Vercel (권장)

```bash
# 프론트엔드 배포
vercel --prod

# 환경 변수 설정
vercel env add GEMINI_API_KEY
vercel env add FIREBASE_API_KEY
# ... (모든 환경 변수)
```

### Cloud Functions (백엔드)

```bash
# Firebase CLI 설치
npm install -g firebase-tools

# 배포
firebase deploy --only functions
```

## 🤝 기여

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## 📝 라이선스

MIT License

---

## 🎯 다음 단계

- [ ] 네이버 카페 크롤러 추가
- [ ] 웨딩21, 웨프 크롤러 추가
- [ ] 이미지 OCR 분석
- [ ] 실시간 알림 기능
- [ ] 비교표 자동 생성

⭐ **Gemini AI + Firebase로 더 쉽고 빠르게!**
