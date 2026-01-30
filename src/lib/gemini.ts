import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

/**
 * 웨딩홀 후기 제목을 한줄로 요약
 */
export async function summarizeReviewTitle(originalTitle: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
다음 웨딩홀 후기 제목을 20자 이내의 핵심 키워드 중심 한줄로 요약해주세요.
긍정/부정 포인트를 명확히 드러내주세요.

제목: ${originalTitle}

요약 형식 예시:
- "음식 맛있고 직원 친절, 주차 불편"
- "가격 저렴하나 시설 노후"
- "뷰 끝내주고 음식 최고급"

20자 이내로 요약:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text().trim();

    return summary.substring(0, 30); // 최대 30자로 제한
  } catch (error) {
    console.error('Gemini 요약 생성 실패:', error);
    return originalTitle.substring(0, 30); // 실패 시 원본 제목 일부 반환
  }
}

/**
 * 배치로 여러 후기 제목을 한 번에 요약 (비용 절감)
 */
export async function batchSummarizeReviews(titles: string[]): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
다음 웨딩홀 후기 제목들을 각각 20자 이내의 핵심 키워드로 요약해주세요.
긍정/부정 포인트를 명확히 드러내주세요.

${titles.map((title, idx) => `${idx + 1}. ${title}`).join('\n')}

응답 형식 (JSON):
[
  "음식 맛있고 직원 친절, 주차 불편",
  "가격 저렴하나 시설 노후",
  ...
]
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    // JSON 파싱
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const summaries = JSON.parse(jsonMatch[0]);
      return summaries.map((s: string) => s.substring(0, 30));
    }

    // 파싱 실패 시 개별 요약
    return Promise.all(titles.map(title => summarizeReviewTitle(title)));
  } catch (error) {
    console.error('배치 요약 실패:', error);
    // 실패 시 개별 요약으로 폴백
    return Promise.all(titles.map(title => summarizeReviewTitle(title)));
  }
}
