import type { Outfit, Peer } from "./game-engine";

export type RoomSession = { code: string; id: string; token: string };
export type PlayerState = Pick<Peer, "x" | "y" | "z" | "angle" | "score" | "outfit">;
export type RoomUpdate = { code: string; players: Peer[]; serverTime: number };

export class RoomError extends Error {
  constructor(message: string, public status: number = 0) {
    super(message);
    this.name = "RoomError";
  }
}

/** Every request is same-origin; keep the returned player token in memory. */
export async function roomRequest<T = RoomUpdate>(payload: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch("/api/rooms", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new RoomError("The room server is unavailable. Please reload and try again.", response.status);
    }
    const result = await response.json() as { error?: unknown };
    if (!response.ok) {
      throw new RoomError(typeof result.error === "string" ? result.error : "Could not connect to the room.", response.status);
    }
    return result as T;
  } catch (error) {
    if (error instanceof RoomError) throw error;
    throw new RoomError("Connection lost. Check your internet connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

export const createRoom = (name: string, outfit: Outfit) =>
  roomRequest<RoomSession>({ action: "create", name, outfit });

export const joinRoom = (code: string, name: string, outfit: Outfit) =>
  roomRequest<RoomSession>({ action: "join", code: code.trim().toUpperCase(), name, outfit });

/** Send at 500ms intervals, only after the previous request has finished. */
export const syncRoom = (session: RoomSession, state: PlayerState) =>
  roomRequest<RoomUpdate>({ action: "sync", ...session, state });

export const leaveRoom = (session: RoomSession) =>
  roomRequest<{ left: true }>({ action: "leave", ...session });

/** Best effort on pagehide; stale players disappear after ten seconds regardless. */
export function leaveRoomOnUnload(session: RoomSession) {
  const payload = new Blob([JSON.stringify({ action: "leave", ...session })], { type: "application/json" });
  navigator.sendBeacon("/api/rooms", payload);
}
