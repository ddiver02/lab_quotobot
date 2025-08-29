// src/app.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { quoteRouter } from './routes/quote';

export const app = express();

// CORS (Option A: Web on Vercel -> Cloud Run API)
// Configure allowed origins via env CORS_ORIGINS (comma-separated).
const corsOriginsEnv = process.env.CORS_ORIGINS || '';
const allowedOrigins = corsOriginsEnv
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true); // allow server-to-server and curl
      if (allowedOrigins.length === 0) return callback(null, true); // if not set, allow all (set CORS_ORIGINS in prod)
      const ok = allowedOrigins.some((o) => origin === o || (o.endsWith('.vercel.app') && origin.endsWith('.vercel.app')));
      return ok ? callback(null, true) : callback(new Error('CORS blocked'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    maxAge: 86400,
  })
);

// Middlewares
app.use(express.json());

// Health Check
app.get('/', (_req, res) => {
  res.status(200).send('genkit-rag is running');
});

// API Routes
app.use('/api', quoteRouter);

// Import flows to make them available to Genkit
import './flows/quoteFlow';
