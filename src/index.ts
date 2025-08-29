// src/index.ts
import { app } from './app';

// Start
const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`[BOOT] Starting Genkit flow server on :${port}`);
  console.log(`[READY] Genkit flow server is listening on :${port}`);
});
