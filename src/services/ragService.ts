console.log('LOG: Loading src/services/ragService.ts');
// src/services/ragService.ts
import { getSupabaseAdmin } from './supabase';
import { getGenAI, ai } from './genkit';

// Constants
const EMB_MODEL = 'text-embedding-004'; // 768D
const TOP_K = Number(process.env.RAG_TOP_K ?? 5);
const MATCH_THRESHOLD = Number(process.env.RAG_MATCH_THRESHOLD ?? 0.15);

// Types
type CandidateRow = {
  id: number;
  quote: string;
  author: string;
  source: string;
  similarity: number;
};

export type Quote = {
  id?: number;
  quote: string;
  author: string;
  source: string;
};

// Functions
export async function embedText(text: string): Promise<number[]> {
  const model = getGenAI().getGenerativeModel({ model: EMB_MODEL });
  const { embedding } = await model.embedContent(text);
  return embedding?.values ?? [];
}

export async function findCandidates(vec: number[]): Promise<CandidateRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('match_quote_embeddings', {
    query_embedding: vec,
    match_threshold: MATCH_THRESHOLD,
    match_count: TOP_K,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CandidateRow[];
}

export async function rerankWithMode(
  mode: 'harsh' | 'comfort',
  input: string,
  candidates: Quote[]
): Promise<Quote | null> {
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

export async function getRandomQuoteRow(): Promise<Quote | null> {
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
