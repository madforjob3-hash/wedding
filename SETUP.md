# 🚀 웨딩홀 리뷰 AI - 설치 가이드

## ✅ 완료된 작업

1. ✅ 프로젝트 복사 완료
2. ✅ npm 의존성 설치 완료
3. ✅ 기본 .env 파일 생성
4. ✅ Git 저장소 초기화

---

## 🔧 다음 단계: Firebase Admin SDK 설정

### 1. Firebase Console에서 서비스 계정 키 생성

1. **Firebase Console 접속**: https://console.firebase.google.com
2. 프로젝트 선택: `gen-lang-client-0652583986`
3. ⚙️ 프로젝트 설정 → **서비스 계정** 탭
4. **새 비공개 키 생성** 클릭
5. JSON 파일 다운로드

### 2. .env 파일에 정보 추가

다운로드한 JSON 파일을 열고 다음 정보를 복사:

```env
# .env 파일 열기
# 아래 두 줄을 실제 값으로 교체:

FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@gen-lang-client-0652583986.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n실제키내용\n-----END PRIVATE KEY-----\n"
```

**주의사항**:
- `FIREBASE_ADMIN_PRIVATE_KEY`는 반드시 **큰따옴표("")**로 감싸야 함
- `\n`은 그대로 유지 (실제 줄바꿈이 아님)

---

## 🏃 실행 방법

### 개발 모드 (프론트+백엔드 동시 실행)

```bash
cd /Users/isanghyeog/Documents/웨딩검색
npm run dev
```

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:3001

### 프론트만 실행

```bash
npm run client
```

### 백엔드만 실행

```bash
npm run server
```

### 크롤링 테스트

```bash
npm run crawl "강남 웨딩홀" 10
```

---

## 📊 주요 기능

### 1. 자동 크롤링
- 네이버 블로그 자동 검색
- Puppeteer로 동적 페이지 크롤링
- robots.txt 준수 (2초 딜레이)

### 2. Gemini AI 분석
- 장단점 자동 추출
- 가격 정보 분석
- 신뢰도 점수 계산

### 3. Firebase 저장
- 원본 후기: `reviews` 컬렉션
- AI 분석: `analysis` 컬렉션
- 집계 데이터: `halls` 컬렉션

### 4. Perplexity 스타일 답변
- 출처 포함 종합 답변
- Citation 번호 [1][2]
- 법적 고지사항 자동 표시

---

## 🐛 문제 해결

### Firebase Admin 연결 오류

```bash
# .env 파일 확인
cat .env | grep FIREBASE_ADMIN

# PRIVATE_KEY에 \n이 있는지 확인
```

### 크롤링 실패

```bash
# robots.txt 확인
curl https://blog.naver.com/robots.txt

# Rate limit 확인 (server/crawler/utils.js)
```

### 포트 충돌

```bash
# 포트 변경
# .env 파일에서 PORT=3001 → PORT=다른번호
```

---

## 📦 배포 (선택사항)

### Vercel (프론트엔드)

```bash
npm install -g vercel
vercel --prod
```

### Cloud Run (백엔드)

```bash
gcloud run deploy wedding-api \
  --source=./server \
  --region=asia-northeast3
```

---

## 🎯 다음 작업

- [ ] Firebase Admin SDK 키 설정
- [ ] `npm run dev` 실행 테스트
- [ ] "강남 웨딩홀" 검색 테스트
- [ ] 크롤링 결과 Firestore에서 확인

---

**질문이 있으시면 언제든 물어보세요!** 🚀
