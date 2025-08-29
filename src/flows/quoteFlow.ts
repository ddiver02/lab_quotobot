// src/flows/quoteFlow.ts
console.log('LOG: Loading src/flows/quoteFlow.ts');
import { z } from 'zod';
import { ai } from '../services/genkit';
import {
  embedText,
  findCandidates,
  rerankWithMode,
  getRandomQuoteRow,
  type Quote,
} from '../services/ragService';

// Define a Zod schema for the Quote object, consistent with the output
const QuoteSchema = z.object({
  quote: z.string(),
  author: z.string(),
  source: z.string(),
});

const QuoteRAGInput = z.object({
  input: z.string(),
  mode: z.enum(['harsh', 'comfort', 'random']),
});

const QuoteRAGOutput = z.object({
  quote: QuoteSchema,
});

// Define the type for the candidates array explicitly
type CandidateRow = {
  id: number;
  quote: string;
  author: string;
  source: string;
  similarity: number;
};

export const quoteRAGFlow = ai.defineFlow(
  {
    name: 'quoteRAGFlow',
    inputSchema: QuoteRAGInput,
    outputSchema: QuoteRAGOutput,
  },
  async ({ input, mode }: z.infer<typeof QuoteRAGInput>) => {
    let picked: Quote | null;

    if (mode === 'random') {
      picked = await getRandomQuoteRow();
    } else {
      if (!input.trim()) {
        throw new Error('Input must be a non-empty string for harsh/comfort modes.');
      }

      const vector = await embedText(input);
      const candidates: CandidateRow[] = await findCandidates(vector);

      if (!candidates.length) {
        return {
          quote: {
            quote: '오늘을 견디는 힘은 내 안에 있다.',
            author: '시스템',
            source: 'fallback',
          },
        };
      }

      const listForLLM: Quote[] = candidates.map((c: CandidateRow) => ({
        quote: c.quote,
        author: c.author,
        source: c.source,
      }));

      picked = await rerankWithMode(mode, input, listForLLM);
    }

    if (!picked) {
      return {
        quote: {
          quote: '마음에 드는 인용구를 찾지 못했어요. 다시 시도해 주세요.',
          author: '시스템',
          source: 'fallback',
        },
      };
    }

    return {
      quote: picked,
    };
  }
);