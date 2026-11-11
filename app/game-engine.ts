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
  const last = Math.floor((y + 700) / 180);
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
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Your browser does not support the game canvas.");
  const ctx = context;
  canvas.width = W;
  canvas.height = H;
  canvas.style.imageRendering = "pixelated";
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
  try { best = Number(localStorage.getItem("slopescape-best") || 0) || 0; } catch { /* Storage is optional. */ }

  function project(px: number, py: number, pz = 0): Point {
    return [Math.round(W * 0.5 + px * 0.91 + (py - camera) * 0.42), Math.round(310 + (py - camera) * 0.66 - px * 0.14 - pz)];
  }

  function poly(points: Point[], fill: string, stroke?: string, width = 1) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(Math.round(p[0]), Math.round(p[1])) : ctx.moveTo(Math.round(p[0]), Math.round(p[1])));
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }

  function line(points: Point[], color: string, width = 1) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }

  function text(label: string, px: number, py: number, color: string, size = 12, align: CanvasTextAlign = "center") {
    ctx.font = `bold ${size}px monospace`; ctx.textAlign = align; ctx.textBaseline = "middle";
    ctx.fillStyle = color; ctx.fillText(label, Math.round(px), Math.round(py));
  }

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
        try { localStorage.setItem("slopescape-best", String(best)); } catch { /* Optional storage. */ }
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

  function drawBackdrop() {
    ctx.fillStyle = "#9cb9be"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#c9d9d5"; ctx.fillRect(0, 35, W, 90);
    ctx.fillStyle = "#e3e1cb"; ctx.fillRect(723, 27, 30, 30);
    ctx.fillStyle = "#edf0d7"; ctx.fillRect(727, 23, 22, 38); ctx.fillRect(719, 31, 38, 22);
    poly([[0, 125], [80, 66], [125, 100], [218, 28], [290, 98], [337, 62], [432, 134]], "#7f9da7");
    poly([[107, 125], [218, 28], [290, 98], [237, 74], [217, 48], [193, 85]], "#d5e3df");
    poly([[390, 148], [486, 64], [530, 103], [605, 44], [709, 146]], "#93aeb4");
    poly([[543, 103], [605, 44], [648, 86], [611, 71], [595, 87], [581, 81]], "#e2e9de");
    poly([[680, 143], [774, 73], [815, 103], [897, 38], [960, 98], [960, 166]], "#6f939e");
    poly([[842, 94], [897, 38], [937, 77], [900, 64], [886, 75], [875, 70]], "#dce8df");
    poly([[0, 130], [138, 103], [272, 142], [407, 106], [592, 147], [756, 115], [960, 145], [960, H], [0, H]], "#c6d7d5");
    // Distant conifers give the ridgeline a soft, low-poly silhouette.
    for (let i = 0; i < 55; i++) {
      const tx = i * 19 + hash(i) * 6, ty = 153 + hash(i + 8) * 22, th = 10 + hash(i + 2) * 16;
      poly([[tx, ty - th], [tx - th * .3, ty], [tx + th * .3, ty]], i % 2 ? "#8ba9a8" : "#98b4b0");
    }
  }

  function drawSnow() {
    poly([[0, 171], [180, 146], [396, 171], [665, 154], [960, 175], [960, H], [0, H]], "#dce8e3");
    ctx.save(); ctx.beginPath(); ctx.rect(0, 168, W, H - 168); ctx.clip();
    const first = Math.floor((camera - 500) / 100);
    // Broad snow polygons keep a hand-made, early 3D terrain feel.
    for (let iy = first; iy < first + 15; iy++) {
      for (let ix = -8; ix <= 8; ix++) {
        const yy = iy * 100, xx = ix * 100;
        const shade = hash(ix * 19 + iy * 79);
        const color = shade < 0.14 ? "#d1e1df" : shade < 0.4 ? "#d7e5e1" : "#dce8e3";
        poly([project(xx, yy), project(xx + 100, yy), project(xx + 100, yy + 100), project(xx, yy + 100)], color);
      }
    }
    const left: Point[] = [], right: Point[] = [];
    for (let yy = camera - 520; yy <= camera + 700; yy += 40) { left.push(project(center(yy) - 233, yy)); right.push(project(center(yy) + 233, yy)); }
    poly([...left, ...right.reverse()], "#ecf0e7");
    const trailLeft: Point[] = [], trailRight: Point[] = [];
    for (let yy = camera - 520; yy <= camera + 700; yy += 50) { trailLeft.push(project(center(yy) - 234, yy)); trailRight.push(project(center(yy) + 234, yy)); }
    line(trailLeft, "#bed2d1", 3); line(trailRight, "#cfdfdb", 3);
    // Tiny deterministic ice flecks move with the ground, not the screen.
    for (let i = Math.floor((camera - 500) / 28); i <= Math.ceil((camera + 600) / 28); i++) {
      for (let j = 0; j < 5; j++) {
        const fx = (hash(i * 17 + j * 97) - .5) * 1150, fy = i * 28 + hash(i + j * 3) * 22;
        const p = project(fx, fy);
        ctx.fillStyle = j % 2 ? "#c5d7d4" : "#fbfaf0";
        ctx.fillRect(p[0], p[1], 3 + hash(i + j) * 5, 1);
      }
    }
    for (const t of tracks) {
      const p = project(t.x, t.y);
      if (p[1] < 160 || p[1] > H + 20) continue;
      ctx.strokeStyle = "#cfddda"; ctx.lineWidth = 2;
      if (t.gear === "skis") {
        line([[p[0] - 4, p[1]], [p[0] - 8 - t.angle * 5, p[1] - 9]], "#c8d9d5", 1);
        line([[p[0] + 4, p[1]], [p[0] - t.angle * 5, p[1] - 9]], "#c8d9d5", 1);
      } else line([[p[0] - 4, p[1] - 8], [p[0], p[1]]], "#cbdad6", 3);
    }
    ctx.restore();
  }

  function drawTree(f: Feature) {
    const [px, py] = project(f.x, f.y), s = f.size;
    poly([[px - 8 * s, py + 3], [px + 15 * s, py + 4], [px + 57 * s, py + 25 * s], [px + 28 * s, py + 25 * s]], "#bdcfcb");
    ctx.fillStyle = "#675d48"; ctx.fillRect(px - 4 * s, py - 20 * s, 8 * s, 23 * s);
    for (let tier = 0; tier < 3; tier++) {
      const base = py - (14 + tier * 20) * s, width = (36 - tier * 8) * s, top = base - (48 - tier * 5) * s;
      poly([[px, top], [px - width, base], [px, base + 10 * s], [px + width, base]], "#41665b");
      poly([[px, top], [px, base + 10 * s], [px + width, base]], "#31534e");
      poly([[px, top - 2], [px - width * .8, base - 9 * s], [px - width * .38, base - 12 * s], [px - width * .1, base - 4 * s], [px + width * .65, base - 7 * s]], "#e7ede2");
      poly([[px, top - 2], [px + width * .65, base - 7 * s], [px + width * .1, base - 15 * s]], "#c8dad4");
    }
  }

  function drawRock(f: Feature) {
    const [px, py] = project(f.x, f.y), s = f.size;
    poly([[px - 23 * s, py], [px + 31 * s, py + 12], [px + 40 * s, py + 4], [px, py - 10]], "#c2d3ce");
    poly([[px - 22 * s, py], [px - 19 * s, py - 21 * s], [px + 2 * s, py - 31 * s], [px + 21 * s, py - 16 * s], [px + 27 * s, py + 3], [px + 2, py + 9]], "#88999a");
    poly([[px + 2 * s, py - 31 * s], [px + 21 * s, py - 16 * s], [px + 27 * s, py + 3], [px + 2, py + 9]], "#687e80");
    poly([[px - 19 * s, py - 21 * s], [px + 2 * s, py - 31 * s], [px + 21 * s, py - 16 * s], [px + 10 * s, py - 13 * s], [px - 5 * s, py - 17 * s], [px - 12 * s, py - 13 * s]], "#f1f2e9");
  }

  function drawRamp(f: Feature) {
    const a = project(f.x - 34, f.y - 38), b = project(f.x + 34, f.y - 38);
    const c = project(f.x + 34, f.y + 12, 19), d = project(f.x - 34, f.y + 12, 19);
    const baseC = project(f.x + 34, f.y + 12), baseD = project(f.x - 34, f.y + 12);
    poly([a, b, c, d], "#be9762", "#7b684b", 2);
    poly([d, c, baseC, baseD], "#806649", "#675840");
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      line([[a[0] + (d[0] - a[0]) * t, a[1] + (d[1] - a[1]) * t], [b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t]], "#97774d", 2);
    }
    line([d, c], "#f0ddae", 3);
    const middle = project(f.x, f.y - 8, 14);
    poly([[middle[0] - 6, middle[1] - 4], [middle[0] + 5, middle[1] - 6], [middle[0] + 14, middle[1] + 2], [middle[0] + 3, middle[1]]], "#f5e8be");
  }

  function drawRail(f: Feature) {
    const start = project(f.x, f.y - 34, 18), end = project(f.x, f.y + 42, 18);
    const baseStart = project(f.x, f.y - 34), baseEnd = project(f.x, f.y + 42);
    line([baseStart, start], "#455d5f", 4); line([baseEnd, end], "#455d5f", 4);
    line([start, end], "#3c555b", 7); line([[start[0], start[1] - 3], [end[0], end[1] - 3]], "#b0c6c4", 3);
    for (const p of [baseStart, baseEnd]) { ctx.fillStyle = "#a5bdb9"; ctx.fillRect(p[0] - 6, p[1], 12, 3); }
  }

  function drawFlag(f: Feature) {
    const [px, py] = project(f.x, f.y);
    line([[px + 3, py + 3], [px + 22, py + 9]], "#bdcec9", 3);
    line([[px, py], [px, py - 42]], "#6f6a4e", 3);
    const flutter = Math.sin(clock * 3 + f.seed) * 2;
    poly([[px, py - 42], [px + 21, py - 38 + flutter], [px + 15, py - 30 + flutter], [px, py - 32]], "#c69c50");
    line([[px + 1, py - 41], [px + 18, py - 37 + flutter]], "#e6c979", 2);
  }

  function drawChalet() {
    const [px, py] = project(-325, -100);
    if (py < 70 || py > H + 200) return;
    poly([[px - 65, py], [px + 20, py + 35], [px + 118, py + 6], [px + 30, py - 32]], "#becfc9");
    poly([[px - 50, py - 12], [px - 50, py - 78], [px + 22, py - 50], [px + 22, py + 18]], "#997448", "#6d573f", 2);
    poly([[px + 22, py - 50], [px + 87, py - 84], [px + 87, py - 17], [px + 22, py + 18]], "#725b40", "#5b503e", 2);
    for (let i = 0; i < 5; i++) { line([[px - 50, py - 16 - i * 12], [px + 22, py + 12 - i * 12]], "#785d3f", 2); line([[px + 22, py + 12 - i * 12], [px + 87, py - 23 - i * 12]], "#594c38", 2); }
    poly([[px - 65, py - 73], [px + 10, py - 127], [px + 36, py - 58], [px + 27, py - 46]], "#eff1e7", "#c3d2cd", 2);
    poly([[px + 10, py - 127], [px + 100, py - 91], [px + 36, py - 58]], "#d9e5df", "#bacdc8", 2);
    poly([[px - 65, py - 73], [px - 50, py - 78], [px + 22, py - 50], [px + 36, py - 58], [px + 27, py - 46]], "#d2dfd8");
    poly([[px - 34, py - 59], [px - 12, py - 51], [px - 12, py - 28], [px - 34, py - 36]], "#edc778", "#5b513e", 3);
    line([[px - 23, py - 56], [px - 23, py - 32]], "#6e593a", 2);
    poly([[px + 43, py - 33], [px + 65, py - 44], [px + 65, py - 5], [px + 43, py + 7]], "#433f33", "#b5955e", 2);
    const sign = project(-165, 23);
    line([[sign[0], sign[1]], [sign[0], sign[1] - 52]], "#756044", 5);
    ctx.fillStyle = "#6d6046"; ctx.fillRect(sign[0] - 40, sign[1] - 63, 91, 27);
    ctx.strokeStyle = "#b49a67"; ctx.lineWidth = 2; ctx.strokeRect(sign[0] - 40, sign[1] - 63, 91, 27);
    text("FROSTPEAK ↘", sign[0] + 5, sign[1] - 49, "#f0dfb2", 10);
  }

  function rider(px: number, py: number, pz: number, lean: number, clothes: Outfit, local = false, label = "") {
    const ground = project(px, py), position = project(px, py, pz);
    ctx.fillStyle = local ? "#9bb6ae" : "#baccc7";
    ctx.beginPath(); ctx.ellipse(ground[0] + 3, ground[1] + 3, Math.max(8, 18 - pz * .04), Math.max(3, 6 - pz * .01), .25, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(position[0], position[1]);
    if (local && bail > 0) { ctx.rotate(-1.2); ctx.translate(-5, 5); }
    else {
      ctx.rotate(lean * .25);
      if (local && spinTime > 0) ctx.scale(Math.cos((.65 - spinTime) / .65 * Math.PI * 2) * .4 + .6, 1);
      if (local && flipTime > 0) ctx.rotate((.65 - flipTime) / .65 * Math.PI * 2);
    }
    const grabbing = local && grabTime > 0;
    if (clothes.gear === "snowboard") {
      poly([[-20, -1], [-23, 3], [-15, 7], [17, 8], [23, 4], [20, 1]], "#6b4d3a", "#384a45", 1);
      poly([[-20, 0], [-17, 4], [16, 6], [20, 2]], "#d2af64");
      line([[-8, 1], [8, 3]], "#eee5c4", 2);
    } else {
      line([[-9, -14], [2, 16]], "#4c5b54", 5); line([[4, -17], [15, 13]], "#4c5b54", 5);
      line([[-9, -14], [2, 13]], "#dfb96f", 3); line([[4, -17], [15, 10]], "#dfb96f", 3);
      line([[-18, -29], [-22, 7]], "#6c7770", 2); line([[17, -31], [27, 1]], "#6c7770", 2);
    }
    poly([[-8, -18], [3, -16], [2, 1], [-9, 0]], clothes.pants, "#344447");
    poly([[3, -18], [12, -19], [13, 0], [5, 2]], clothes.pants, "#344447");
    ctx.fillStyle = "#344447"; ctx.fillRect(-11, -2, 13, 5); ctx.fillRect(4, -1, 13, 5);
    poly([[-12, -38], [6, -41], [15, -24], [11, -15], [-8, -12], [-15, -25]], clothes.jacket, "#42504a", 1);
    poly([[5, -39], [12, -36], [16, -23], [10, -18], [4, -22]], clothes.jacket);
    ctx.globalAlpha = .14; poly([[5, -39], [12, -36], [16, -23], [10, -18], [4, -22]], "#142a2b"); ctx.globalAlpha = 1;
    line([[-3, -34], [0, -17]], "#e4d1a2", 2);
    line([[-11, -33], [-21, grabbing ? -7 : -23], [-16, grabbing ? 0 : -18]], clothes.jacket, 8);
    line([[10, -34], [21, -28], [grabbing ? 15 : 25, grabbing ? -6 : -23]], clothes.jacket, 7);
    ctx.fillStyle = "#3d4945"; ctx.fillRect(-19, grabbing ? -3 : -21, 6, 6); ctx.fillRect(grabbing ? 12 : 23, grabbing ? -8 : -25, 6, 6);
    poly([[-8, -48], [7, -49], [11, -38], [4, -33], [-7, -37]], "#c9966b", "#635e4c");
    poly([[-11, -49], [-7, -58], [5, -60], [12, -53], [12, -46], [-9, -44]], clothes.hat, "#505b4d");
    ctx.fillStyle = "#e2cc93"; ctx.fillRect(-3, -63, 7, 6);
    poly([[-8, -45], [10, -48], [11, -42], [-6, -40]], "#384e4e", "#b5c9bb", 1);
    line([[-4, -43], [3, -44]], "#a7cccb", 2);
    ctx.restore();
    if (label) {
      const safeLabel = label.slice(0, 18);
      ctx.font = "bold 11px monospace";
      const width = ctx.measureText(safeLabel).width + 14;
      ctx.fillStyle = "#284a48dd"; ctx.fillRect(position[0] - width / 2, position[1] - 84, width, 17);
      text(safeLabel, position[0], position[1] - 75, "#f0e5c3", 11);
    }
  }

  function draw() {
    drawBackdrop(); drawSnow();
    ctx.save(); ctx.beginPath(); ctx.rect(0, 150, W, H - 150); ctx.clip();
    const renderables: { depth: number; draw: () => void }[] = [];
    for (const f of currentFeatures) {
      const p = project(f.x, f.y);
      if (p[0] < -100 || p[0] > W + 100 || p[1] < 155 || p[1] > H + 140) continue;
      renderables.push({ depth: p[1], draw: () => {
        if (f.kind === "tree") drawTree(f);
        else if (f.kind === "rock") drawRock(f);
        else if (f.kind === "ramp") drawRamp(f);
        else if (f.kind === "rail") drawRail(f);
        else drawFlag(f);
      } });
    }
    renderables.push({ depth: project(-325, -100)[1], draw: drawChalet });
    for (const peer of peerVisuals.values()) {
      const p = project(peer.x, peer.y);
      if (p[0] < -50 || p[0] > W + 50 || p[1] < 150 || p[1] > H + 50) continue;
      renderables.push({ depth: p[1], draw: () => rider(peer.x, peer.y, peer.z, peer.angle, peer.outfit, false, peer.name) });
    }
    renderables.push({ depth: project(x, y)[1], draw: () => rider(x, y, z, angle, outfit, true) });
    renderables.sort((a, b) => a.depth - b.depth).forEach(item => item.draw());
    for (const p of particles) {
      const pos = project(p.x, p.y, p.z);
      ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = "#ffffff"; ctx.fillRect(pos[0], pos[1], p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const f of floaters) {
      const p = project(f.x, f.y, 110 + (1.5 - f.time) * 40);
      ctx.globalAlpha = Math.min(1, f.time * 2);
      ctx.font = "bold 13px monospace";
      const width = ctx.measureText(f.text).width + 18;
      ctx.fillStyle = "#304b47e8"; ctx.fillRect(p[0] - width / 2, p[1] - 11, width, 22);
      text(f.text, p[0], p[1], f.color, 13);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Snowflakes are sparse so the course remains readable on small screens.
    for (let i = 0; i < 26; i++) {
      const px = (hash(i + 99) * W + clock * (5 + hash(i) * 8)) % W;
      const py = (hash(i + 44) * H + clock * (8 + hash(i + 8) * 12)) % H;
      ctx.fillStyle = i % 3 ? "#ffffff77" : "#ffffffb8"; ctx.fillRect(px, py, i % 4 === 0 ? 3 : 2, 2);
    }
    // A quiet map marker connects the scenery to the surrounding lodge interface.
    if (grace > 0 && bail === 0 && playing) {
      const p = project(x, y);
      ctx.strokeStyle = "#d2b36388"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p[0], p[1] + 2, 25, 9, .2, 0, Math.PI * 2); ctx.stroke();
    }
  }

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
      destroyed = true; cancelAnimationFrame(raf);
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", blur);
      canvas.style.touchAction = previousStyle;
    },
    setOutfit(value: Outfit) { outfit = { ...value }; },
    setPeers(value: Peer[]) { peers = value; },
    input,
  };
}
