// ═══════════════════════════════════════════════════════════════
// ClutchZone — Express Backend (Professional)
// Replaces the flat server.js with proper routing and middleware
// ═══════════════════════════════════════════════════════════════

'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { requireAuth } = require('./middleware/auth.js');
const { requireRole } = require('./middleware/rbac.js');

const PORT = Number(process.env.PORT || 3001);
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// ── Default DB schema ──────────────────────────────────────────
const DEFAULT_DB = {
  users: [],
  sessions: {},
  store: {
    cluchzone_auth: null,
    cluchzone_premium: false,
    cluchzone_cs2_camps: [],
    cluchzone_cs2_teams: [],
    cluchzone_cs2_players: [],
    cluchzone_cs2_feed: [],
    cluchzone_cs2_notifs: [],
  },
};

// ── DB helpers ─────────────────────────────────────────────────
function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  try {
    return { ...DEFAULT_DB, ...JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  try {
    const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ── Express app ────────────────────────────────────────────────
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'https:', 'data:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

app.use(cors({
  origin: [
    'http://localhost:5173',   // Vite dev server
    'http://localhost:3000',   // Legacy server
    'https://rick-pedrinha.github.io', // Production
  ],
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Rate limiting — protect against brute force and spam
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Only 20 auth attempts per 15 minutes
  message: { ok: false, error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

app.use('/api/', globalLimiter);
app.use('/api/auth/', authLimiter);

// Request logger
app.use('/api/', (req, _res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} — IP: ${ip}`);
  next();
});

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'cluchzone', version: '2.0', time: new Date().toISOString() });
});

// ── Store routes (key-value) ───────────────────────────────────
app.get('/api/state', (_req, res) => {
  const db = readDb();
  res.json({ ok: true, state: db.store });
});

app.get('/api/store/:key', (req, res) => {
  const db = readDb();
  const key = decodeURIComponent(req.params.key);
  res.json({ ok: true, key, value: db.store[key] ?? null });
});

app.post('/api/store/:key', (req, res) => {
  const db = readDb();
  const key = decodeURIComponent(req.params.key);
  const body = req.body;
  // Validate key is a known cluchzone key
  if (!key.startsWith('cluchzone_')) {
    return res.status(400).json({ ok: false, error: 'Invalid key namespace.' });
  }
  db.store[key] = Object.prototype.hasOwnProperty.call(body, 'value') ? body.value : body;
  writeDb(db);
  res.json({ ok: true, key, value: db.store[key] });
});

// ── Auth routes ────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const db = readDb();
  const nick = String(req.body.nick || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!nick || !email || password.length < 6) {
    return res.status(400).json({
      ok: false,
      error: 'Informe nick, email e senha com mínimo 6 caracteres.',
    });
  }

  // Email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Email inválido.' });
  }

  if (db.users.some(u => u.email === email || u.nick.toLowerCase() === nick.toLowerCase())) {
    return res.status(409).json({ ok: false, error: 'Nick ou email já cadastrado.' });
  }

  const user = {
    id: crypto.randomUUID(),
    nick,
    email,
    provider: 'email',
    role: 'player',
    games: req.body.games || [],
    premium: false,
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password),
  };

  db.users.push(user);
  writeDb(db);
  res.status(201).json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const db = readDb();
  const login = String(req.body.email || req.body.nick || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!login || !password) {
    return res.status(400).json({ ok: false, error: 'Informe email/nick e senha.' });
  }

  const user = db.users.find(u => u.email === login || u.nick.toLowerCase() === login);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: 'Login ou senha inválidos.' });
  }

  // Update last login
  user.lastLogin = new Date().toISOString();
  writeDb(db);

  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/oauth', (req, res) => {
  const db = readDb();
  const provider = String(req.body.provider || 'email');
  const nick = String(req.body.nick || `${provider}_player`).trim();

  let user = db.users.find(u => u.provider === provider && u.nick === nick);
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      nick,
      email: `${provider}-${crypto.randomUUID()}@oauth.cluchzone`,
      provider,
      role: 'player',
      games: req.body.games || [],
      premium: false,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      passwordHash: '',
    };
    db.users.push(user);
  } else {
    user.lastLogin = new Date().toISOString();
  }

  writeDb(db);
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

// ── Protected store routes (require auth) ─────────────────────
app.post('/api/store/cluchzone_cs2_camps', requireAuth, requireRole('organizer'), (req, res) => {
  const db = readDb();
  const body = req.body;
  db.store['cluchzone_cs2_camps'] = Object.prototype.hasOwnProperty.call(body, 'value') ? body.value : body;
  writeDb(db);
  res.json({ ok: true, key: 'cluchzone_cs2_camps', value: db.store['cluchzone_cs2_camps'] });
});

app.post('/api/store/cluchzone_auth', requireAuth, (req, res) => {
  const db = readDb();
  const body = req.body;
  db.store['cluchzone_auth'] = Object.prototype.hasOwnProperty.call(body, 'value') ? body.value : body;
  writeDb(db);
  res.json({ ok: true, key: 'cluchzone_auth' });
});

// ── Verify token endpoint ─────────────────────────────────────
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ── Tournament routes ─────────────────────────────────────────
const tournamentRoutes = require('./routes/tournaments.js');
app.use('/api/tournaments', tournamentRoutes);

// ── 404 handler ────────────────────────────────────────────────
app.use('/api/*', (_req, res) => {
  res.status(404).json({ ok: false, error: 'Endpoint não encontrado.' });
});

// ── Static file server ─────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon', '.webp': 'image/webp',
};

app.use((req, res) => {
  const requestPath = decodeURIComponent(req.path === '/' ? '/index.html' : req.path);
  const filePath = path.normalize(path.join(ROOT, requestPath));
  const relativePath = path.relative(ROOT, filePath);

  // Path traversal protection
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return res.status(403).send('Forbidden');
  }

  // Block data and git directories
  if (/^(data|\.git|backend)(\\|\/|$)/.test(relativePath)) {
    return res.status(403).send('Forbidden');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).send('Not found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const noCache = ['.html', '.css', '.js'].includes(ext);
  res.set('Content-Type', MIME[ext] || 'application/octet-stream');
  res.set('Cache-Control', noCache ? 'no-cache' : 'public, max-age=300');
  fs.createReadStream(filePath).pipe(res);
});

// ── Global error handler ───────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ClutchZone Error]', err);
  res.status(500).json({ ok: false, error: 'Erro interno do servidor.' });
});

// ── Start server ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏆 ClutchZone v2.0 rodando em http://localhost:${PORT}`);
  console.log(`📦 API disponível em http://localhost:${PORT}/api`);
  console.log(`🔒 Helmet, CORS e Rate Limiting ativos\n`);
});

module.exports = app;
