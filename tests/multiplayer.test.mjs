import test from "node:test";
import assert from "node:assert/strict";

// Run against the running local preview after applying D1 migrations:
// node --test tests/multiplayer.test.mjs
// Override ROOM_TEST_URL to use a different local port.
const base = process.env.ROOM_TEST_URL || "http://127.0.0.1:5173";
const outfit = { jacket: "#cf714e", pants: "#344c5d", hat: "#e3bc6b", gear: "snowboard" };
const position = { x: 15, y: 320, z: 12, angle: 0.5, score: 1800, outfit };

async function call(payload) {
  const response = await fetch(`${base}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: new URL(base).origin },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  return { response, body };
}

async function create(name) {
  const { response, body } = await call({ action: "create", name, outfit });
  assert.equal(response.status, 201, body.error);
  assert.match(body.code, /^[A-Z2-9]{6}$/);
  return body;
}

async function join(code, name) {
  const { response, body } = await call({ action: "join", code, name, outfit });
  assert.equal(response.status, 201, body.error);
  return body;
}

test("real room clients share state, enforce membership, and isolate rooms", async () => {
  const sessions = [];
  try {
    const host = await create("Test skier");
    sessions.push(host);
    const friend = await join(host.code, "Test boarder");
    sessions.push(friend);
    const stranger = await create("Other mountain");
    sessions.push(stranger);

    let result = await call({ action: "sync", ...host, state: position });
    assert.equal(result.response.status, 200, result.body.error);
    assert.match(result.response.headers.get("cache-control"), /no-store/);
    assert.equal(result.body.players.length, 2);

    const changedOutfit = { ...outfit, jacket: "#96b6a4", gear: "skis" };
    result = await call({ action: "sync", ...friend, state: { ...position, x: -21, score: 600, outfit: changedOutfit } });
    assert.equal(result.response.status, 200, result.body.error);
    const visibleHost = result.body.players.find((player) => player.id === host.id);
    assert.equal(visibleHost.y, 320);
    assert.equal(visibleHost.score, 1800);
    assert.deepEqual(visibleHost.outfit, outfit);
    assert.equal("token" in visibleHost, false);
    assert.equal("token_hash" in visibleHost, false);

    result = await call({ action: "sync", ...host, state: position });
    const visibleFriend = result.body.players.find((player) => player.id === friend.id);
    assert.equal(visibleFriend.x, -21);
    assert.deepEqual(visibleFriend.outfit, changedOutfit);
    assert.equal(result.body.players.some((player) => player.id === stranger.id), false);

    result = await call({ action: "sync", ...host, token: "a".repeat(64), state: { ...position, score: 999999 } });
    assert.equal(result.response.status, 401);
    result = await call({ action: "sync", ...friend, state: position });
    assert.equal(result.body.players.find((player) => player.id === host.id).score, 1800);

    result = await call({ action: "sync", ...host, state: { ...position, x: null } });
    assert.equal(result.response.status, 400);
    result = await call({ action: "join", code: "bad", name: "Invalid", outfit });
    assert.equal(result.response.status, 400);
    result = await call({ action: "create", name: "", outfit });
    assert.equal(result.response.status, 400);

    result = await call({ action: "leave", ...friend });
    assert.equal(result.response.status, 200);
    result = await call({ action: "sync", ...host, state: position });
    assert.equal(result.body.players.length, 1);
    result = await call({ action: "sync", ...friend, state: position });
    assert.equal(result.response.status, 401);
  } finally {
    await Promise.all(sessions.map((session) => call({ action: "leave", ...session }).catch(() => {})));
  }
});

test("simultaneous joins cannot exceed eight active riders", async () => {
  const host = await create("Capacity host");
  const sessions = [host];
  try {
    const results = await Promise.all(Array.from({ length: 9 }, (_, i) => call({ action: "join", code: host.code, name: `Rider ${i + 1}`, outfit })));
    for (const result of results) if (result.response.status === 201) sessions.push(result.body);
    assert.equal(results.filter((result) => result.response.status === 201).length, 7);
    assert.equal(results.filter((result) => result.response.status === 409).length, 2);
    const result = await call({ action: "sync", ...host, state: position });
    assert.equal(result.response.status, 200, result.body.error);
    assert.equal(result.body.players.length, 8);
  } finally {
    await Promise.all(sessions.map((session) => call({ action: "leave", ...session }).catch(() => {})));
  }
});
