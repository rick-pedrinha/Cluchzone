// ═══════════════════════════════════════════════════════════
// CLUTCHZONE — Tournament Repository
// Data access layer — only this class touches Firestore for tournaments
// ═══════════════════════════════════════════════════════════

import { db } from '../../core/api/firebase-client.js';
import { STORAGE_KEYS } from '../../core/store/keys.js';
import type { Tournament } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export class TournamentRepository {
  private static _instance: TournamentRepository;

  static getInstance(): TournamentRepository {
    if (!TournamentRepository._instance) TournamentRepository._instance = new TournamentRepository();
    return TournamentRepository._instance;
  }

  async findAll(): Promise<Tournament[]> {
    return db.get<Tournament[]>(STORAGE_KEYS.TOURNAMENTS, []);
  }

  async findById(id: string): Promise<Tournament | undefined> {
    const all = await this.findAll();
    return all.find(t => String(t.id) === String(id));
  }

  async create(data: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tournament> {
    const all = await this.findAll();
    const tournament: Tournament = {
      ...data,
      id: uuidv4(),
      registeredTeams: data.registeredTeams ?? [],
      pendingApprovals: data.pendingApprovals ?? [],
      rejectedTeams: data.rejectedTeams ?? [],
      soloPlayers: data.soloPlayers ?? [],
      pixStatus: data.pixStatus ?? {},
      playerPixStatus: data.playerPixStatus ?? {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.set(STORAGE_KEYS.TOURNAMENTS, [...all, tournament]);
    return tournament;
  }

  async update(id: string, changes: Partial<Tournament>): Promise<Tournament | null> {
    const all = await this.findAll();
    const idx = all.findIndex(t => String(t.id) === String(id));
    if (idx === -1) return null;
    const updated = { ...all[idx], ...changes, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    await db.set(STORAGE_KEYS.TOURNAMENTS, all);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const all = await this.findAll();
    const next = all.filter(t => String(t.id) !== String(id));
    if (next.length === all.length) return false;
    await db.set(STORAGE_KEYS.TOURNAMENTS, next);
    return true;
  }

  onChanges(callback: (tournaments: Tournament[]) => void): () => void {
    return db.listen<Tournament[]>(STORAGE_KEYS.TOURNAMENTS, callback);
  }
}

export const tournamentRepository = TournamentRepository.getInstance();
