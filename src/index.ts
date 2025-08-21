import 'dotenv/config';

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { startFlowServer } from '@genkit-ai/express';

// 진짜로 키가 들어왔는지 확인(1~6글자만)
console.log('[ENV] GOOGLE_API_KEY prefix =', (process.env.GOOGLE_API_KEY || '').slice(0,6));

const ai = genkit({
  // <-- 여기서 apiKey를 명시적으로 전달
  plugins: [googleAI({ apiKey: process.env.GOOGLE_API_KEY })],
  model: googleAI.model('gemini-2.5-flash'),
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

const MenuItemSchema = z.object({
  dishname: z.string(),
  description: z.string(),
});

// === 인용구 데이터셋(한국어 번역) ===
const QUOTES = [
  {
    author: '찰스 디킨스',
    source: '두 도시 이야기',
    emotion: ['밝음', '양가감정', '희망', '덧없음'],
    quote: '그것은 최고의 시대였고, 그것은 최악의 시대였다.'
  },
  {
    author: '레오 톨스토이',
    source: '안나 카레니나',
    emotion: ['평온', '행복', '가정', '안정', '성찰'],
    quote: '행복한 가정은 모두 비슷하지만, 불행한 가정은 저마다 다르다.'
  },
  {
    author: 'F. 스콧 피츠제럴드',
    source: '위대한 개츠비',
    emotion: ['향수', '체념', '피로', '월요일', '시간'],
    quote: '우리는 계속 앞으로 나아간다, 거대한 강물의 흐름을 거슬러, 끝내는 과거로 떠밀려가면서.'
  },
  {
    author: '어니스트 헤밍웨이',
    source: '노인과 바다',
    emotion: ['투지', '의지', '도전', '역경', '끈기'],
    quote: '인간은 패배하도록 만들어지지 않았다. 인간은 파괴될 수는 있어도, 패배하지는 않는다.'
  },
  {
    author: '가브리엘 가르시아 마르케스',
    source: '백년 동안의 고독',
    emotion: ['향수', '기억', '따스함', '쓸쓸함'],
    quote: '많은 해 뒤에, 총살 부대 앞에 서서, 아우렐리아노 부엔디아 대령은 아버지에게 얼음을 보여주었던 저 먼 오후를 떠올리게 될 것이다.'
  },
];

// === 출력 스키마 ===
const QuoteMatchSchema = z.object({
  input: z.string(),
  chosenIndex: z.number().int().min(0).max(QUOTES.length - 1),
  reason: z.string(),
  quote: z.object({
    author: z.string(),
    source: z.string(),
    quote: z.string(),
    emotion: z.array(z.string())
  })
});

// === Flow 정의: 자연어 -> 인용구 매칭 ===
export const quoteMatchFlow = ai.defineFlow(
  {
    name: 'quoteMatchFlow',
    inputSchema: z.string(),           // 예: "오늘 하늘이 좋다."
    outputSchema: QuoteMatchSchema,    // 구조화 반환
  },
  async (inputText) => {
    // 모델에 선택을 맡기되, "반드시 아래 목록 중 인덱스로 선택"하도록 지시
    const system = [
      '너는 인용구를 이용한 감정 큐레이터다.',
      '아래 인용구 목록(0..N-1) 중에서 입력 문장에 가장 잘 어울리는 하나를 고른다.',
      '반드시 JSON으로만 응답하고, keys는 input, chosenIndex, reason 이다.',
      'chosenIndex는 정수이며 인용구 배열의 인덱스여야 한다.',
    ].join('\n');

    const optionsText = QUOTES
      .map((q, i) => `${i}. [${q.author} / ${q.source}] ${q.quote} (tags: ${q.emotion.join(', ')})`)
      .join('\n');

    const prompt = [
      system,
      '--- 인용구 목록 ---',
      optionsText,
      '--- 입력 문장 ---',
      inputText,
      '--- 출력 형식(JSON) ---',
      '{ "input": "<원문 그대로>", "chosenIndex": <number>, "reason": "<간단한 이유>" }'
    ].join('\n');

    const resp = await ai.generate({ prompt });

// resp.text가 함수일 수도, 문자열일 수도 있으므로 안전하게 처리
const rawText = typeof resp.text === 'function' ? resp.text() : resp.text;

// 혹시 비었으면 예외
if (!rawText) throw new Error('Empty text response from model');

    const match = rawText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : '{}');

    const idx = Math.max(0, Math.min(QUOTES.length - 1, Number(parsed.chosenIndex)));
    const result = {
      input: String(parsed.input ?? inputText),
      chosenIndex: idx,
      reason: String(parsed.reason ?? '문맥 유사성에 기반한 선택'),
      quote: QUOTES[idx],
    };

    return QuoteMatchSchema.parse(result);
  }
);

export const menuSuggestionFlow = ai.defineFlow(
  {
    name: 'menuSuggestionFlow',
    inputSchema: z.object({ theme: z.string() }),
    outputSchema: MenuItemSchema,
  },
  async ({ theme }) => {
    const { output } = await ai.generate({
      prompt: `Invent a realistic menu item for a ${theme} themed restaurant.`,
      output: { schema: MenuItemSchema },
    });
    if (!output) throw new Error('Empty output');
    return output;
  }
);

startFlowServer({ flows: [menuSuggestionFlow, quoteMatchFlow], port: Number(process.env.PORT || 3400) });