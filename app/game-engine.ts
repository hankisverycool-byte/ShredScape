import { createMountain3D } from './renderer3d';
export type Outfit = {
  jacket: string;
  pants: string;
  hat: string;
  gear: "snowboard" | "skis";
};

export type Peer = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  angle: number;
  outfit: Outfit;
  score: number;
};

export type GameSnapshot = {
  score: number;
  best: number;
  combo: number;
  multiplier: number;
  trick: string;
  speed: number;
  airborne: boolean;
  distance: number;
  bailed: boolean;
  playing: boolean;
  x: number;
  y: number;
  z: number;
  angle: number;
};

type Point = [number, number];
type Feature = { kind: "tree" | "rock" | "ramp" | "rail" | "flag"; x: number; y: number; size: number; seed: number; id: string };
type Particle = { x: number; y: number; z: number; vx: number; vy: number; life: number; size: number };
type Floater = { text: string; color: string; time: number; x: number; y: number };

const W = 960;
const H = 600;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const center = (y: number) => Math.sin(y * 0.0017) * 68 + Math.sin(y * 0.00043) * 42;
const defaultOutfit: Outfit = { jacket: "#ba603e", pants: "#344e4d", hat: "#ddbd73", gear: "snowboard" };

/** The mountain is deterministic: every rider in a room sees the same features. */
function featuresNear(y: number): Feature[] {
  const features: Feature[] = [];
  const first = Math.floor((y - 800) / 180);
  const last = Math.floor((y + 1600) / 180);
  for (let row = first; row <= last; row++) {
    if (row < -1) continue;
    const ry = row * 180;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {
        const seed = row * 47 + i * 13 + side * 7;
        const yy = ry + hash(seed + 7) * 175;
        features.push({ kind: "tree", x: center(yy) + side * (255 + hash(seed) * 280), y: yy, size: 0.8 + hash(seed + 3) * 0.55, seed, id: `t${row}-${side}-${i}` });
      }
    }
    if (row >= 1) {
      const yy = ry + 95;
      features.push({ kind: "ramp", x: center(yy) + Math.sin(row * 1.88) * 115, y: yy, size: 1, seed: row, id: `r${row}` });
      if (row % 3 === 0) features.push({ kind: "rail", x: center(ry) - 135, y: ry + 25, size: 1, seed: row, id: `g${row}` });
      if (row % 2 === 0) features.push({ kind: "rock", x: center(ry) + (hash(row * 3) > 0.5 ? 1 : -1) * (130 + hash(row + 4) * 65), y: ry + 145, size: 0.8 + hash(row) * 0.4, seed: row, id: `b${row}` });
    }
    if (row >= 0 && row % 2 === 0) {
      for (const side of [-1, 1]) features.push({ kind: "flag", x: center(ry + 35) + side * 223, y: ry + 35, size: 1, seed: row + side, id: `f${row}-${side}` });
    }
  }
  return features;
}

