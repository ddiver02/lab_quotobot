1. 프로젝트 요약
    문장 중심의 문학 커뮤니티를 만들기 위한 장소.

2. 사용 목적
    팀 구성원이 빠르게 RAG-AGENT를 활용해 볼 수 있도록 하기 위함

3. 개발하는 RAG-AGENT는?
    시의적절한 인용구를 선물하는 친구입니다.

4. 사용방법
    1) `.env` 준비 (비공개)
       - `genkit-demo/.env.example`를 복사해 `genkit-demo/.env`로 만들고 값 채우기
       - 절대 `.env`를 커밋하지 마세요. 루트 `.gitignore`에 이미 포함되어 있습니다.
    2) 의존성 설치 및 실행
       - `cd genkit-demo && npm i`
       - 개발: `npm run dev`
    3) 임베딩 적재(처음 1회)
       - `npx tsx scripts/embedQuotes.ts`
    4) 검색 테스트
       - `npx tsx scripts/testRpc.ts "월요일 아침에 동기부여가 필요해"`

보안 주의
- API Key와 Supabase Service Role Key는 코드/저장소에 포함하지 마세요.
- 배포 시 환경변수로 주입하세요. `genkit-demo/deploy_backend.sh`는 환경변수에서 읽습니다.

옵션 A: Vercel(Web) -> Cloud Run(API)
- Backend(Cloud Run)
  - 환경변수: `GOOGLE_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`
  - `CORS_ORIGINS` 예시: `https://your-app.vercel.app,https://preview-your-app.vercel.app`
  - 배포: `bash genkit-demo/deploy_backend.sh`
- Web(Vercel)
  - 환경변수: `NEXT_PUBLIC_API_BASE=https://<your-cloud-run-url>`
  - API 호출 시 `fetch(
      \
      `${process.env.NEXT_PUBLIC_API_BASE}/api/quote?input=...`
    )`

옵션 B: Vercel에 API 통합
- Vercel 서버 라우트에서 `GOOGLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 사용
- 클라이언트는 `NEXT_PUBLIC_SUPABASE_URL`만 노출(서비스 롤 키는 절대 노출 금지)
