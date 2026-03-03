export function buildMatchPath(matchId: number | string, createdAt?: string | null): string {
  const id = Number.parseInt(String(matchId), 10);
  if (!Number.isFinite(id)) {
    throw new Error(`Invalid match id: ${matchId}`);
  }

  const createdAtMs = createdAt ? new Date(createdAt).getTime() : Number.NaN;
  if (Number.isFinite(createdAtMs)) {
    return `/match/${id}-${createdAtMs.toString(36)}`;
  }

  return `/match/${id}`;
}
