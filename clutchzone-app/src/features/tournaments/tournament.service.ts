// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — Tournament Service
// Business logic layer for tournaments
// ═══════════════════════════════════════════════════════════

import { tournamentRepository } from './tournament.repository.js';
import { tournamentsStore } from '../../core/store/app-store.js';
import { can } from '../../core/auth/rbac.js';
import { toast } from '../../core/ui/toast.js';
import type { Tournament, UserRole, PixStatus } from '../../types/index.js';

class TournamentService {
  private static _instance: TournamentService;

  static getInstance(): TournamentService {
    if (!TournamentService._instance) TournamentService._instance = new TournamentService();
    return TournamentService._instance;
  }

  // ── Load all tournaments ──────────────────────────────
  async loadAll(): Promise<Tournament[]> {
    const tournaments = await tournamentRepository.findAll();
    tournamentsStore.set(tournaments);
    return tournaments;
  }

  // ── Create tournament ─────────────────────────────────
  async create(data: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>, role: UserRole): Promise<Tournament | null> {
    if (!can(role, 'create:tournament')) {
      toast.error('Você não tem permissão para criar campeonatos.');
      return null;
    }
    const tournament = await tournamentRepository.create(data);
    await this.loadAll();
    toast.success(`Campeonato "${tournament.name}" criado com sucesso!`);
    return tournament;
  }

  // ── Update tournament ─────────────────────────────────
  async update(id: string, changes: Partial<Tournament>, role: UserRole): Promise<Tournament | null> {
    if (!can(role, 'edit:tournament')) {
      toast.error('Você não tem permissão para editar campeonatos.');
      return null;
    }
    const updated = await tournamentRepository.update(id, changes);
    if (updated) {
      tournamentsStore.update(ts => ts.map(t => t.id === id ? updated : t));
      toast.success('Campeonato atualizado com sucesso!');
    }
    return updated;
  }

  // ── Approve team ──────────────────────────────────────
  async approveTeam(tournamentId: string, teamName: string, role: UserRole): Promise<boolean> {
    if (!can(role, 'approve:team')) {
      toast.error('Permissão negada.');
      return false;
    }
    const tournament = await tournamentRepository.findById(tournamentId);
    if (!tournament) return false;

    const pendingApprovals = tournament.pendingApprovals.filter(t => t !== teamName);
    const registeredTeams = tournament.registeredTeams.includes(teamName)
      ? tournament.registeredTeams
      : [...tournament.registeredTeams, teamName];

    await tournamentRepository.update(tournamentId, { pendingApprovals, registeredTeams });
    await this.loadAll();
    toast.success(`✓ ${teamName} aprovada no campeonato!`);
    return true;
  }

  // ── Reject team ───────────────────────────────────────
  async rejectTeam(tournamentId: string, teamName: string, role: UserRole): Promise<boolean> {
    if (!can(role, 'reject:team')) {
      toast.error('Permissão negada.');
      return false;
    }
    const tournament = await tournamentRepository.findById(tournamentId);
    if (!tournament) return false;

    const pendingApprovals = tournament.pendingApprovals.filter(t => t !== teamName);
    const rejectedTeams = tournament.rejectedTeams.includes(teamName)
      ? tournament.rejectedTeams
      : [...tournament.rejectedTeams, teamName];

    await tournamentRepository.update(tournamentId, { pendingApprovals, rejectedTeams });
    await this.loadAll();
    toast.error(`${teamName} foi rejeitada.`);
    return true;
  }

  // ── Confirm Pix payment ───────────────────────────────
  async confirmPix(tournamentId: string, teamName: string, role: UserRole): Promise<boolean> {
    if (!can(role, 'confirm:payment')) {
      toast.error('Permissão negada.');
      return false;
    }
    const tournament = await tournamentRepository.findById(tournamentId);
    if (!tournament) return false;

    const pixStatus: Record<string, PixStatus> = { ...tournament.pixStatus, [teamName]: 'pago' };
    await tournamentRepository.update(tournamentId, { pixStatus });
    await this.loadAll();
    toast.success(`✓ Pagamento Pix de ${teamName} autorizado!`);
    return true;
  }

  // ── Delete tournament ─────────────────────────────────
  async delete(id: string, role: UserRole): Promise<boolean> {
    if (!can(role, 'delete:tournament') && !can(role, 'edit:tournament')) {
      toast.error('Você não tem permissão para excluir campeonatos.');
      return false;
    }
    const success = await tournamentRepository.delete(id);
    if (success) {
      await this.loadAll();
      toast.success('Campeonato excluído com sucesso.');
    } else {
      toast.error('Não foi possível excluir o campeonato.');
    }
    return success;
  }

  // ── Subscribe to real-time changes ────────────────────
  subscribe(callback?: (tournaments: Tournament[]) => void): () => void {
    return tournamentRepository.onChanges(fresh => {
      tournamentsStore.set(fresh);
      callback?.(fresh);
    });
  }
}

export const tournamentService = TournamentService.getInstance();
