import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CAPACITY = 8;
const PRESENCE_MS = 10_000;
const ROOM_LIFETIME_MS = 6 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 4096;

type Outfit = { jacket: string; pants: string; hat: string; gear: "skis" | "snowboard" };
type State = { x: number; y: number; z: number; angle: number; score: number; outfit: Outfit };
type PlayerRow = { id: string; name: string; outfit: string; x: number; y: number; z: number; angle: number; score: number };

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const reply = (data: unknown, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
});

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Invalid room request.");
  return value as Record<string, unknown>;
}

function outfit(value: unknown): Outfit {
  const data = object(value);
  for (const key of ["jacket", "pants", "hat"]) {
    if (typeof data[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(data[key])) {
      throw new HttpError(400, "Choose a valid clothing color.");
    }
  }
  if (data.gear !== "skis" && data.gear !== "snowboard") throw new HttpError(400, "Choose skis or a snowboard.");
  return { jacket: data.jacket as string, pants: data.pants as string, hat: data.hat as string, gear: data.gear };
}

function playerName(value: unknown): string {
  if (typeof value !== "string") throw new HttpError(400, "Enter a rider name.");
  const name = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, "").trim();
  if (!name || name.length > 18) throw new HttpError(400, "Use a rider name of 1–18 characters.");
  return name;
}

function roomCode(value: unknown): string {
  if (typeof value !== "string") throw new HttpError(400, "Enter a six-character room code.");
  const code = value.trim().toUpperCase();
  if (code.length !== 6 || [...code].some((character) => !ALPHABET.includes(character))) {
    throw new HttpError(400, "Enter a valid six-character room code.");
  }
  return code;
}

function playerState(value: unknown): State {
  const data = object(value);
  for (const key of ["x", "y", "z", "angle", "score"]) {
    if (typeof data[key] !== "number" || !Number.isFinite(data[key]) || Math.abs(data[key] as number) > 1e12) {
      throw new HttpError(400, "Invalid rider position or score.");
    }
  }
  if ((data.score as number) < 0) throw new HttpError(400, "Invalid rider score.");
  return { x: data.x as number, y: data.y as number, z: data.z as number, angle: data.angle as number, score: Math.floor(data.score as number), outfit: outfit(data.outfit) };
}

function randomCode(): string {
  return [...crypto.getRandomValues(new Uint8Array(6))].map((number) => ALPHABET[number % ALPHABET.length]).join("");
}

function randomToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function tokenHash(value: unknown): Promise<string> {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new HttpError(401, "Your room session ended. Join the room again.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((number) => number.toString(16).padStart(2, "0")).join("");
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "Send room requests as JSON.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw new HttpError(413, "Room request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing room request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new HttpError(413, "Room request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return object(JSON.parse(new TextDecoder().decode(bytes))); }
  catch { throw new HttpError(400, "Invalid room request."); }
}

async function cleanup(db: D1Database, now: number) {
  await db.batch([
    db.prepare("DELETE FROM players WHERE last_seen < ? OR room_code IN (SELECT code FROM rooms WHERE expires_at <= ?)").bind(now - ROOM_LIFETIME_MS, now),
    db.prepare("DELETE FROM rooms WHERE expires_at <= ?").bind(now),
  ]);
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "Room requests must come from this game.");
    const data = await readBody(request);
    const db = env.DB;
    if (!db) throw new HttpError(503, "Multiplayer is warming up. Try again in a moment.");
    const now = Date.now();

    if (data.action === "create" || data.action === "join") {
      const name = playerName(data.name);
      const clothes = outfit(data.outfit);
      await cleanup(db, now);
      let code: string;
      if (data.action === "create") {
        code = "";
        for (let attempt = 0; attempt < 5; attempt++) {
          const candidate = randomCode();
          const result = await db.prepare("INSERT OR IGNORE INTO rooms (code, created_at, expires_at) VALUES (?, ?, ?)")
            .bind(candidate, now, now + ROOM_LIFETIME_MS).run();
          if (result.meta.changes === 1) { code = candidate; break; }
        }
        if (!code) throw new HttpError(503, "Could not create a room. Please try again.");
      } else {
        code = roomCode(data.code);
      }
      const room = await db.prepare("SELECT code FROM rooms WHERE code = ? AND expires_at > ?").bind(code, now).first();
      if (!room) throw new HttpError(404, "Room not found or expired. Check the code with your friend.");
      const id = crypto.randomUUID();
      const token = randomToken();
      const hash = await tokenHash(token);
      // Capacity is checked inside the INSERT, so simultaneous joins cannot overfill it.
      const inserted = await db.prepare(`INSERT INTO players (id, room_code, token_hash, name, outfit, x, y, z, angle, score, last_seen)
        SELECT ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?
        WHERE EXISTS (SELECT 1 FROM rooms WHERE code = ? AND expires_at > ?)
        AND (SELECT COUNT(*) FROM players WHERE room_code = ? AND last_seen >= ?) < ?`)
        .bind(id, code, hash, name, JSON.stringify(clothes), now, code, now, code, now - PRESENCE_MS, CAPACITY).run();
      if (inserted.meta.changes !== 1) throw new HttpError(409, "This room is full. Up to eight riders can join.");
      return reply({ code, id, token }, 201);
    }

    if (data.action !== "sync" && data.action !== "leave") throw new HttpError(400, "Unknown room action.");
    const code = roomCode(data.code);
    if (typeof data.id !== "string" || !/^[a-f0-9-]{36}$/.test(data.id)) throw new HttpError(401, "Your room session ended. Join the room again.");
    const hash = await tokenHash(data.token);

    if (data.action === "leave") {
      await db.prepare("DELETE FROM players WHERE id = ? AND room_code = ? AND token_hash = ?").bind(data.id, code, hash).run();
      return reply({ left: true });
    }

    const state = playerState(data.state);
    const updated = await db.prepare(`UPDATE players SET x = ?, y = ?, z = ?, angle = ?, score = ?, outfit = ?, last_seen = ?
      WHERE id = ? AND room_code = ? AND token_hash = ?
      AND EXISTS (SELECT 1 FROM rooms WHERE code = ? AND expires_at > ?)
      AND (last_seen >= ? OR (SELECT COUNT(*) FROM players WHERE room_code = ? AND last_seen >= ?) < ?)`)
      .bind(state.x, state.y, state.z, state.angle, state.score, JSON.stringify(state.outfit), now,
        data.id, code, hash, code, now, now - PRESENCE_MS, code, now - PRESENCE_MS, CAPACITY).run();
    if (updated.meta.changes !== 1) {
      const session = await db.prepare("SELECT p.id FROM players p JOIN rooms r ON r.code = p.room_code WHERE p.id = ? AND p.room_code = ? AND p.token_hash = ? AND r.expires_at > ?")
        .bind(data.id, code, hash, now).first();
      if (session) throw new HttpError(409, "The room filled while you were away. Create or join another room.");
      throw new HttpError(401, "Your room session ended. Join or create a room again.");
    }
    const result = await db.prepare("SELECT id, name, outfit, x, y, z, angle, score FROM players WHERE room_code = ? AND last_seen >= ? ORDER BY score DESC, id ASC LIMIT ?")
      .bind(code, now - PRESENCE_MS, CAPACITY).all<PlayerRow>();
    return reply({ code, players: result.results.map((player) => ({ ...player, outfit: JSON.parse(player.outfit) })), serverTime: now });
  } catch (error) {
    if (error instanceof HttpError) return reply({ error: error.message }, error.status);
    console.error("Room service failed", error instanceof Error ? error.message : "unknown error");
    return reply({ error: "The room server is unavailable. Please try again shortly." }, 503);
  }
}
