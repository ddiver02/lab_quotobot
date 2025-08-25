import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { QUOTES as quotes } from "../src/data/quotes";

// Supabase (Service Role)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE envs");
}
const supabase = createClient(supabaseUrl, serviceKey);

// Google Embeddings
const apiKey = process.env.GOOGLE_API_KEY!;
if (!apiKey) throw new Error("Missing GOOGLE_API_KEY");
const genAI = new GoogleGenerativeAI(apiKey);
const embedder = genAI.getGenerativeModel({ model: "text-embedding-004" });

type QuoteRow = {
  quote: string;
  author: string;
  source: string;
  emotion?: string[];
};

async function main() {
  for (const q of quotes as QuoteRow[]) {
    const emb = await embedder.embedContent(q.quote );
    const embedding = emb.embedding.values;

    const { error } = await supabase.from("quote_embeddings").insert({
      quote: q.quote,
      author: q.author,
      source: q.source,
      emotion: q.emotion ?? [],
      embedding, // pgvector 컬럼
    });

    if (error) {
      console.error("✗ Insert error:", error);
    } else {
      console.log(`✓ Inserted: ${q.author} - ${q.quote.slice(0, 40)}…`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});