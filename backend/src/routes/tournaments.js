'use strict';

// ═══════════════════════════════════════════════════════════════
// CLUTCHZONE — Tournament Routes
// Protected REST endpoints for tournament management
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.js');
const { requireRole } = require('../middleware/rbac.js');

// All tournament routes require authentication
router.use(requireAuth);

// GET /api/tournaments — list all
router.get('/', (req, res) => {
  res.json({ ok: true, message: 'Use /api/store/cluchzone_cs2_camps for now.' });
});

// POST /api/tournaments/:id/approve — approve a team (organizer+)
router.post('/:id/approve', requireRole('organizer'), (req, res) => {
  const { id } = req.params;
  const { teamName } = req.body;
  if (!teamName) return res.status(400).json({ ok: false, error: 'teamName é obrigatório.' });
  
  console.log(`[${new Date().toISOString()}] APPROVE team=${teamName} tournament=${id} by=${req.user?.nick}`);
  res.json({ ok: true, message: `Equipe ${teamName} aprovada no torneio ${id}.` });
});

// POST /api/tournaments/:id/reject — reject a team (organizer+)
router.post('/:id/reject', requireRole('organizer'), (req, res) => {
  const { id } = req.params;
  const { teamName, reason } = req.body;
  if (!teamName) return res.status(400).json({ ok: false, error: 'teamName é obrigatório.' });
  
  console.log(`[${new Date().toISOString()}] REJECT team=${teamName} tournament=${id} reason=${reason || 'N/A'} by=${req.user?.nick}`);
  res.json({ ok: true, message: `Equipe ${teamName} rejeitada.` });
});

// POST /api/tournaments/:id/confirm-pix — confirm pix payment (organizer+)
router.post('/:id/confirm-pix', requireRole('organizer'), (req, res) => {
  const { id } = req.params;
  const { teamName } = req.body;
  if (!teamName) return res.status(400).json({ ok: false, error: 'teamName é obrigatório.' });
  
  console.log(`[${new Date().toISOString()}] CONFIRM-PIX team=${teamName} tournament=${id} by=${req.user?.nick}`);
  res.json({ ok: true, message: `Pagamento Pix de ${teamName} autorizado.` });
});

module.exports = router;
