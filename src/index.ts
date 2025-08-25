import 'dotenv/config';
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import express from 'express';
import { QUOTES } from "./data/quotes"

// 🔎 키 프리픽스 확인(디버그용)
console.log('[ENV] GOOGLE_API_KEY prefix =', (process.env.GOOGLE_API_KEY || '').slice(0, 6));

// ─────────────────────────────────────────────
// Genkit 초기화
// ─────────────────────────────────────────────
const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_API_KEY || '' })],
  model: googleAI.model('gemini-2.5-flash'),
});

// ─────────────────────────────────────────────
 // 데이터셋 & 스키마
// ─────────────────────────────────────────────

const QuoteMatchSchema = z.object({
  input: z.string(),
  chosenIndex: z.number().int().min(0).max(QUOTES.length - 1),
  reason: z.string(),
  quote: z.object({
    author: z.string(),
    source: z.string(),
    quote: z.string(),
    emotion: z.array(z.string()),
  }),
});

// ─────────────────────────────────────────────
// Flow: 입력 문장에 어울리는 인용구 매칭
// ─────────────────────────────────────────────
export const quoteMatchFlow = ai.defineFlow(
  {
    name: 'quoteMatchFlow',
    inputSchema: z.string(),
    outputSchema: QuoteMatchSchema,
  },
  async (inputText) => {
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
      '{ "input": "<원문 그대로>", "chosenIndex": <number>, "reason": "<간단한 이유>" }',
    ].join('\n');

    const resp = await ai.generate({ prompt });

    // ✅ resp.text 안전 처리 (getter/함수/문자열 모든 케이스 대응)
    let rawText: unknown = (resp as any).text;
    if (typeof rawText === 'function') rawText = (rawText as () => string)();
    if (typeof rawText !== 'string') rawText = String((resp as any).output_text ?? '');
    if (!rawText) throw new Error('Empty text response from model');

    const match = (rawText as string).match(/\{[\s\S]*\}/);
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

// ─────────────────────────────────────────────
// Express 서버 (Cloud Run은 PORT=8080 제공) {💥외워!}
// ─────────────────────────────────────────────
const app = express();
app.use(express.json());

// 헬스체크
app.get('/', (_req, res) => {
  res.status(200).send('genkit-rag is running');
});

// ✨ 커스텀 API: /api/quote  (input: string)
app.post('/api/quote', async (req, res) => {
  try {
    const input = req.body?.input;
    if (typeof input !== 'string' || !input.trim()) {
      return res.status(400).json({ error: 'input must be a non-empty string' });
    }
    const out = await quoteMatchFlow(input);
    return res.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`[BOOT] Starting Genkit flow server on :${port}`);
  console.log(`[READY] Genkit flow server is listening on :${port}`);
});