// ═══════════════════════════════════════════════════════════
// CLUCHZONE — Bracket Engine
// Generates tournament brackets: Single Elimination, Double Elim, Round Robin
// ═══════════════════════════════════════════════════════════

import type { Bracket, BracketMatch } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export function generateSingleElimination(teams: string[]): Bracket {
  const padded = padToPowerOfTwo(teams);
  const shuffled = shuffle([...padded]);
  const rounds: BracketMatch[][] = [];
  let current = shuffled;

  while (current.length > 1) {
    const round: BracketMatch[] = [];
    for (let i = 0; i < current.length; i += 2) {
      round.push({
        id: uuidv4(),
        round: rounds.length + 1,
        position: Math.floor(i / 2),
        team1: current[i] !== 'BYE' ? current[i] : undefined,
        team2: current[i + 1] !== 'BYE' ? current[i + 1] : undefined,
        winner: current[i + 1] === 'BYE' ? current[i] : undefined,
      });
    }
    rounds.push(round);
    // Winners advance (simulate BYEs)
    current = round.map(m => m.winner ?? '');
  }

  return {
    rounds,
    format: 'single',
    generatedAt: new Date().toISOString(),
  };
}

export function generateRoundRobin(teams: string[]): Bracket {
  const n = teams.length % 2 === 0 ? teams.length : teams.length + 1;
  const fixed = teams.length % 2 !== 0 ? [...teams, 'BYE'] : [...teams];
  const rounds: BracketMatch[][] = [];

  for (let r = 0; r < n - 1; r++) {
    const round: BracketMatch[] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = fixed[i];
      const away = fixed[n - 1 - i];
      if (home !== 'BYE' && away !== 'BYE') {
        round.push({
          id: uuidv4(),
          round: r + 1,
          position: i,
          team1: home,
          team2: away,
        });
      }
    }
    rounds.push(round);
    // Rotate teams (fix first position)
    fixed.splice(1, 0, fixed.pop()!);
  }

  return {
    rounds,
    format: 'round-robin',
    generatedAt: new Date().toISOString(),
  };
}

function padToPowerOfTwo(teams: string[]): string[] {
  const n = teams.length;
  let size = 1;
  while (size < n) size *= 2;
  const padded = [...teams];
  while (padded.length < size) padded.push('BYE');
  return padded;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
