import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import type { StateRepository } from '../state/state.repository.js';
import type { UserRepository } from '../users/user.types.js';
import type { Cs2InventoryService } from './cs2-inventory.service.js';

const paramsSchema = z.object({
  tournamentId: z.string().trim().min(1).max(100),
  playerName: z.string().trim().min(1).max(100),
});

type TournamentRecord = { id?: unknown; registeredTeams?: unknown; soloPlayers?: unknown };
type TeamRecord = { name?: unknown; captain?: unknown; vice?: unknown; members?: unknown; reserves?: unknown };

function sameText(first: unknown, second: string): boolean {
  return typeof first === 'string' && first.trim().toLocaleLowerCase('pt-BR') === second.trim().toLocaleLowerCase('pt-BR');
}

export function isRegisteredCs2Participant(
  tournamentId: string,
  playerName: string,
  tournamentsValue: unknown,
  teamsValue: unknown,
): boolean {
  if (!Array.isArray(tournamentsValue) || !Array.isArray(teamsValue)) return false;
  const tournament = (tournamentsValue as TournamentRecord[]).find(item => String(item.id) === tournamentId);
  if (!tournament) return false;
  if (Array.isArray(tournament.soloPlayers) && tournament.soloPlayers.some(player => sameText(player, playerName))) return true;
  const registeredTeams = Array.isArray(tournament.registeredTeams)
    ? tournament.registeredTeams.filter((name): name is string => typeof name === 'string')
    : [];
  return (teamsValue as TeamRecord[]).some(team => {
    if (!registeredTeams.some(name => sameText(team.name, name))) return false;
    const roster = [team.captain, team.vice];
    if (Array.isArray(team.members)) roster.push(...team.members.filter((player): player is string => typeof player === 'string'));
    if (Array.isArray(team.reserves)) roster.push(...team.reserves.filter((player): player is string => typeof player === 'string'));
    return roster.some(player => sameText(player, playerName));
  });
}

export function createCs2InventoryRouter(
  users: UserRepository,
  states: StateRepository,
  inventory: Cs2InventoryService,
): Router {
  const router = Router();

  router.get('/:tournamentId/players/:playerName/cs2-inventory', async (req, res, next) => {
    try {
      const parsed = paramsSchema.safeParse(req.params);
      if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Invalid tournament player request.');
      const { tournamentId, playerName } = parsed.data;
      const [tournaments, teams] = await Promise.all([
        states.get('cluchzone_cs2_camps'),
        states.get('cluchzone_cs2_teams'),
      ]);
      if (!isRegisteredCs2Participant(tournamentId, playerName, tournaments, teams)) {
        throw new AppError(404, 'TOURNAMENT_PLAYER_NOT_FOUND', 'Player is not registered in this tournament.');
      }
      const user = await users.findActiveByDisplayName(playerName);
      if (!user) {
        throw new AppError(404, 'PLAYER_STEAM_ACCOUNT_NOT_FOUND', 'Player has not linked a Steam account to Clutchzone.');
      }
      const result = await inventory.getPublicInventory(user.steamId64);
      res.set('Cache-Control', 'private, max-age=60').json({
        ok: true,
        player: {
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          profileUrl: user.profileUrl,
          steamLevel: user.steamLevel,
          personaState: user.personaState,
        },
        inventory: result,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
