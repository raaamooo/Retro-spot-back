"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const socketEvents_1 = require("./socketEvents");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const configManager_1 = require("./configManager");
dotenv_1.default.config();
// ── Crash handlers — prevent silent exits on Railway ──────────
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled Rejection:', reason);
});
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://retrospot.up.railway.app';
// Accept any origin that is localhost, the configured FRONTEND_URL,
// or any Cloudflare quick-tunnel subdomain (*.trycloudflare.com)
const isAllowedOrigin = (origin) => {
    if (!origin)
        return true; // same-origin / non-browser requests
    if (origin === FRONTEND_URL)
        return true;
    if (origin === 'https://retrospot.up.railway.app')
        return true;
    if (origin === 'https://retro-spot-front-production.up.railway.app')
        return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
        return true;
    if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin))
        return true;
    return false;
};
const corsOptions = {
    origin: (origin, cb) => {
        if (isAllowedOrigin(origin))
            cb(null, true);
        else
            cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
};
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: (origin, cb) => {
            if (isAllowedOrigin(origin))
                cb(null, true);
            else
                cb(new Error(`CORS: origin '${origin}' not allowed`));
        },
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        credentials: true,
    },
});
const prisma = new client_1.PrismaClient();
// ── Ensure uploads directory exists ────────────────────────────────
const uploadsDir = path_1.default.join(__dirname, 'public/uploads');
if (!fs_1.default.existsSync(uploadsDir))
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
// ── CORS ─────────────────────────────────────────────────────────
app.use((0, cors_1.default)(corsOptions));
// ── Body parsing (5 MB cap) ───────────────────────────────────────
app.use(express_1.default.json({ limit: '5mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '5mb' }));
// ── Static assets ────────────────────────────────────────────────
// Uploaded files (screenshots, art photos, etc.)
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, 'public/uploads')));
// Pre-cropped menu item images (served from backend/public/items/)
app.use('/items', express_1.default.static(path_1.default.join(__dirname, 'public/items')));
// ── Config endpoint for frontend ──────────────────────────────────
app.get('/api/config', (req, res) => {
    res.json((0, configManager_1.getConfig)());
});
app.post('/api/config', (req, res) => {
    try {
        const updated = (0, configManager_1.updateConfig)(req.body);
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to update config' });
    }
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
(0, socketEvents_1.registerSocketHandlers)(io, prisma);
// ── API routes ────────────────────────────────────────────────────
const api_1 = __importDefault(require("./routes/api"));
app.use('/api', (0, api_1.default)(io, prisma));
// ── Global error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
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
// Fix 502 Bad Gateway errors by matching proxy keep-alive timeouts
httpServer.keepAliveTimeout = 65000;
httpServer.headersTimeout = 66000;
// ── Keep Prisma connection alive (Railway idles after ~5 min) ─────
setInterval(async () => {
    try {
        await prisma.$queryRaw `SELECT 1`;
    }
    catch (err) {
        console.error('[KeepAlive] DB ping failed:', err);
    }
}, 4 * 60 * 1000); // every 4 minutes