export function createGame(canvas: HTMLCanvasElement, onUpdate: (s: GameSnapshot) => void) {
  const mountain = createMountain3D(canvas);
  const pressed = new Set<string>();
  const previousStyle = canvas.style.touchAction;
  canvas.style.touchAction = "none";
  let outfit = { ...defaultOutfit };
  let peers: Peer[] = [];
  let peerVisuals = new Map<string, Peer>();
  let x = 0, y = 0, z = 0, vz = 0, vx = 0, speed = 0, angle = 0;
  let camera = -65, score = 0, best = 0, combo = 0, multiplier = 1;
  let playing = false, destroyed = false, bail = 0, grace = 0, jumpCooldown = 0;
  let trick = "Ready for a little altitude?", messageTime = 0;
  let spinTime = 0, flipTime = 0, grabTime = 0, trickCooldown = 0;
  let clock = 0, last = performance.now(), publishClock = 0, raf = 0;
  let trackTime = 0, currentFeatures = featuresNear(0), featureChunk = 0;
  let lastFeature = "", bankDisplay = 0;
  const trickCounts: Record<string, number> = {};
  const particles: Particle[] = [];
  const floaters: Floater[] = [];
  const tracks: { x: number; y: number; angle: number; gear: string }[] = [];
  try { best = Number(localStorage.getItem("shredscape-best") || 0) || 0; } catch { /* Storage is optional. */ }

  function float(label: string, color = "#e4bf68") {
    floaters.push({ text: label, color, time: 1.5, x, y });
    if (floaters.length > 5) floaters.shift();
  }

  function addTrick(name: string, value: number) {
    const repeats = trickCounts[name] || 0;
    trickCounts[name] = repeats + 1;
    const earned = Math.max(35, Math.round(value / (1 + repeats * 1.5)));
    combo += earned;
    if (!repeats) multiplier = Math.min(8, Object.keys(trickCounts).length + 1);
    trick = repeats ? `${name} · ${earned}` : name;
    messageTime = 2;
    float(`${name.toUpperCase()} +${earned}`, "#fff2c8");
  }

  function beginJump(ramp = false) {
    if (!playing || bail > 0 || z > 0 || jumpCooldown > 0) return;
    bankDisplay = 0; combo = 0; multiplier = 1;
    Object.keys(trickCounts).forEach(key => delete trickCounts[key]);
    vz = ramp ? 340 : 275;
    z = 1;
    trick = ramp ? "Big air! J · K · L" : "Air time! J · K · L";
    messageTime = 2;
    if (ramp) addTrick("Ramp launch", 100);
    spray(8);
  }

  function land() {
    z = 0; vz = 0; jumpCooldown = 0.3; grace = 0.5;
    spinTime = flipTime = grabTime = 0;
    if (combo > 0) {
      const points = combo * multiplier;
      score += points;
      if (score > best) {
        best = score;
        try { localStorage.setItem("shredscape-best", String(best)); } catch { /* Optional storage. */ }
      }
      trick = `Clean landing! +${points.toLocaleString()}`;
      float(`BANKED +${points.toLocaleString()}`, "#b8e5bd");
      messageTime = 2.2; bankDisplay = 1.6;
    } else {
      trick = "Clean landing"; messageTime = 1;
    }
    spray(12);
  }

  function crash() {
    if (bail > 0 || grace > 0) return;
    bail = 1.45; speed *= 0.1; vx *= 0.2; z = 0; vz = 0;
    combo = 0; multiplier = 1; bankDisplay = 0;
    spinTime = flipTime = grabTime = 0;
    trick = "Wipeout! Unbanked combo lost."; messageTime = 2.5;
    float("WIPEOUT", "#f0a68a"); spray(22);
  }

  function spray(count: number) {
    for (let i = 0; i < count; i++) {
      const n = clock * 112 + i * 13;
      particles.push({ x: x + (hash(n) - 0.5) * 14, y: y - 7, z: hash(n + 1) * 8, vx: (hash(n + 2) - 0.5) * 100, vy: -30 - hash(n + 3) * 55, life: 0.35 + hash(n + 4) * 0.45, size: 2 + hash(n + 5) * 3 });
    }
    if (particles.length > 110) particles.splice(0, particles.length - 110);
  }

  function snapshot(): GameSnapshot {
    return { score, best, combo, multiplier, trick, speed: Math.round(speed * 0.18), airborne: z > 0, distance: Math.floor(y / 10), bailed: bail > 0, playing, x, y, z, angle };
  }

  function publish() { onUpdate(snapshot()); }

  function reset() {
    x = 0; y = 0; z = 0; vz = 0; vx = 0; speed = 0; angle = 0; camera = -65;
    score = 0; combo = 0; multiplier = 1; bail = 0; grace = 1; jumpCooldown = 0;
    spinTime = 0; flipTime = 0; grabTime = 0; trickCooldown = 0; bankDisplay = 0;
    trick = "Fresh tracks. Make them count."; messageTime = 2; lastFeature = "";
    Object.keys(trickCounts).forEach(key => delete trickCounts[key]);
    particles.length = 0; floaters.length = 0; tracks.length = 0; pressed.clear();
    currentFeatures = featuresNear(0); featureChunk = 0;
    publish();
  }

  const aliases: Record<string, string> = {
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
    Space: "jump", KeyJ: "grab", KeyK: "spin", KeyL: "flip", KeyR: "restart",
    a: "left", d: "right", w: "up", s: "down", j: "grab", k: "spin", l: "flip", r: "restart", " ": "jump",
  };

  function input(action: string, down: boolean) {
    action = aliases[action] || action;
    const wasDown = pressed.has(action);
    if (down) pressed.add(action); else pressed.delete(action);
    if (!down || wasDown) return;
    if (action === "restart") { reset(); playing = true; publish(); return; }
    if (action === "jump") { beginJump(); return; }
    if (!playing || z <= 0 || bail > 0 || trickCooldown > 0) return;
    if (action === "grab") { grabTime = 0.55; addTrick(outfit.gear === "skis" ? "Mute grab" : "Indy grab", 180); }
    if (action === "spin") { spinTime = 0.65; addTrick("360 spin", 300); }
    if (action === "flip") { flipTime = 0.65; addTrick("Backflip", 450); }
    if (["grab", "spin", "flip"].includes(action)) trickCooldown = 0.16;
  }

  function isEditing(target: EventTarget | null) {
    return target instanceof HTMLElement && (target.matches("input,textarea,select") || target.isContentEditable);
  }

  function keyDown(e: KeyboardEvent) {
    if (isEditing(e.target)) return;
    const action = aliases[e.code];
    if (!action) return;
    if (["left", "right", "up", "down", "jump"].includes(action)) e.preventDefault();
    input(action, true);
  }
  function keyUp(e: KeyboardEvent) { const action = aliases[e.code]; if (action) input(action, false); }
  function blur() { pressed.clear(); }
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", blur);

  function update(dt: number) {
    clock += dt;
    trickCooldown = Math.max(0, trickCooldown - dt);
    jumpCooldown = Math.max(0, jumpCooldown - dt);
    grace = Math.max(0, grace - dt);
    spinTime = Math.max(0, spinTime - dt);
    flipTime = Math.max(0, flipTime - dt);
    grabTime = Math.max(0, grabTime - dt);
    messageTime = Math.max(0, messageTime - dt);
    if (bankDisplay > 0) {
      bankDisplay -= dt;
      if (bankDisplay <= 0) { combo = 0; multiplier = 1; }
    }
    if (playing) {
      if (bail > 0) {
        bail = Math.max(0, bail - dt);
        if (bail === 0) grace = 1.8;
      } else {
        const steering = Number(pressed.has("right")) - Number(pressed.has("left"));
        const offPiste = Math.abs(x - center(y)) > 245;
        const targetSpeed = pressed.has("down") ? 70 : pressed.has("up") ? 295 : 205;
        speed += ((offPiste ? targetSpeed * 0.62 : targetSpeed) - speed) * Math.min(1, dt * 1.1);
        vx += (steering * (z > 0 ? 170 : 220) - vx) * Math.min(1, dt * 6);
        x = clamp(x + vx * dt, -560, 560);
        y += speed * dt;
        angle += (steering * 0.48 - angle) * Math.min(1, dt * 8);
        if (z > 0) {
          vz -= 440 * dt; z += vz * dt;
          if (z <= 0) land();
        } else if (speed > 35) {
          trackTime += dt;
          if (trackTime > 0.08) {
            tracks.push({ x, y, angle, gear: outfit.gear }); trackTime = 0;
            if (tracks.length > 180) tracks.shift();
            if (Math.abs(vx) > 30 || pressed.has("down")) spray(2);
          }
        }
        const chunk = Math.floor(y / 180);
        if (chunk !== featureChunk) { featureChunk = chunk; currentFeatures = featuresNear(y); }
        for (const feature of currentFeatures) {
          if (feature.id === lastFeature) continue;
          const dx = Math.abs(x - feature.x), dy = Math.abs(y - feature.y);
          if (dy > 24 + speed * dt || dx > 50) continue;
          if (feature.kind === "ramp" && dx < 32 && dy < 18 && z === 0 && speed > 40) {
            lastFeature = feature.id; beginJump(true);
          } else if (feature.kind === "rail" && dx < 19 && dy < 19 && z < 15 && speed > 30) {
            lastFeature = feature.id;
            if (z === 0) { combo = 0; multiplier = 1; bankDisplay = 0; Object.keys(trickCounts).forEach(key => delete trickCounts[key]); }
            z = 20; vz = 135; addTrick("50-50 grind", 350); grace = 1;
          } else if ((feature.kind === "tree" || feature.kind === "rock") && dx < (feature.kind === "rock" ? 22 : 13) * feature.size && dy < 17 * feature.size && z < 15 && grace <= 0) {
            lastFeature = feature.id; crash(); break;
          }
        }
      }
      camera += (y - 65 - camera) * Math.min(1, dt * 7);
      if (messageTime === 0 && z === 0) trick = "Find a kicker. Chase a bigger combo.";
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += 10 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].time -= dt; if (floaters[i].time <= 0) floaters.splice(i, 1); }
    const nextVisuals = new Map<string, Peer>();
    for (const peer of peers) {
      const old = peerVisuals.get(peer.id);
      const t = Math.min(1, dt * 9);
      // Snap after a restart instead of interpolating across the mountain.
      const smooth = old && Math.abs(old.y - peer.y) < 400;
      nextVisuals.set(peer.id, smooth ? { ...peer, x: old.x + (peer.x - old.x) * t, y: old.y + (peer.y - old.y) * t, z: old.z + (peer.z - old.z) * t } : { ...peer });
    }
    peerVisuals = nextVisuals;
    publishClock += dt;
    if (publishClock >= 0.08) { publishClock = 0; publish(); }
  }

  function draw() { mountain.draw({x,y,z,angle,speed,clock,bail,spin:spinTime,flip:flipTime,grab:grabTime,playing,outfit,features:currentFeatures,peers:[...peerVisuals.values()],particles}); }
  function frame(now: number) {
    if (destroyed) return;
    const dt = Math.min(.035, Math.max(0, (now - last) / 1000)); last = now;
    update(dt); draw(); raf = requestAnimationFrame(frame);
  }
  publish(); raf = requestAnimationFrame(frame);

  return {
    start() { playing = true; grace = Math.max(grace, .8); publish(); },
    pause() { playing = false; pressed.clear(); publish(); },
    reset,
    destroy() {
      destroyed = true; cancelAnimationFrame(raf); mountain.destroy();
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur);
      canvas.style.touchAction = previousStyle;
    },
    setOutfit(value: Outfit) { outfit = { ...value }; },
    setPeers(value: Peer[]) { peers = value; },
    input,
  };
}
