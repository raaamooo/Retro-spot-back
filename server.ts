import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { registerSocketHandlers } from './socketEvents';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Accept any origin that is localhost, the configured FRONTEND_URL,
// or any Cloudflare quick-tunnel subdomain (*.trycloudflare.com)
const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true; // same-origin / non-browser requests
  if (origin === FRONTEND_URL) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)) return true;
  return false;
};

const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (isAllowedOrigin(origin)) cb(null, true);
    else cb(new Error(`CORS: origin '${origin}' not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
};

const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) cb(null, true);
      else cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

const prisma = new PrismaClient();

// ── Ensure uploads directory exists ────────────────────────────────
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── CORS ─────────────────────────────────────────────────────────
app.use(cors(corsOptions));

// ── Body parsing (5 MB cap) ───────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Static assets ────────────────────────────────────────────────
// Uploaded files (screenshots, art photos, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
// Pre-cropped menu item images (served from backend/public/items/)
app.use('/items', express.static(path.join(__dirname, 'public/items')));

// ── Config endpoint for frontend ──────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    instapayPhone: process.env.INSTAPAY_PHONE || '01012345678',
    mobileWalletPhone: process.env.MOBILE_WALLET_PHONE || '01012345678',
    mapEmbedUrl: process.env.MAP_EMBED_URL || '',
    paymentProvider: process.env.PAYMENT_PROVIDER_PLACEHOLDER || 'instapay',
  });
});

// ── Request logging (dev only) ────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// ── Health check ──────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', service: 'Retro Spot API' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Socket.IO handlers ────────────────────────────────────────────
registerSocketHandlers(io, prisma);

// ── API routes ────────────────────────────────────────────────────
import apiRoutes from './routes/api';
app.use('/api', apiRoutes(io, prisma));

// ── Global error handler ──────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Retro Spot API running on port ${PORT}`);
  console.log(`   Frontend URL: ${FRONTEND_URL}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
