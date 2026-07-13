// ═══════════════════════════════════════════════════════════
// ClutchZone — Team Service
// Business logic layer for teams
// ═══════════════════════════════════════════════════════════

import { teamRepository } from './team.repository.js';
import { teamsStore } from '../../core/store/app-store.js';
import { can } from '../../core/auth/rbac.js';
import { toast } from '../../core/ui/toast.js';
import type { Team, UserRole } from '../../types/index.js';

class TeamService {
  private static _instance: TeamService;

  static getInstance(): TeamService {
    if (!TeamService._instance) TeamService._instance = new TeamService();
    return TeamService._instance;
  }

  async loadAll(): Promise<Team[]> {
    const teams = await teamRepository.findAll();
    teamsStore.set(teams);
    return teams;
  }

  async create(data: Omit<Team, 'id' | 'createdAt'>, role: UserRole): Promise<Team | null> {
    if (!can(role, 'create:team')) {
      toast.error('Você não tem permissão para criar equipes.');
      return null;
    }
    const team = await teamRepository.create(data);
    teamsStore.update(ts => [...ts, team]);
    toast.success(`Equipe "${team.name}" criada com sucesso!`);
    return team;
  }

  async update(name: string, changes: Partial<Team>, role: UserRole): Promise<Team | null> {
    if (!can(role, 'edit:team')) {
      toast.error('Sem permissão para editar equipes.');
      return null;
    }
    const updated = await teamRepository.update(name, changes);
    if (updated) {
      teamsStore.update(ts => ts.map(t => t.name === name ? updated : t));
    }
    return updated;
  }

  async findByName(name: string): Promise<Team | undefined> {
    return teamRepository.findByName(name);
  }

  subscribe(callback?: (teams: Team[]) => void): () => void {
    return teamRepository.onChanges(fresh => {
      teamsStore.set(fresh);
      callback?.(fresh);
    });
  }
}

export const teamService = TeamService.getInstance();
