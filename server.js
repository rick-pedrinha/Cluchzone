'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip'
};

const DEFAULT_DB = {
  users: [],
  sessions: {},
  store: {
    cluchzone_auth: null,
    cluchzone_premium: false,
    cluchzone_cs2_camps: null,
    cluchzone_cs2_teams: null,
    cluchzone_cs2_players: null,
    cluchzone_cs2_feed: null,
    cluchzone_cs2_notifs: null,
    cluchzone_pubg_tournaments: null,
    cluchzone_brawl_teams: null
  }
};

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return { ...DEFAULT_DB, ...JSON.parse(raw) };
  } catch (error) {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
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
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

async function handleApi(req, res, url) {
  const db = readDb();
  const keyMatch = url.pathname.match(/^\/api\/store\/([^/]+)$/);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, app: 'cluchzone', time: new Date().toISOString() });
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(res, 200, { ok: true, state: db.store });
  }

  if (keyMatch && req.method === 'GET') {
    const key = decodeURIComponent(keyMatch[1]);
    return sendJson(res, 200, { ok: true, key, value: db.store[key] ?? null });
  }

  if (keyMatch && req.method === 'POST') {
    const key = decodeURIComponent(keyMatch[1]);
    const body = await readBody(req);
    db.store[key] = Object.prototype.hasOwnProperty.call(body, 'value') ? body.value : body;
    writeDb(db);
    return sendJson(res, 200, { ok: true, key, value: db.store[key] });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    const body = await readBody(req);
    const nick = String(body.nick || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!nick || !email || password.length < 4) {
      return sendJson(res, 400, { ok: false, error: 'Informe nick, email e uma senha com pelo menos 4 caracteres.' });
    }
    if (db.users.some(u => u.email === email || u.nick.toLowerCase() === nick.toLowerCase())) {
      return sendJson(res, 409, { ok: false, error: 'Usuario ja cadastrado.' });
    }

    const user = {
      id: crypto.randomUUID(),
      nick,
      email,
      provider: 'email',
      games: body.games || [],
      premium: false,
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(password)
    };
    db.users.push(user);
    db.store.cluchzone_auth = publicUser(user);
    writeDb(db);
    return sendJson(res, 201, { ok: true, user: publicUser(user) });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readBody(req);
    const login = String(body.email || body.nick || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = db.users.find(u => u.email === login || u.nick.toLowerCase() === login);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendJson(res, 401, { ok: false, error: 'Login ou senha invalidos.' });
    }
    db.store.cluchzone_auth = publicUser(user);
    writeDb(db);
    return sendJson(res, 200, { ok: true, user: publicUser(user) });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/oauth') {
    const body = await readBody(req);
    const provider = String(body.provider || 'email');
    const nick = String(body.nick || `${provider}_player`).trim();
    let user = db.users.find(u => u.provider === provider && u.nick === nick);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        nick,
        email: `${provider}-${crypto.randomUUID()}@local.cluchzone`,
        provider,
        games: body.games || [],
        premium: false,
        createdAt: new Date().toISOString(),
        passwordHash: ''
      };
      db.users.push(user);
    }
    db.store.cluchzone_auth = publicUser(user);
    writeDb(db);
    return sendJson(res, 200, { ok: true, user: publicUser(user) });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    db.store.cluchzone_auth = null;
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { ok: false, error: 'Endpoint nao encontrado.' });
}

function serveStatic(req, res, url) {
  const requestPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.normalize(path.join(ROOT, requestPath));
  const relativePath = path.relative(ROOT, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (relativePath === 'data' || relativePath.startsWith(`data${path.sep}`) || relativePath === '.git' || relativePath.startsWith(`.git${path.sep}`)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Arquivo nao encontrado');
    }

    const ext = path.extname(filePath).toLowerCase();
    const noCache = ext === '.html' || ext === '.css' || ext === '.js';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': noCache ? 'no-cache' : 'public, max-age=300'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url);
    }
    return serveStatic(req, res, url);
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message || 'Erro interno' });
  }
});

server.listen(PORT, () => {
  console.log(`ClutchZone rodando em http://localhost:${PORT}`);
});
