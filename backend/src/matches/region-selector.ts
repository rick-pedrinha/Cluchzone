import type { LatencySample, PlatformRegion } from './match.types.js';

export type PlayerLatencySamples = {
  userId: string;
  samples: LatencySample[];
};

export type RegionScore = {
  regionCode: PlatformRegion;
  maximumLatencyMs: number;
  averageLatencyMs: number;
};

export function selectBalancedRegion(
  candidates: readonly PlatformRegion[],
  players: readonly PlayerLatencySamples[],
): RegionScore | null {
  if (players.length === 0) return null;

  const scores = candidates.flatMap(regionCode => {
    const latencies = players.map(player => player.samples.find(sample => sample.regionCode === regionCode)?.latencyMs);
    if (latencies.some(latency => latency === undefined)) return [];
    const complete = latencies as number[];
    return [{
      regionCode,
      maximumLatencyMs: Math.max(...complete),
      averageLatencyMs: complete.reduce((sum, latency) => sum + latency, 0) / complete.length,
    }];
  });

  scores.sort((left, right) =>
    left.maximumLatencyMs - right.maximumLatencyMs
    || left.averageLatencyMs - right.averageLatencyMs
    || candidates.indexOf(left.regionCode) - candidates.indexOf(right.regionCode));

  return scores[0] ?? null;
}
