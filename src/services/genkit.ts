// src/services/genkit.ts
console.log('LOG: Loading src/services/genkit.ts');
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GENAI_KEY = process.env.GOOGLE_API_KEY || '';
if (!GENAI_KEY) {
  console.warn('[WARN] Missing GOOGLE_API_KEY for embeddings.');
}

console.log(
  '[ENV] GOOGLE_API_KEY prefix =',
  (process.env.GOOGLE_API_KEY || '').slice(0, 6)
);

// Genkit AI singleton
export const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GOOGLE_API_KEY || '' })],
  model: googleAI.model('gemini-2.5-flash'),
});

// Google AI Client singleton
let genAIClient: GoogleGenerativeAI | null = null;

export function getGenAI(): GoogleGenerativeAI {
  if (!genAIClient) {
    if (!GENAI_KEY) {
      throw new Error('Missing GOOGLE_API_KEY');
    }
    genAIClient = new GoogleGenerativeAI(GENAI_KEY);
  }
  return genAIClient;
}
