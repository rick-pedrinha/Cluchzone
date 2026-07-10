// ═══════════════════════════════════════════════════════════
// CLUCHZONE — Team Repository
// Data access layer for teams
// ═══════════════════════════════════════════════════════════

import { db } from '../../core/api/firebase-client.js';
import { STORAGE_KEYS } from '../../core/store/keys.js';
import type { Team } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class TeamRepository {
  private static _instance: TeamRepository;

  static getInstance(): TeamRepository {
    if (!TeamRepository._instance) TeamRepository._instance = new TeamRepository();
    return TeamRepository._instance;
  }

  async findAll(): Promise<Team[]> {
    return db.get<Team[]>(STORAGE_KEYS.TEAMS, []);
  }

  async findByName(name: string): Promise<Team | undefined> {
    const all = await this.findAll();
    return all.find(t => t.name.toLowerCase() === name.toLowerCase());
  }

  async create(data: Omit<Team, 'id' | 'createdAt'>): Promise<Team> {
    const all = await this.findAll();
    const team: Team = {
      ...data,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.set(STORAGE_KEYS.TEAMS, [...all, team]);
    return team;
  }

  async update(name: string, changes: Partial<Team>): Promise<Team | null> {
    const all = await this.findAll();
    const idx = all.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
    if (idx === -1) return null;
    const updated = { ...all[idx], ...changes, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    await db.set(STORAGE_KEYS.TEAMS, all);
    return updated;
  }

  onChanges(callback: (teams: Team[]) => void): () => void {
    return db.listen<Team[]>(STORAGE_KEYS.TEAMS, callback);
  }
}

export const teamRepository = TeamRepository.getInstance();
