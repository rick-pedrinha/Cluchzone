'use strict';

// ═══════════════════════════════════════════════════════════════
// ClutchZone — Firebase Admin Auth Middleware
// Verifies Firebase ID tokens on protected routes.
// ═══════════════════════════════════════════════════════════════

const admin = require('firebase-admin');

// Initialize Firebase Admin (singleton)
function getAdmin() {
  if (admin.apps.length > 0) return admin;

  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'cluchzone-944a',
    });
  } catch (e) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'cluchzone-944a',
    });
  }

  return admin;
}

/**
 * Middleware: verifies Firebase ID token from Authorization header.
 * Sets req.user = { uid, email, role, nick } on success.
 * Returns 401 if token is missing or invalid.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Fallback to legacy compatibility: check X-User-Nick header
    const legacyNick = req.headers['x-user-nick'];
    if (legacyNick) {
      req.user = { uid: null, nick: legacyNick, role: 'player', legacy: true };
      return next();
    }
    return res.status(401).json({ ok: false, error: 'Autenticação necessária.' });
  }

  const token = authHeader.slice(7);

  try {
    const fa = getAdmin();
    const decoded = await fa.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      nick: decoded.name || decoded.email || decoded.uid,
      role: decoded.role || 'player',
    };
    next();
  } catch (err) {
    console.warn('[Auth Middleware] Invalid token:', err.code || err.message);
    return res.status(401).json({ ok: false, error: 'Token inválido ou expirado.' });
  }
}

/**
 * Middleware: requires organizer or admin role.
 * Must be used AFTER requireAuth.
 */
function requireOrganizer(req, res, next) {
  const role = req.user?.role;
  if (role === 'admin' || role === 'organizer') return next();
  return res.status(403).json({ ok: false, error: 'Permissão negada. Apenas organizadores.' });
}

/**
 * Middleware: requires admin role.
 * Must be used AFTER requireAuth.
 */
function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ ok: false, error: 'Permissão negada. Apenas administradores.' });
}

module.exports = { requireAuth, requireOrganizer, requireAdmin };
