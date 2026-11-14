/**
 * Ask the server whether a room code exists, so a join link can be validated
 * before the name step (and a "no such room" message shown otherwise). Fails
 * open (treats the room as existing) if the check can't be reached – the join
 * attempt itself will still surface a real error.
 */
export async function fetchRoomExists(code: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/room-exists?code=${encodeURIComponent(code)}`);
    if (!res.ok) return true;
    const data = (await res.json()) as { exists?: boolean };
    return data.exists !== false;
  } catch {
    return true;
  }
}
