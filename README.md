# 웨딩홀 후기 통합검색 사이트

Next.js + Firebase + Gemini AI로 구축한 웨딩홀 후기 통합 검색 플랫폼입니다.

## 기술 스택

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Firebase Firestore
- **AI**: Google Gemini AI (요약 생성)
- **크롤링**: Cheerio
- **배포**: Vercel

## 주요 기능

- 🔍 웨딩홀 통합 검색
- 📝 실시간 후기 크롤링 (네이버, 다음 등)
- 🤖 AI 자동 요약 (Gemini)
- 🎯 지역별 필터링
- 💰 Google AdSense 통합

## 시작하기

### 1. 의존성 설치

\`\`\`bash
npm install
\`\`\`

### 2. 환경변수 설정

\`.env.local\` 파일을 생성하고 다음 내용을 입력하세요:

\`\`\`env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google AI (Gemini)
GOOGLE_AI_API_KEY=your_gemini_api_key

# Google AdSense
NEXT_PUBLIC_ADSENSE_CLIENT_ID=your_adsense_client_id
\`\`\`

### 3. Firebase 초기 데이터 설정

개발 서버를 시작한 후:

\`\`\`bash
npm run dev
\`\`\`

브라우저에서 다음 URL에 접속하여 초기 웨딩홀 데이터를 설정:

\`\`\`
http://localhost:3000/api/init-halls
\`\`\`

### 4. 개발 서버 실행

\`\`\`bash
npm run dev
\`\`\`

http://localhost:3000 에서 확인하세요.

## 데이터 구조

### Firestore Collections

#### weddingHalls
- 웨딩홀 기본 정보
- 이름, 지역, 주소, 전화번호, 수용 인원, 가격대

#### reviews
- 크롤링된 후기
- 출처, URL, 원본 제목, AI 요약, 키워드

#### scrapeLogs
- 크롤링 로그
- 상태, 수집 개수, 실행 시간

## 배포

### Vercel 배포

\`\`\`bash
npm run build
vercel --prod
\`\`\`

### 환경변수 설정

Vercel 대시보드에서 환경변수를 설정하세요.

## 주의사항

### 크롤링 관련
- robots.txt 준수
- Rate limiting (2초 간격)
- 과도한 요청 방지

### 법적 고려사항
- 원본 링크 명시
- 요약만 표시 (전문 게재 금지)
- 저작권 준수

### Google AdSense
- 클릭 유도 금지
- 자연스러운 광고 배치
- 정책 준수

## 라이선스

MIT

## 문의

이슈나 질문이 있으시면 GitHub Issues를 이용해주세요.
