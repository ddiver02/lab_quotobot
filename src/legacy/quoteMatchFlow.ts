// src/legacy/quoteMatchFlow.ts
import { z } from 'genkit';
import { ai } from '../services/genkit';
import { QUOTES } from '../data/quotes';

const QuoteMatchSchema = z.object({
  input: z.string(),
  chosenIndex: z
    .number()
    .int()
    .min(0)
    .max(Math.max(0, QUOTES.length - 1)),
  reason: z.string(),
  quote: z.object({
    author: z.string(),
    source: z.string(),
    quote: z.string(),
    emotion: z.array(z.string()),
  }),
});

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

    const optionsText = QUOTES.map(
      (q, i) =>
        `${i}. [${q.author} / ${q.source}] ${q.quote} (tags: ${q.emotion.join(', ')})`
    ).join('\n');

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

    let rawText: unknown = (resp as any).text;
    if (typeof rawText === 'function') rawText = (rawText as () => string)();
    if (typeof rawText !== 'string')
      rawText = String((resp as any).output_text ?? '');
    const safeText = ((rawText as string) || '').trim();

    let parsed: any = {};
    if (safeText) {
      try {
        const match = safeText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(match ? match[0] : '{}');
      } catch {
        parsed = {};
      }
    }

    const idx = Number.isFinite(Number(parsed.chosenIndex))
      ? Math.max(0, Math.min(QUOTES.length - 1, Number(parsed.chosenIndex)))
      : 0;

    const result = {
      input: String(parsed.input ?? inputText),
      chosenIndex: idx,
      reason: String(parsed.reason ?? '기본값: 모델 응답이 빈 경우 안전 선택'),
      quote: QUOTES[idx],
    };

    return QuoteMatchSchema.parse(result);
  }
);