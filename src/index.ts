// genkit-demo/src/index.ts
import 'dotenv/config';
import express from 'express';

import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

import { QUOTES } from './data/quotes';

// ─────────────────────────────────────────────
// Supabase & Embedding
// ─────────────────────────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Env
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  '';
const GENAI_KEY = process.env.GOOGLE_API_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[WARN] Missing Supabase server envs. Check SUPABASE_URL / SERVICE_ROLE_KEY'
  );
}
if (!GENAI_KEY) {
  console.warn('[WARN] Missing GOOGLE_API_KEY for embeddings.');
}

// Lazy singletons
let supabaseAdmin: SupabaseClient | null = null;
let genAIClient: GoogleGenerativeAI | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase envs (SUPABASE_URL / SERVICE_ROLE_KEY)');
    }
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabaseAdmin;
}

function getGenAI(): GoogleGenerativeAI {
  if (!genAIClient) {
    if (!GENAI_KEY) {
      throw new Error('Missing GOOGLE_API_KEY');
    }
    genAIClient = new GoogleGenerativeAI(GENAI_KEY);
  }
  return genAIClient;
}

// ─────────────────────────────────────────────
// Genkit init (모델: gemini-2.5-flash)
// ─────────────────────────────────────────────
console.log(
  '[ENV] GOOGLE_API_KEY prefix =',
  (process.env.GOOGLE_API_KEY || '').slice(0, 6)
);

const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_API_KEY || '' })],
  model: googleAI.model('gemini-2.5-flash'),
});

// ─────────────────────────────────────────────
// 벡터 검색 유틸
// ─────────────────────────────────────────────
const EMB_MODEL = 'text-embedding-004'; // 768D
const TOP_K = Number(process.env.RAG_TOP_K ?? 5);
const MATCH_THRESHOLD = Number(process.env.RAG_MATCH_THRESHOLD ?? 0.15);

type CandidateRow = {
  id: number;
  quote: string;
  author: string;
  source: string;
  similarity: number;
};

async function embedText(text: string): Promise<number[]> {
  const model = getGenAI().getGenerativeModel({ model: EMB_MODEL });
  const { embedding } = await model.embedContent(text);
  return embedding?.values ?? [];
}

async function findCandidates(vec: number[]): Promise<CandidateRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('match_quote_embeddings', {
    query_embedding: vec,
    match_threshold: MATCH_THRESHOLD,
    match_count: TOP_K,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CandidateRow[];
}

// ─────────────────────────────────────────────
// LLM 재랭킹: 모드 톤 반영해 Top-K 중 최종 1개 선택
// ─────────────────────────────────────────────
async function rerankWithMode(
  mode: 'harsh' | 'comfort',
  input: string,
  candidates: { quote: string; author: string; source: string }[]
): Promise<{ quote: string; author: string; source: string } | null> {
  const tone =
    mode === 'harsh'
      ? '너는 직설적이고 현실적인 쓴소리 큐레이터다. 각성/도전/강인함 톤의 문장을 우선한다.'
      : '너는 다정하고 공감적인 위로 큐레이터다. 위로/공감/희망/연대 톤의 문장을 우선한다.';

  const list = candidates
    .map((c, i) => `${i}. [${c.author} / ${c.source}] ${c.quote}`)
    .join('\n');

  const prompt = [
    tone,
    '다음 후보 목록(0..N-1) 중 사용자 입력에 가장 어울리는 1개를 고른다.',
    '반드시 JSON으로만 답하라: { "index": <number>, "reason": "..." }',
    '',
    '--- 후보 ---',
    list,
    '',
    '--- 입력 ---',
    input,
    '',
    '--- 출력 형식(JSON) ---',
    '{ "index": 0, "reason": "간결한 이유" }',
  ].join('\n');

  const r = await ai.generate({ prompt });

  let raw: unknown = (r as any).text;
  if (typeof raw === 'function') raw = (raw as () => string)();
  if (typeof raw !== 'string') raw = String((r as any).output_text ?? '');
  if (!raw) return null;

  const m = (raw as string).match(/\{[\s\S]*\}/);
  if (!m) return null;

  try {
    const parsed = JSON.parse(m[0]) as { index: number; reason?: string };
    const idx = Math.max(0, Math.min(candidates.length - 1, Number(parsed.index)));
    return candidates[idx];
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 레거시 Flow (보존용)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Express (Cloud Run: PORT=8080)
// ─────────────────────────────────────────────
const app = express();
app.use(express.json());

// Health
app.get('/', (_req, res) => {
  res.status(200).send('genkit-rag is running');
});

// 모드 태그 (백업용: 현재는 LLM 재랭크 사용)
type Mode = 'harsh' | 'comfort' | 'random';
const TAGS_HARSH = new Set(['각성', '성찰', '도전', '투지', '강인함', '진실', '현실', '절제']);
const TAGS_COMFORT = new Set(['위로', '사랑', '연대', '공감', '희망', '온기', '평온']);

// 랜덤 1건
async function getRandomQuoteRow() {
  const supabase = getSupabaseAdmin();
  const head = await supabase
    .from('quote_embeddings')
    .select('*', { count: 'exact', head: true });
  const count = head.count ?? 0;
  if (count <= 0) return null;

  const offset = Math.floor(Math.random() * count);
  const { data, error } = await supabase
    .from('quote_embeddings')
    .select('id, quote, author, source')
    .range(offset, offset);
  if (error || !data?.[0]) return null;
  return data[0];
}

// 메인 핸들러
app.post('/api/quote', async (req, res) => {
  try {
    const input = (req.body?.input ?? '') as string;
    const mode = (req.body?.mode ?? 'comfort') as Mode;

    // random: 입력 없이도 OK → DB에서 바로 랜덤
    if (mode === 'random') {
      const row = await getRandomQuoteRow();
      if (!row) return res.status(500).json({ error: 'no data' });
      return res.json({
        quote: { quote: row.quote, author: row.author, source: row.source },
      });
    }

    // harsh/comfort: 입력 필수
    if (!input.trim()) {
      return res
        .status(400)
        .json({ error: 'input must be a non-empty string' });
    }

    // 벡터 후보
    const vec = await embedText(input);
    const candidatesRaw = await findCandidates(vec);
    if (!candidatesRaw.length) {
      return res.json({
        quote: {
          quote: '오늘을 견디는 힘은 내 안에 있다.',
          author: '시스템',
          source: 'fallback',
        },
      });
    }

    // LLM 재랭킹 입력 후보 목록
    const listForLLM = candidatesRaw.map((c) => ({
      quote: c.quote,
      author: c.author,
      source: c.source,
    }));

    // 모드 톤에 맞춰 최종 1개 선택
    const picked =
      (await rerankWithMode(mode, input, listForLLM)) ?? listForLLM[0];

    return res.json({
      quote: { quote: picked.quote, author: picked.author, source: picked.source },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[/api/quote] error:', msg);
    return res.status(500).json({ error: msg });
  }
});

// Start
const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`[BOOT] Starting Genkit flow server on :${port}`);
  console.log(`[READY] Genkit flow server is listening on :${port}`);
});