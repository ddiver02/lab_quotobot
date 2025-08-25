// genkit-demo/scripts/testRpc.ts
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE!;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_API_KEY) {
  throw new Error("Missing env: SUPABASE or GOOGLE_API_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const query = process.argv.slice(2).join(" ") || "월요일 아침에 동기부여가 필요해";

  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  const embedder = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const emb = await embedder.embedContent(query);
  const queryVec = emb.embedding.values;

  const { data, error } = await supabase.rpc("match_quotes", {
    query_embedding: queryVec,
    match_threshold: 0.78, // {💥외워!} 초기 0.75~0.82 권장
    match_count: 3,        // 상위 3개 보며 감으로 튜닝
  });

  if (error) {
    console.error("RPC error:", error);
    process.exit(1);
  }
  console.log("Query:", query);
  console.table(
    (data || []).map((r: any) => ({
      similarity: Number(r.similarity).toFixed(4),
      author: r.author,
      source: r.source,
      quote: r.quote.slice(0, 40) + (r.quote.length > 40 ? "..." : ""),
    }))
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});