'use strict';

// ═══════════════════════════════════════════════════════════════
// CLUCHZONE — RBAC Middleware
// Role-based access control for Express routes
// ═══════════════════════════════════════════════════════════════

const ROLE_HIERARCHY = ['guest', 'player', 'captain', 'organizer', 'admin'];

/**
 * Creates middleware that requires at minimum the given role.
 * @param {string} minimumRole - e.g. 'organizer'
 */
function requireRole(minimumRole) {
  const minLevel = ROLE_HIERARCHY.indexOf(minimumRole);
  return (req, res, next) => {
    const userRole = req.user?.role || 'guest';
    const userLevel = ROLE_HIERARCHY.indexOf(userRole);
    if (userLevel >= minLevel) return next();
    return res.status(403).json({
      ok: false,
      error: `Permissão negada. Requer papel: ${minimumRole}.`,
    });
  };
}

module.exports = { requireRole, ROLE_HIERARCHY };
