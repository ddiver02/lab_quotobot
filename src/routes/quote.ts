// src/routes/quote.ts
import { Router } from 'express';
import {
  embedText,
  findCandidates,
  rerankWithMode,
  getRandomQuoteRow,
  Quote,
} from '../services/ragService';
import { getSupabaseAdmin } from '../services/supabase'; // Import getSupabaseAdmin

type Mode = 'harsh' | 'comfort' | 'random';

export const quoteRouter = Router();

// Helper function to log: user_input + user_interactions(quote_id)
async function logInteraction(
  input: string,
  mode: Mode,
  quoteId: number
) {
  try {
    const supabase = getSupabaseAdmin();
    // Record raw input
    await supabase
      .from('user_input')
      .insert({ input_text: input, selected_mode: mode });
    // Record matched quote id
    const { error: uiErr } = await supabase.from('user_interactions').insert({
      input_text: input,
      selected_mode: mode,
      quote_id: quoteId,
    });
    if (uiErr) console.error('Supabase logging error:', uiErr.message);
  } catch (e) {
    console.error('Error logging interaction:', e);
  }
}

// 메인 핸들러
quoteRouter.post('/quote', async (req, res) => {
  try {
    const input = (req.body?.query ?? '') as string;
    const mode = (req.body?.mode ?? 'comfort') as Mode;

    let finalPickedQuote: Quote; // Declare a variable to hold the final picked quote

    // random: 입력 없이도 OK → DB에서 바로 랜덤
    if (mode === 'random') {
      const row = await getRandomQuoteRow();
      if (!row || typeof row.id !== 'number') {
        finalPickedQuote = {
          quote: '데이터를 찾을 수 없습니다.',
          author: '시스템',
          source: '오류',
        };
        return res.status(500).json(finalPickedQuote);
      }
      finalPickedQuote = { quote: row.quote, author: row.author, source: row.source };
      await logInteraction(input, mode, row.id);
      return res.json(finalPickedQuote);
    }

    // harsh/comfort: 입력 필수
    if (!input.trim()) {
      finalPickedQuote = {
        quote: '문장을 입력해 주세요.',
        author: '시스템',
        source: '입력 오류',
      };
      return res
        .status(400)
        .json(finalPickedQuote);
    }

    // 벡터 후보 (임베딩 실패 시 에러 반환; 랜덤 폴백 없음)
    const vec = await embedText(input);
    const candidatesRaw = await findCandidates(vec);
    if (!candidatesRaw.length) {
      // 후보 없음: 고정 메시지로 응답(랜덤 폴백/로깅 없음)
      finalPickedQuote = {
        quote: '오늘을 견디는 힘은 내 안에 있다.',
        author: '시스템',
        source: 'fallback',
      };
      return res.json(finalPickedQuote);
    }

    // LLM 재랭킹 입력 후보 목록
    const listForLLM = candidatesRaw.map((c) => ({
      quote: c.quote,
      author: c.author,
      source: c.source,
    }));

    // 모드 톤에 맞춰 최종 1개 선택
    const picked = (await rerankWithMode(mode, input, listForLLM)) ?? listForLLM[0];
    finalPickedQuote = { quote: picked.quote, author: picked.author, source: picked.source };
    // map back to id
    const idx = listForLLM.findIndex(
      (q) => q.quote === picked.quote && q.author === picked.author && q.source === picked.source
    );
    const quoteId = idx >= 0 ? candidatesRaw[idx].id : candidatesRaw[0].id;
    await logInteraction(input, mode, quoteId);

    return res.json(finalPickedQuote);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[/api/quote] error:', msg);
    return res.status(500).json({ error: msg });
  }
});
