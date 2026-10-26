/* SNAKE.EXE v1.0 - built by Maithem (project owner) */
(() => {
  "use strict";

  /* ================= helpers ================= */
  const $ = (id) => document.getElementById(id);
  const rr = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const HEX = "0123456789ABCDEF";
  const rhex = (n) => { let s = ""; while (n--) s += HEX[(Math.random() * 16) | 0]; return s; };
  const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixc = (A, B, t) => "rgb(" + ((A[0] + (B[0] - A[0]) * t) | 0) + "," + ((A[1] + (B[1] - A[1]) * t) | 0) + "," + ((A[2] + (B[2] - A[2]) * t) | 0) + ")";

  /* ================= config & state ================= */
  const N = 20;
  const LEVELS = { easy: { ms: 150 }, normal: { ms: 110 }, hard: { ms: 75 } };
  const COIN_EVERY = { easy: 3, normal: 2, hard: 1 }; // apples needed for 1 coin (harder = better pay)

  const store = {
    get() { try { return +localStorage.getItem("snake_best") || 0; } catch (e) { return 0; } },
    set(v) { try { localStorage.setItem("snake_best", v); } catch (e) {} },
  };

  let device = matchMedia("(pointer: coarse)").matches ? "mobile" : "pc";
  let level = "normal";
  let walls = true; // false = edges teleport
  try {
    const p = JSON.parse(localStorage.getItem("snake_prefs"));
    if (p) { if (LEVELS[p.level]) level = p.level; walls = p.walls !== false; }
  } catch (e) {}
  const savePrefs = () => { try { localStorage.setItem("snake_prefs", JSON.stringify({ level, walls })); } catch (e) {} };

  let save = { coins: 0, owned: ["classic", "none"], skin: "classic", badge: "none", apple: "classic", board: "classic", codes: [], master: false, stats: { games: 0, apples: 0, coins: 0, bestCombo: 0 } };
  try { const d = JSON.parse(localStorage.getItem("snake_save_v1")); if (d) save = Object.assign(save, d); } catch (e) {}
  const persist = () => { try { localStorage.setItem("snake_save_v1", JSON.stringify(save)); } catch (e) {} };

  let state = "menu"; // menu | play | pause | over
  let snake, dir, queue, apple, score, ms, acc = 0, last = 0, cell = 20, old = [], apples = 0, bonus = null, runCoins = 0, tick = 0, lastEat = -99, combo = 0, dead = false, overTok = 0;
  let best = store.get();

  // low-power mode: starts on for weak devices, also switches on by itself if frames get slow
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lite = !!(reduced || (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2));
  let autoLite = true, slowN = 0;

  const board = $("board"), bx = board.getContext("2d");
  const rain = $("rain"), rx = rain.getContext("2d");
  const logEl = $("log");

  /* ================= skins ================= */
  // every skin is green/black + code themed. gl = glyphs printed on the body, gc = glyph colour.
  // extras: pulse (size wave) / drip (falling glyphs) / quantum (jitter copies) / line (drawn as a signal) / aura / tag / flicker / hot
  const SKINS = [
    { id: "classic", name: "Hello World", price: 0, head: "#d4ffe2", a: "#00e85c", b: "#00b84a", mode: "alt", trail: "code", glow: "rgba(0,255,102,.18)" },
    { id: "binary", name: "Binary", price: 20, head: "#eafff1", a: "#052e12", b: "#04210e", mode: "alt", edge: "#00a844", gl: "01", gc: "#3dff8a", pulse: true, trail: "code", glow: "rgba(0,255,102,.2)" },
    { id: "hex", name: "Hex", price: 35, head: "#e6fff8", a: "#06301f", b: "#042419", mode: "alt", edge: "#16c79a", gl: "0123456789ABCDEF", gc: "#6dffd0", trail: "code", tcol: ["#6dffd0", "#16c79a"], glow: "rgba(22,199,154,.22)",
      tag: (s) => "0x" + (0x7f00 + s * 16).toString(16).toUpperCase() },
    { id: "terminal", name: "Terminal", price: 50, head: "#00ff66", a: "#031a0a", b: "#02120a", mode: "alt", edge: "#00ff66", gl: ">_$#", gc: "#00ff66", cursor: true, flicker: true, glow: "rgba(0,255,102,.25)",
      tag: (s, t) => "~$ " + (((t / 500) | 0) % 2 ? "_" : " ") },
    { id: "loader", name: "Progress Bar", price: 65, head: "#ffffff", a: "#00ff66", b: "#052e12", mode: "load", edge: "#00a844", trail: "spark", glow: "rgba(0,255,102,.22)" },
    { id: "brackets", name: "Brackets", price: 80, head: "#f0ffd8", a: "#0a2a14", b: "#07200f", mode: "alt", edge: "#7dff3a", gl: "{}()[];<>/", gc: "#b6ff6a", pulse: true, trail: "code", tcol: ["#b6ff6a", "#7dff3a"], glow: "rgba(125,255,58,.22)" },
    { id: "matrix", name: "Matrix", price: 95, head: "#eafff1", a: "#033a16", b: "#052f12", mode: "alt", edge: "#00a844", gl: "01ABCDEF", gc: "#4dff94", drip: true, trail: "code", glow: "rgba(0,255,102,.26)" },
    { id: "glitch", name: "Glitch", price: 115, head: "#ffffff", mode: "void", vc: ["#00ff66", "#eafff1"], trail: "glitch", tcol: ["#00ff66", "#ffffff", "#00a844"], glow: "rgba(0,255,102,.26)" },
    { id: "signal", name: "Signal", price: 135, head: "#eafff1", a: "#00c24e", b: "#b6ffcf", edge: "#006d2b", line: true, trail: "spark", glow: "rgba(0,255,102,.28)" },
    { id: "overclock", name: "Overclock", price: 155, head: "#ffffff", ramp: ["#ffffff", "#00ff66", "#00601f"], mode: "ramp", pulse: true, hot: true, trail: "spark", glow: "rgba(0,255,102,.32)" },
    { id: "quantum", name: "Quantum", price: 180, head: "#ffffff", a: "#0a2a14", b: "#06200f", mode: "alt", edge: "#9dffbf", quantum: true, trail: "star", tcol: ["#ffffff", "#9dffbf"], glow: "rgba(157,255,191,.25)",
      tag: () => "|0>+|1>" },
    { id: "root", name: "Root", price: 205, head: "#ffffff", a: "#0a0f0c", b: "#050806", mode: "alt", edge: "#ffffff", gl: "#$", gc: "#ffffff", aura: "#ffffff", trail: "code", tcol: ["#ffffff", "#9dffbf"], glow: "rgba(255,255,255,.2)",
      tag: () => "root@snake" },
    { id: "ghost", name: "Ghost Shell", price: 230, head: "#d4ffe2", a: "#00ff66", b: "#00c24e", mode: "alt", alpha: 0.55, flicker: true, aura: "#00ff66", edge: "#00ff66", trail: "smoke", tcol: ["#00ff66", "#005a22"], glow: "rgba(0,255,102,.2)" },
    { id: "syntax", name: "Syntax Highlight", price: 260, head: "#ffffff", mode: "pal", pal: ["#c586c0", "#569cd6", "#ce9178", "#6a9955", "#dcdcaa", "#4ec9b0"], gl: ["fn", "if", "=>", "{}", "let", "++", "&&"], gm: 0.42, gs: true, gc: "#0b0b0b", trail: "code", tcol: ["#569cd6", "#c586c0", "#dcdcaa"], glow: "rgba(86,156,214,.25)" },
    { id: "void", name: "∞ Void", price: 0, head: "#ffffff", mode: "void", trail: "glitch", secret: true, glow: "rgba(8,247,254,.28)" },
  ];
  SKINS.forEach((s) => { if (s.a) { s.A = hx(s.a); s.B = hx(s.b); } if (s.ramp) s.R = s.ramp.map(hx); });

  const BADGES = [
    { id: "none", name: "None", price: 0 },
    { id: "shades", name: "Shades", price: 15 },
    { id: "visor", name: "Cyber Visor", price: 30 },
    { id: "antenna", name: "Antenna", price: 45 },
    { id: "hood", name: "Hacker Hood", price: 60 },
    { id: "tag", name: "Code Tag </>", price: 80 },
    { id: "sudo", name: "Sudo #", price: 100 },
    { id: "flame", name: "Green Flame", price: 130 },
    { id: "crown", name: "Admin Crown", price: 180 },
  ];
  const APPLES = [
    { id: "classic", name: "Apple", price: 0, glow: "rgba(255,59,92,.16)", burst: ["#ff3b5c", "#ffd24a", "#ffffff"] },
    { id: "bit", name: "Bit", price: 20, glow: "rgba(0,255,102,.2)", burst: ["#00ff66", "#9dffbf", "#ffffff"] },
    { id: "bug", name: "Bug", price: 35, glow: "rgba(255,59,92,.16)", burst: ["#ff3b5c", "#ffb3c1", "#ffffff"] },
    { id: "chip", name: "Data Chip", price: 50, glow: "rgba(0,255,102,.2)", burst: ["#00ff66", "#9dffbf", "#ffffff"] },
    { id: "braces", name: "Braces { }", price: 70, glow: "rgba(0,255,102,.2)", burst: ["#00ff66", "#003d1a", "#ffffff"] },
    { id: "key", name: "Root Key", price: 95, glow: "rgba(0,255,102,.2)", burst: ["#00ff66", "#eafff1", "#ffffff"] },
    { id: "virus", name: "Virus", price: 130, glow: "rgba(255,59,92,.2)", burst: ["#ff3b5c", "#00ff66", "#ffffff"] },
  ];
  const BOARDS = [
    { id: "classic", name: "Classic", price: 0, bg: "#020a04", grid: "rgba(0,255,102,.06)", border: "#00ff66", glow: "rgba(0,255,102,.25)" },
    { id: "crt", name: "Terminal CRT", price: 30, bg: "#010c05", grid: "rgba(0,255,102,.05)", lines: true, vig: true, border: "#00ff66", glow: "rgba(0,255,102,.3)" },
    { id: "bits", name: "Binary Wall", price: 45, bg: "#020a04", grid: "rgba(0,255,102,.04)", txt: "01", txtc: "rgba(0,255,102,.13)", border: "#00c24e", glow: "rgba(0,255,102,.22)" },
    { id: "hexdump", name: "Hex Dump", price: 60, bg: "#020a04", grid: "rgba(0,255,102,.04)", txt: "0123456789ABCDEF", txtc: "rgba(22,199,154,.14)", border: "#16c79a", glow: "rgba(22,199,154,.25)" },
    { id: "circuit", name: "Circuit", price: 85, bg: "#021008", grid: "rgba(0,255,102,.04)", circuit: true, border: "#00ff66", glow: "rgba(0,255,102,.28)" },
    { id: "editor", name: "Code Editor", price: 110, bg: "#030d07", grid: "rgba(0,255,102,.035)", editor: true, border: "#00c24e", glow: "rgba(0,255,102,.22)" },
    { id: "mainframe", name: "Mainframe", price: 140, bg: "#010a06", grid: "rgba(0,255,102,.08)", major: "rgba(0,255,102,.2)", step: 5, scan: "rgba(0,255,102,.07)", border: "#9dffbf", glow: "rgba(0,255,102,.4)" },
  ];
  const CATS = { skin: SKINS, badge: BADGES, apple: APPLES, board: BOARDS };
  // items from older versions that no longer exist are removed and refunded
  const LEGACY = { ice: 25, toxic: 40, lava: 55, ocean: 70, gold: 100, sakura: 120, violet: 140, galaxy: 200, chrome: 240, shadow: 280, rainbow: 350,
    hat: 70, horns: 90, halo: 120, cherry: 30, golden: 50, orb: 90, coin: 110, diamond: 150, checker: 40, midnight: 60, blueprint: 80, crimson: 100, amber: 120, neon: 150 };
  const ALL_IDS = new Set([].concat(SKINS, BADGES, APPLES, BOARDS).map((k) => k.id));
  let migrated = 0;
  save.owned = save.owned.filter((id) => { if (ALL_IDS.has(id)) return true; migrated += LEGACY[id] || 0; return false; });
  save.coins += migrated;
  ["skin", "badge", "apple", "board"].forEach((k) => { if (!CATS[k].some((x) => x.id === save[k])) save[k] = k === "badge" ? "none" : "classic"; });
  if (migrated) persist();
  const curApple = () => APPLES.find((k) => k.id === save.apple) || APPLES[0];
  const curBoard = () => BOARDS.find((k) => k.id === save.board) || BOARDS[0];
  const curSkin = () => SKINS.find((k) => k.id === save.skin) || SKINS[0];
  const curBadge = () => BADGES.find((k) => k.id === save.badge) || BADGES[0];

  function skinColor(sk, i, n, t) {
    if (i === 0) return sk.head;
    switch (sk.mode) {
      case "pal": return sk.pal[i % sk.pal.length];
      case "load": { const pos = (t / 90) % (n + 4); return i === (pos | 0) ? "#ffffff" : i < pos ? sk.a : sk.b; }
      case "void": { const v = sk.vc || ["#08f7fe", "#ff2e63"]; return (i + ((t / 130) | 0)) & 1 ? v[0] : v[1]; }
      case "wave": return mixc(sk.A, sk.B, (Math.sin(i * 0.55 - t / 240) + 1) / 2);
      case "ramp": {
        const L = sk.R.length - 1;
        let p = (i / Math.max(1, n - 1)) * L + Math.sin(i * 1.3 - t / 110) * 0.12;
        p = p < 0 ? 0 : p > L ? L : p;
        const k = Math.min(L - 1, p | 0);
        return mixc(sk.R[k], sk.R[k + 1], p - k);
      }
      default: return i % 2 ? sk.a : sk.b;
    }
  }

  /* ================= particles (trails, eat/crash bursts) ================= */
  const TR = {
    snow:   { c: ["#ffffff", "#bfefff"], vx: [-8, 8], vy: [8, 24], l: 0.9, s: 2 },
    bubble: { c: ["#bfeaff", "#ffffff"], vx: [-6, 6], vy: [-30, -12], l: 1, s: 3 },
    ember:  { c: ["#ffb347", "#ff5a1f", "#ffe08a"], vx: [-10, 10], vy: [-36, -14], l: 0.7, s: 2 },
    petal:  { c: ["#ffb7d5", "#ff8fb8"], vx: [-18, 18], vy: [10, 26], l: 1.1, s: 3 },
    star:   { c: ["#ffffff", "#ffe9a8", "#b9a6ff"], vx: [-6, 6], vy: [-8, 8], l: 0.8, s: 2 },
    glitch: { c: ["#08f7fe", "#ff2e63", "#ffffff"], vx: [-24, 24], vy: [-24, 24], l: 0.35, s: 3 },
    smoke:  { c: ["#7a4cff", "#43308f"], vx: [-6, 6], vy: [-18, -6], l: 1, s: 4 },
    code:   { c: ["#00ff66", "#9dffbf"], vx: [0, 0], vy: [14, 34], l: 0.8, s: 0 },
    spark:  { c: ["#00ff66", "#b6ffcf", "#ffffff"], vx: [-14, 14], vy: [-40, -16], l: 0.5, s: 2 },
  };
  const gScene = { parts: [], rings: [], lt: 0 };

  function addPart(sc, x, y, vx, vy, life, c, s, ch) {
    if (sc.parts.length < 96) sc.parts.push({ x, y, vx, vy, life, max: life, c, s, ch });
  }
  function emitTrail(sc, sk, px, py) {
    const T = TR[sk.trail];
    if (!T || sc.parts.length >= 28) return;
    addPart(sc, px + rr(-3, 3), py + rr(-3, 3), rr(T.vx[0], T.vx[1]), rr(T.vy[0], T.vy[1]),
      T.l * rr(0.7, 1.3), sk.tcol ? pick(sk.tcol) : pick(T.c), T.s, T.s ? "" : HEX[(Math.random() * 16) | 0]);
  }
  function burstParts(sc, px, py, cols, n) {
    for (let i = 0; i < n; i++) addPart(sc, px, py, rr(-80, 80), rr(-80, 80), rr(0.3, 0.6), pick(cols), 3, "");
  }
  function stepParts(sc, dt) {
    const P = sc.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  function drawParts(g, sc, u) {
    const P = sc.parts;
    if (!P.length) return;
    g.textAlign = "center"; g.textBaseline = "middle";
    const F1 = Math.max(8, (u * 0.5) | 0) + "px monospace", F2 = "bold " + Math.max(10, (u * 0.6) | 0) + "px monospace";
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      g.font = p.ch.length > 1 ? F2 : F1;
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.fillStyle = p.c;
      if (p.ch) g.fillText(p.ch, p.x, p.y); else g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    g.globalAlpha = 1;
  }

  /* ================= drawing: eyes, badges, snake, apple ================= */
  function drawEyes(g, cx, cy, u, d, sk) {
    const e = Math.max(3, u * 0.22), f = u * 0.14, sd = u * 0.22;
    for (let k = -1; k <= 1; k += 2) {
      const ex = cx + d.x * f - d.y * sd * k, ey = cy + d.y * f + d.x * sd * k;
      g.fillStyle = sk.eye || "#ffffff";
      g.fillRect(ex - e / 2, ey - e / 2, e, e);
      if (!sk.eye) {
        const p = e * 0.5;
        g.fillStyle = "#020a04";
        g.fillRect(ex - p / 2 + d.x * e * 0.2, ey - p / 2 + d.y * e * 0.2, p, p);
      }
    }
  }

  // badges are vector-drawn so they match the green/black coding style
  function drawBadge(g, id, cx, cy, u, d, t) {
    if (id === "none") return;
    g.save();
    if (id === "shades" || id === "visor") { // follows the facing direction
      g.translate(cx, cy);
      g.rotate(Math.atan2(d.y, d.x));
      g.fillStyle = "#020604";
      if (id === "shades") {
        g.fillRect(u * 0.04, -u * 0.46, u * 0.3, u * 0.92);
        g.fillStyle = "#00ff66"; g.fillRect(u * 0.09, -u * 0.38, u * 0.05, u * 0.24); g.fillRect(u * 0.09, u * 0.14, u * 0.05, u * 0.24);
      } else {
        g.fillRect(u * 0.04, -u * 0.46, u * 0.08, u * 0.92);
        g.fillStyle = "rgba(0,255,102," + (0.5 + 0.5 * Math.sin(t / 180)).toFixed(2) + ")"; g.fillRect(u * 0.12, -u * 0.46, u * 0.1, u * 0.92);
      }
      g.restore();
      return;
    }
    const y0 = cy - u * 0.34;
    const tri = (a, b, c, e, f, h) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, e); g.lineTo(f, h); g.closePath(); g.fill(); };
    g.textAlign = "center"; g.textBaseline = "middle";
    if (id === "crown") {
      const w = u * 0.74;
      g.fillStyle = "#00ff66";
      g.beginPath(); g.moveTo(cx - w / 2, y0); g.lineTo(cx - w / 2, y0 - u * 0.36); g.lineTo(cx - w / 4, y0 - u * 0.18);
      g.lineTo(cx, y0 - u * 0.42); g.lineTo(cx + w / 4, y0 - u * 0.18); g.lineTo(cx + w / 2, y0 - u * 0.36); g.lineTo(cx + w / 2, y0);
      g.closePath(); g.fill();
      g.fillStyle = "#00a844"; g.fillRect(cx - w / 2, y0 - u * 0.1, w, u * 0.1);
      g.fillStyle = "#ffffff"; g.fillRect(cx - u * 0.05, y0 - u * 0.26, u * 0.1, u * 0.1);
    } else if (id === "hood") {
      g.fillStyle = "#050806";
      g.beginPath(); g.moveTo(cx - u * 0.52, cy + u * 0.02); g.lineTo(cx - u * 0.42, cy - u * 0.42); g.lineTo(cx, cy - u * 0.66);
      g.lineTo(cx + u * 0.42, cy - u * 0.42); g.lineTo(cx + u * 0.52, cy + u * 0.02); g.lineTo(cx + u * 0.3, cy - u * 0.18); g.lineTo(cx - u * 0.3, cy - u * 0.18);
      g.closePath(); g.fill();
      g.strokeStyle = "#00ff66"; g.lineWidth = Math.max(1, u * 0.06); g.stroke();
    } else if (id === "tag") {
      g.fillStyle = "rgba(2,10,4,.9)"; g.fillRect(cx - u * 0.5, cy - u * 0.95, u, u * 0.36);
      g.strokeStyle = "#00ff66"; g.lineWidth = 1; g.strokeRect(cx - u * 0.5 + 0.5, cy - u * 0.95 + 0.5, u - 1, u * 0.36 - 1);
      g.font = "bold " + ((u * 0.4) | 0) + "px monospace"; g.fillStyle = "#00ff66"; g.fillText("</>", cx, cy - u * 0.77);
    } else if (id === "sudo") {
      const by = cy - u * 0.7 + Math.sin(t / 300) * u * 0.04;
      g.strokeStyle = "rgba(0,255,102,.55)"; g.lineWidth = Math.max(1.5, u * 0.07);
      g.beginPath(); g.arc(cx, by, u * 0.34, 0, 6.283); g.stroke();
      g.font = "bold " + ((u * 0.5) | 0) + "px monospace"; g.fillStyle = "#eafff1"; g.fillText("#", cx, by + 1);
    } else if (id === "flame") {
      const h = u * (0.55 + 0.12 * Math.sin(t / 70));
      g.fillStyle = "#00a844"; tri(cx - u * 0.3, y0 + u * 0.04, cx, y0 - h, cx + u * 0.3, y0 + u * 0.04);
      g.fillStyle = "#00ff66"; tri(cx - u * 0.19, y0 + u * 0.04, cx + Math.sin(t / 90) * u * 0.05, y0 - h * 0.7, cx + u * 0.19, y0 + u * 0.04);
      g.fillStyle = "#eafff1"; tri(cx - u * 0.09, y0 + u * 0.04, cx, y0 - h * 0.4, cx + u * 0.09, y0 + u * 0.04);
    } else if (id === "antenna") {
      g.fillStyle = "#9fb3a8"; g.fillRect(cx - u * 0.03, cy - u * 0.82, u * 0.06, u * 0.46);
      g.fillStyle = ((t / 400) | 0) % 2 ? "#ffffff" : "#00ff66";
      g.beginPath(); g.arc(cx, cy - u * 0.84, u * 0.1, 0, 6.283); g.fill();
    }
    g.restore();
  }

  // "signal" skins: the body is drawn as one glowing line with data pulses running along it
  function paintLine(g, segs, n, u, sk, t) {
    const w = u * 0.5, half = u / 2;
    g.lineCap = "round"; g.lineJoin = "round";
    const path = () => {
      g.beginPath(); g.moveTo(segs[0].x * u + half, segs[0].y * u + half);
      for (let i = 1; i < n; i++) {
        const a = segs[i - 1], c = segs[i], x = c.x * u + half, y = c.y * u + half;
        if (Math.abs(a.x - c.x) > 1.5 || Math.abs(a.y - c.y) > 1.5) g.moveTo(x, y); else g.lineTo(x, y);
      }
    };
    path(); g.strokeStyle = sk.edge; g.lineWidth = w + 3; g.stroke();
    path(); g.strokeStyle = sk.a; g.lineWidth = w; g.stroke();
    path(); g.strokeStyle = sk.b; g.lineWidth = w * 0.3; g.stroke();
    g.fillStyle = "#ffffff";
    for (let k = 0; k < 3; k++) {
      const s = segs[((t / 70 + (k * n) / 3) % n) | 0];
      g.beginPath(); g.arc(s.x * u + half, s.y * u + half, w * 0.38, 0, 6.283); g.fill();
    }
  }

  function paintSnake(g, segs, n, u, sk, bd, d, t, score) {
    const fx = !lite;
    const q = (t / 70) | 0;
    const glitch = fx && sk.mode === "void" && ((t / 90) | 0) % 8 === 0;
    g.font = Math.max(8, (u * 0.68 * (sk.gm || 1)) | 0) + "px monospace";
    g.textAlign = "center"; g.textBaseline = "middle";
    const alpha = (sk.alpha || 1) * (fx && sk.flicker ? 0.82 + 0.18 * Math.sin(t / 60) : 1);

    if (sk.line) paintLine(g, segs, n, u, sk, t);
    else {
      g.globalAlpha = alpha;
      for (let i = n - 1; i >= 1; i--) { // body, tail first
        const s = segs[i], k = n - 1 - i;
        let sc = n > 6 && k < 3 ? 1 - (3 - k) * 0.09 : 1; // tail tapers
        if (fx && sk.pulse) sc *= 1 + Math.sin(i * 0.6 - t / 90) * 0.09;
        const sz = u * sc - 2;
        const px = s.x * u + (u - sz) / 2 + (glitch ? ((((i * 13 + ((t / 90) | 0)) % 5) - 2) * u * 0.07) : 0);
        const py = s.y * u + (u - sz) / 2;
        if (sk.edge) { g.fillStyle = sk.edge; g.fillRect(px - 1, py - 1, sz + 2, sz + 2); }
        if (glitch) {
          g.fillStyle = sk.vc ? "rgba(0,255,102,.55)" : "rgba(8,247,254,.55)"; g.fillRect(px - 2, py, sz, sz);
          g.fillStyle = sk.vc ? "rgba(255,255,255,.4)" : "rgba(255,46,99,.55)"; g.fillRect(px + 2, py, sz, sz);
        }
        if (fx && sk.quantum) { // superposition: jittering ghost copy
          g.fillStyle = "rgba(157,255,191,.35)";
          g.fillRect(px + Math.sin(i * 12.9898 + q * 7.233) * u * 0.14, py + Math.cos(i * 4.1414 + q * 3.17) * u * 0.14, sz, sz);
        }
        g.fillStyle = skinColor(sk, i, n, t); g.fillRect(px, py, sz, sz);
        g.fillStyle = "rgba(255,255,255,.17)"; g.fillRect(px, py, sz, Math.max(1, sz * 0.26));
        g.fillStyle = "rgba(0,0,0,.24)"; g.fillRect(px, py + sz * 0.74, sz, sz * 0.26);
        if (sk.gl) {
          const gi = sk.gs ? i : i * 7 + ((t / 140) | 0) * 3;
          g.fillStyle = sk.gc; g.fillText(sk.gl[gi % sk.gl.length], px + sz / 2, py + sz / 2 + 1);
        }
        if (fx && sk.drip && i % 3 === 0) { // matrix-style glyphs dripping off the body
          const ph = (t / 120 + i * 3.7) % 4;
          g.globalAlpha = (1 - ph / 4) * 0.5 * alpha; g.fillStyle = sk.gc;
          g.fillText(HEX[(i * 5 + ((t / 100) | 0)) & 15], px + sz / 2, py + sz + ph * u * 0.4);
          g.globalAlpha = alpha;
        }
      }
      if (glitch) { // corrupted data blocks flying around
        g.fillStyle = "rgba(0,255,102,.5)";
        for (let k = 0; k < 3; k++) { const s = segs[(Math.random() * n) | 0]; g.fillRect(s.x * u + rr(-u, u), s.y * u + rr(-u, u), rr(3, u * 0.6), rr(2, u * 0.25)); }
      }
      g.globalAlpha = 1;
    }

    if (fx && sk.shine) { // light sweep
      const c = ((t / 55) % (n + 10)) - 5;
      for (let i = Math.max(1, Math.ceil(c - 3)); i <= Math.min(n - 1, c + 3); i++) {
        const a = 1 - Math.abs(i - c) / 3.2;
        if (a <= 0) continue;
        g.fillStyle = "rgba(255,255,255," + (a * 0.5).toFixed(2) + ")";
        g.fillRect(segs[i].x * u + 1, segs[i].y * u + 1, u - 2, u - 2);
      }
    }
    if (fx && sk.spark) { // twinkles
      for (let k = 0; k < 3; k++) {
        const s = segs[((q * 2654435761 + k * 40503) >>> 0) % n], cx = s.x * u + u / 2, cy = s.y * u + u / 2;
        g.fillStyle = "#fff";
        g.fillRect(cx - 1, cy - 1, 2, 2); g.fillRect(cx - 3, cy, 6, 1); g.fillRect(cx, cy - 3, 1, 6);
      }
    }

    // head
    const h = segs[0], x0 = h.x * u, y0 = h.y * u, cx = x0 + u / 2, cy = y0 + u / 2;
    if (fx && sk.glow) { g.fillStyle = sk.glow; g.fillRect(x0 - 2, y0 - 2, u + 4, u + 4); }
    if (fx && sk.aura) { // pulsing ring around the head
      g.strokeStyle = sk.aura; g.lineWidth = 1.5; g.globalAlpha = 0.5 + 0.3 * Math.sin(t / 200);
      g.beginPath(); g.arc(cx, cy, u * (0.85 + 0.08 * Math.sin(t / 260)), 0, 6.283); g.stroke();
      g.globalAlpha = 1;
    }
    if (((t / 650) | 0) % 5 === 0) { // tongue flick
      const th = Math.max(1.5, u * 0.09), L = u * 0.42;
      g.save(); g.translate(cx, cy); g.rotate(Math.atan2(d.y, d.x)); g.fillStyle = "#ff3b5c";
      g.fillRect(u * 0.4, -th / 2, L, th);
      g.fillRect(u * 0.4 + L * 0.7, -th * 2, L * 0.3, th);
      g.fillRect(u * 0.4 + L * 0.7, th, L * 0.3, th);
      g.restore();
    }
    if (sk.edge) { g.fillStyle = sk.edge; g.fillRect(x0, y0, u, u); }
    g.fillStyle = sk.cursor && ((t / 500) | 0) % 2 ? "#031a0a" : sk.head; g.fillRect(x0 + 0.5, y0 + 0.5, u - 1, u - 1);
    g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(x0 + 0.5, y0 + 0.5, u - 1, u * 0.26);
    g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(x0 + 0.5, y0 + u * 0.75, u - 1, u * 0.25 - 0.5);
    drawEyes(g, cx, cy, u, d, sk);
    drawBadge(g, bd.id, cx, cy, u, d, t);
    if (fx && sk.tag && bd.id === "none") { // floating code label
      const txt = sk.tag(score | 0, t);
      g.font = Math.max(8, (u * 0.34) | 0) + "px monospace";
      const w = g.measureText(txt).width;
      g.fillStyle = "rgba(2,10,4,.85)"; g.fillRect(cx - w / 2 - 3, y0 - u * 0.62, w + 6, u * 0.36);
      g.fillStyle = sk.gc || "#9dffbf"; g.fillText(txt, cx, y0 - u * 0.44);
    }
  }

  function drawApple(g, a, u, t, id) {
    const ap = APPLES.find((k) => k.id === id) || APPLES[0];
    const cx = a.x * u + u / 2, cy = a.y * u + u / 2 + 1, r = u * 0.34 + Math.sin(t / 260) * u * 0.02;
    if (!lite) { g.fillStyle = ap.glow; g.beginPath(); g.arc(cx, cy, r + 3, 0, 6.283); g.fill(); }
    g.textAlign = "center"; g.textBaseline = "middle";
    switch (ap.id) {
      case "bit": {
        const h = r * 0.95;
        g.fillStyle = "#04210e"; g.fillRect(cx - h, cy - h, h * 2, h * 2);
        g.strokeStyle = "#00ff66"; g.lineWidth = 1.5; g.strokeRect(cx - h + 0.5, cy - h + 0.5, h * 2 - 1, h * 2 - 1);
        g.fillStyle = "#00ff66"; g.font = "bold " + ((r * 1.4) | 0) + "px monospace";
        g.fillText(((t / 260) | 0) % 2 ? "1" : "0", cx, cy + 1);
        break;
      }
      case "bug": {
        const w = Math.sin(t / 90) * 1.5;
        g.strokeStyle = "#ffb3c1"; g.lineWidth = 1.5; g.beginPath();
        for (let k = -1; k <= 1; k++) {
          g.moveTo(cx - r * 0.5, cy + k * r * 0.5); g.lineTo(cx - r * 1.1, cy + k * r * 0.7 + w * k);
          g.moveTo(cx + r * 0.5, cy + k * r * 0.5); g.lineTo(cx + r * 1.1, cy + k * r * 0.7 - w * k);
        }
        g.moveTo(cx - r * 0.2, cy - r * 0.8); g.lineTo(cx - r * 0.5, cy - r * 1.2);
        g.moveTo(cx + r * 0.2, cy - r * 0.8); g.lineTo(cx + r * 0.5, cy - r * 1.2);
        g.stroke();
        g.fillStyle = "#ff3b5c"; g.beginPath(); g.ellipse(cx, cy, r * 0.62, r * 0.85, 0, 0, 6.283); g.fill();
        g.fillStyle = "#4a0a18"; g.fillRect(cx - 1, cy - r * 0.6, 2, r * 1.2); g.fillRect(cx - r * 0.35, cy - 1, 2, 2); g.fillRect(cx + r * 0.2, cy + 2, 2, 2);
        break;
      }
      case "chip": {
        const h = r * 0.95;
        g.fillStyle = "#00ff66";
        for (let k = -1; k <= 1; k++) {
          g.fillRect(cx - h - 2, cy + k * h * 0.55 - 1, 2, 2); g.fillRect(cx + h, cy + k * h * 0.55 - 1, 2, 2);
          g.fillRect(cx + k * h * 0.55 - 1, cy - h - 2, 2, 2); g.fillRect(cx + k * h * 0.55 - 1, cy + h, 2, 2);
        }
        g.fillStyle = "#04210e"; g.fillRect(cx - h, cy - h, h * 2, h * 2);
        g.strokeStyle = "#00ff66"; g.lineWidth = 1; g.strokeRect(cx - h + 0.5, cy - h + 0.5, h * 2 - 1, h * 2 - 1);
        g.fillStyle = "rgba(0,255,102," + (0.45 + 0.45 * Math.sin(t / 220)).toFixed(2) + ")"; g.fillRect(cx - h * 0.45, cy - h * 0.45, h * 0.9, h * 0.9);
        break;
      }
      case "braces": {
        g.font = "bold " + ((r * 1.8) | 0) + "px monospace";
        g.fillStyle = "#003d1a"; g.fillText("{}", cx + 1, cy + 2);
        g.fillStyle = "#00ff66"; g.fillText("{}", cx, cy + 1);
        break;
      }
      case "key": {
        g.save(); g.translate(cx, cy); g.rotate(-0.6 + Math.sin(t / 500) * 0.08);
        g.strokeStyle = "#00ff66"; g.fillStyle = "#00ff66"; g.lineWidth = 2;
        g.beginPath(); g.arc(-r * 0.55, 0, r * 0.4, 0, 6.283); g.stroke();
        g.fillRect(-r * 0.15, -1, r * 1.2, 2); g.fillRect(r * 0.7, 0, 2, r * 0.35); g.fillRect(r * 0.95, 0, 2, r * 0.25);
        g.restore();
        break;
      }
      case "virus": {
        const sp = t / 600;
        g.strokeStyle = "#ff3b5c"; g.lineWidth = 1.5; g.beginPath();
        for (let k = 0; k < 8; k++) { const an = sp + k * 0.785; g.moveTo(cx + Math.cos(an) * r * 0.8, cy + Math.sin(an) * r * 0.8); g.lineTo(cx + Math.cos(an) * r * 1.25, cy + Math.sin(an) * r * 1.25); }
        g.stroke();
        g.fillStyle = "#ff3b5c"; g.beginPath(); g.arc(cx, cy, r * 0.8, 0, 6.283); g.fill();
        g.fillStyle = "#020a04"; g.fillRect(cx - r * 0.35, cy - r * 0.2, 2, 2); g.fillRect(cx + r * 0.15, cy - r * 0.2, 2, 2); g.fillRect(cx - r * 0.3, cy + r * 0.25, r * 0.6, 2);
        break;
      }
      default:
        g.fillStyle = "#ff3b5c"; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.fill();
        g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(cx - r * 0.55, cy - r * 0.55, Math.max(2, r * 0.3), Math.max(2, r * 0.3));
        g.fillStyle = "#7a4a1e"; g.fillRect(cx - 1, cy - r - 3, 2, 4);
        g.fillStyle = "#00ff66"; g.fillRect(cx + 1, cy - r - 3, Math.max(3, r * 0.5), 2);
    }
  }

  // bonus coin: appears now and then, vanishes after ~9s, worth 5 coins
  function drawBonus(g, b, u, t) {
    if (b.ttl < 3000 && ((t / 140) | 0) % 2) return;
    const cx = b.x * u + u / 2, cy = b.y * u + u / 2, r = u * 0.36, wd = Math.max(0.15, Math.abs(Math.cos(t / 280)));
    if (!lite) { g.fillStyle = "rgba(255,210,74,.2)"; g.beginPath(); g.arc(cx, cy, r + 3, 0, 6.283); g.fill(); }
    g.fillStyle = "#c98f00"; g.beginPath(); g.ellipse(cx, cy, r * wd + 1.2, r + 1.2, 0, 0, 6.283); g.fill();
    g.fillStyle = "#ffd24a"; g.beginPath(); g.ellipse(cx, cy, r * wd, r, 0, 0, 6.283); g.fill();
    if (wd > 0.5) { g.fillStyle = "#7a4a00"; g.font = "bold " + ((r * 1.3) | 0) + "px monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("¢", cx, cy + 1); }
  }

  // board themes are painted once into a cached canvas, then just copied each frame (fast on weak PCs)
  function paintBoard(g, w, h, u, th) {
    let seed = 7;
    const rnd = () => (((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff)) / 0x7fffffff);
    const cols = Math.ceil(w / u), rows = Math.ceil(h / u);
    g.fillStyle = th.bg; g.fillRect(0, 0, w, h);
    if (th.txt) {
      g.font = Math.max(5, (u * 0.55) | 0) + "px monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = th.txtc;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) g.fillText(th.txt[(rnd() * th.txt.length) | 0], x * u + u / 2, y * u + u / 2 + 1);
    }
    if (th.circuit) {
      g.strokeStyle = "rgba(0,255,102,.17)"; g.lineWidth = 1.5; g.fillStyle = "rgba(0,255,102,.32)";
      for (let k = 0; k < (cols * rows) / 9; k++) {
        const x = (rnd() * cols) | 0, y = (rnd() * rows) | 0, len = 2 + ((rnd() * 4) | 0), hz = rnd() < 0.5;
        const x2 = hz ? Math.min(cols, x + len) : x, y2 = hz ? y : Math.min(rows, y + len);
        g.beginPath(); g.moveTo(x * u + u / 2, y * u + u / 2); g.lineTo(x2 * u + u / 2, y2 * u + u / 2); g.stroke();
        g.fillRect(x * u + u / 2 - 2, y * u + u / 2 - 2, 4, 4); g.fillRect(x2 * u + u / 2 - 2, y2 * u + u / 2 - 2, 4, 4);
      }
    }
    if (th.editor) {
      g.font = Math.max(5, (u * 0.42) | 0) + "px monospace"; g.textAlign = "left"; g.textBaseline = "middle";
      for (let y = 0; y < rows; y++) {
        g.fillStyle = "rgba(0,255,102,.26)"; g.fillText(String(y + 1), 3, y * u + u / 2 + 1);
        const ind = rnd() < 0.5 ? 0 : 1, len = 0.15 + rnd() * 0.5;
        g.fillStyle = "rgba(0,255,102,.07)"; g.fillRect(u * (1.2 + ind), y * u + u * 0.4, (w - u * 2) * len, u * 0.2);
      }
      g.fillStyle = "rgba(0,255,102,.1)"; g.fillRect(u * 1.05, 0, 1, h);
    }
    g.strokeStyle = th.grid; g.lineWidth = 1; g.beginPath();
    for (let x = u; x < w; x += u) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); }
    for (let y = u; y < h; y += u) { g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); }
    g.stroke();
    if (th.major) {
      g.strokeStyle = th.major; g.beginPath();
      for (let i = th.step; i * u < w; i += th.step) { g.moveTo(i * u + 0.5, 0); g.lineTo(i * u + 0.5, h); }
      for (let i = th.step; i * u < h; i += th.step) { g.moveTo(0, i * u + 0.5); g.lineTo(w, i * u + 0.5); }
      g.stroke();
    }
    if (th.lines) { g.fillStyle = "rgba(0,0,0,.22)"; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1); }
    if (th.vig) {
      const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.5)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  }
  const bgCache = {};
  function bgFor(th, w, h, u) {
    const key = th.id + "|" + w + "x" + h;
    let c = bgCache[key];
    if (!c) { c = document.createElement("canvas"); c.width = w; c.height = h; paintBoard(c.getContext("2d"), w, h, u, th); bgCache[key] = c; }
    return c;
  }
  function applyBoardLook() {
    const th = curBoard(), wrap = board.parentElement;
    wrap.style.setProperty("--bd", th.border);
    wrap.style.setProperty("--bdg", th.glow);
  }

  /* ================= menu state ================= */
  function refreshMenu() {
    document.querySelectorAll("[data-device]").forEach((b) => b.classList.toggle("active", b.dataset.device === device));
    document.querySelectorAll("[data-level]").forEach((b) => b.classList.toggle("active", b.dataset.level === level));
    document.querySelectorAll("[data-walls]").forEach((b) => b.classList.toggle("active", (b.dataset.walls === "on") === walls));
    $("best").textContent = best;
  }

  document.querySelectorAll("[data-device]").forEach((b) =>
    b.addEventListener("click", () => { device = b.dataset.device; refreshMenu(); sizeRain(); setLog("> input = " + device.toUpperCase()); }));
  document.querySelectorAll("[data-level]").forEach((b) =>
    b.addEventListener("click", () => { level = b.dataset.level; savePrefs(); refreshMenu(); setLog("> speed = " + LEVELS[level].ms + "ms/tick"); }));
  document.querySelectorAll("[data-walls]").forEach((b) =>
    b.addEventListener("click", () => {
      walls = b.dataset.walls === "on"; savePrefs(); refreshMenu();
      setLog(walls ? "> walls.enable() // edges kill" : "> walls.disable() // edges teleport");
    }));

  $("start").addEventListener("click", () => bootThen(start));
  $("again").addEventListener("click", start);
  $("resume").addEventListener("click", togglePause);
  $("pauseBtn").addEventListener("click", togglePause);
  document.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", toMenu));
  document.addEventListener("click", (e) => { if (e.target.blur && e.target.tagName !== "INPUT") e.target.blur(); });

  /* ================= game ================= */
  function fit() {
    const padH = device === "mobile" ? 150 : 0;
    const max = Math.min(innerWidth - 24, innerHeight - 120 - padH - (device === "mobile" ? 0 : 36), 560);
    cell = Math.max(10, Math.floor(max / N));
    board.width = board.height = cell * N;
    for (const k in bgCache) delete bgCache[k];
    $("game").style.setProperty("--size", board.width + "px");
    if (snake) draw();
  }

  function reset() {
    const m = N >> 1;
    snake = [{ x: m, y: m }, { x: m - 1, y: m }, { x: m - 2, y: m }];
    dir = { x: 1, y: 0 };
    queue = [];
    apples = 0;
    bonus = null;
    runCoins = 0;
    tick = 0; lastEat = -99; combo = 0; dead = false;
    showCombo();
    old = snake.slice();
    score = 0;
    acc = 0;
    ms = LEVELS[level].ms;
    gScene.parts.length = 0;
    gScene.rings.length = 0;
    gScene.lt = performance.now();
    placeApple();
    showScore();
  }

  function placeApple() {
    const used = new Set(snake.map((s) => s.y * N + s.x));
    const free = [];
    for (let i = 0; i < N * N; i++) if (!used.has(i)) free.push(i);
    if (!free.length) { apple = null; return; }
    const i = free[(Math.random() * free.length) | 0];
    apple = { x: i % N, y: (i / N) | 0 };
  }

  function showScore() {
    $("score").textContent = score;
    $("hi").textContent = Math.max(best, score);
  }

  function start() {
    reset();
    $("menu").classList.add("hidden");
    $("term").classList.add("hidden");
    $("game").classList.remove("hidden");
    $("over").classList.add("hidden");
    $("paused").classList.add("hidden");
    $("pad").classList.toggle("hidden", device !== "mobile");
    $("hint").textContent = (device === "mobile"
      ? "Swipe on the screen or use the pad"
      : "W A S D / arrows to move · Space = pause · Esc = menu") + (walls ? "" : " · no walls: edges teleport");
    board.parentElement.classList.toggle("nowall", !walls);
    applyBoardLook();
    $("gameLog").textContent = "";
    glog("> game.start(level=" + level + ", walls=" + walls + ")");
    if (!lite) { const wr = board.parentElement; wr.classList.remove("scan"); void wr.offsetWidth; wr.classList.add("scan"); }
    save.stats.games++; persist(); overTok++;
    state = "play";
    fit();
    draw();
  }

  function toMenu() {
    state = "menu";
    $("game").classList.add("hidden");
    $("menu").classList.remove("hidden");
    $("term").classList.remove("hidden");
    closeShop();
    fillCode();
    setTag(pick(TAGS));
    refreshMenu();
  }

  function togglePause() {
    if (state === "play") { state = "pause"; $("paused").classList.remove("hidden"); glog("> game.pause()"); }
    else if (state === "pause") { state = "play"; $("paused").classList.add("hidden"); glog("> game.resume()"); }
  }

  function turn(dx, dy) {
    if (state !== "play") return;
    const ref = queue.length ? queue[queue.length - 1] : dir;
    if (dx === -ref.x && dy === -ref.y) return; // no 180° turn
    if (dx === ref.x && dy === ref.y) return;
    if (queue.length < 3) queue.push({ x: dx, y: dy });
  }

  // in-game console: prints what the game is "running"
  function glog(txt) {
    const box = $("gameLog");
    if (box.lastChild && box.lastChild.textContent === txt) return;
    const d = document.createElement("div");
    d.textContent = txt;
    box.appendChild(d);
    while (box.childNodes.length > (device === "mobile" ? 1 : 3)) box.removeChild(box.firstChild);
  }
  const floatText = (px, py, txt, col) => addPart(gScene, px, py, 0, -30, 0.95, col, 1, txt);
  const showCombo = () => { $("combo").textContent = combo > 1 ? " x" + combo : ""; };
  function pulseBoard() { const w = board.parentElement; w.classList.remove("bpulse"); void w.offsetWidth; w.classList.add("bpulse"); }
  function stepRings(dt) { const R = gScene.rings; for (let i = R.length - 1; i >= 0; i--) { R[i].age += dt; if (R[i].age > 0.4) R.splice(i, 1); } }
  function drawRings(g, u) {
    const R = gScene.rings;
    for (let i = 0; i < R.length; i++) {
      g.globalAlpha = Math.max(0, 1 - R[i].age / 0.4); g.strokeStyle = R[i].col; g.lineWidth = 2;
      g.beginPath(); g.arc(R[i].x, R[i].y, u * (0.3 + R[i].age * 4), 0, 6.283); g.stroke();
    }
    g.globalAlpha = 1;
  }

  function gain(n) { save.coins += n; runCoins += n; save.stats.coins += n; persist(); showCoins(true); }

  function earn() { // coins: 1 per few apples (more on harder levels)
    apples++;
    if (apples % COIN_EVERY[level] === 0) { gain(1); return true; }
    return false;
  }

  function spawnBonus() {
    const used = new Set(snake.map((s) => s.y * N + s.x));
    if (apple) used.add(apple.y * N + apple.x);
    const free = [];
    for (let i = 0; i < N * N; i++) if (!used.has(i)) free.push(i);
    if (!free.length) return;
    const i = pick(free);
    bonus = { x: i % N, y: (i / N) | 0, ttl: 9000 };
    glog("> bonus.spawn() // +5¢ for 9s");
  }

  function step() {
    if (queue.length) dir = queue.shift();
    old = snake.slice();
    tick++;
    let x = snake[0].x + dir.x;
    let y = snake[0].y + dir.y;

    if (!walls) {
      const wrapped = x < 0 || y < 0 || x >= N || y >= N;
      x = (x + N) % N; y = (y + N) % N;
      if (wrapped) glog("> walls.wrap() // teleport to (" + x + "," + y + ")");
    } else if (x < 0 || y < 0 || x >= N || y >= N) return end(false, "wall collision at (" + x + "," + y + ")");

    const ate = apple && x === apple.x && y === apple.y;
    const len = snake.length - (ate ? 0 : 1); // tail moves away unless we grow
    for (let i = 0; i < len; i++) if (snake[i].x === x && snake[i].y === y) return end(false, "self collision at (" + x + "," + y + ")");

    if (bonus) { bonus.ttl -= ms; if (bonus.ttl <= 0) bonus = null; }
    snake.unshift({ x, y });

    if (bonus && x === bonus.x && y === bonus.y) {
      const bx0 = bonus.x * cell + cell / 2, by0 = bonus.y * cell + cell / 2;
      gain(5);
      floatText(bx0, by0, "+5¢", "#ffd24a");
      burstParts(gScene, bx0, by0, ["#ffd24a", "#fff3c4", "#ffffff"], lite ? 5 : 10);
      glog("> bonus.collect() // +5¢");
      bonus = null;
    }

    if (combo && tick - lastEat > 14) { combo = 0; showCombo(); }
    if (ate) {
      const ax = apple.x * cell + cell / 2, ay = apple.y * cell + cell / 2, ap = curApple();
      combo = tick - lastEat <= 14 ? Math.min(combo + 1, 5) : 1; // eat again quickly to build a combo
      lastEat = tick;
      if (combo > save.stats.bestCombo) save.stats.bestCombo = combo;
      const pts = 10 * combo;
      score += pts; save.stats.apples++;
      const got = earn();
      showCombo();
      floatText(ax, ay, "+" + pts + (combo > 1 ? " x" + combo : "") + (got ? " +1¢" : ""), got || combo > 1 ? "#ffd24a" : "#9dffbf");
      const oldMs = ms;
      ms = Math.max(50, LEVELS[level].ms - ((apples / 5) | 0) * 5);
      placeApple();
      showScore();
      burstParts(gScene, ax, ay, ap.burst, lite ? 5 : 9);
      if (!lite) { gScene.rings.push({ x: ax, y: ay, age: 0, col: ap.burst[0] }); pulseBoard(); }
      glog("> apple.eat() // score=" + score + (combo > 1 ? " combo x" + combo : "") + (got ? " +1¢" : ""));
      if (ms !== oldMs) glog("> tick.speed(" + ms + "ms)");
      if (!apple) return end(true);
      if (apples % 4 === 0 && !bonus) spawnBonus();
    } else {
      snake.pop();
    }
    if (!lite) {
      const sk = curSkin();
      if (Math.random() < 0.65) { const tl = old[old.length - 1]; emitTrail(gScene, sk, tl.x * cell + cell / 2, tl.y * cell + cell / 2); }
      if (sk.hot) emitTrail(gScene, sk, x * cell + cell / 2, y * cell + cell / 2);
    }
  }

  function end(won, why) {
    state = "over";
    dead = !won;
    const extra = Math.floor(apples / 4) + (won ? 10 : 0); // run bonus
    if (extra) gain(extra);
    if (score > best) { best = score; store.set(best); }
    combo = 0; showCombo(); showScore(); persist();
    $("overTitle").textContent = won ? "YOU HACKED IT. YOU WIN!" : "SYSTEM CRASHED";
    $("finalScore").textContent = score;
    $("overMsg").textContent = (won ? "All cells filled. Nice hack." : "Error: " + why) + "\n+" + runCoins + " ¢ earned this run" + (extra ? " (" + extra + " run bonus)" : "");
    glog(won ? "> game.win()" : '> throw new CrashError("' + why + '")');
    const sk = curSkin(), hd = snake[0], now = performance.now();
    if (won) burstParts(gScene, hd.x * cell + cell / 2, hd.y * cell + cell / 2, [sk.a || sk.head, sk.head, "#ffffff"], lite ? 8 : 16);
    else { // the snake shatters into code
      const set = sk.gl || HEX;
      for (let i = 0; i < snake.length && i < 48; i++) {
        const s = snake[i];
        addPart(gScene, s.x * cell + cell / 2, s.y * cell + cell / 2, rr(-120, 120), rr(-120, 120), rr(0.5, 1), skinColor(sk, i, snake.length, now), 1, set[(Math.random() * set.length) | 0]);
      }
    }
    gScene.lt = now;
    draw();
    const wrap = board.parentElement;
    wrap.classList.remove("shake"); void wrap.offsetWidth; wrap.classList.add("shake");
    if (navigator.vibrate && device === "mobile") navigator.vibrate(120);
    const tok = ++overTok;
    setTimeout(() => { if (state === "over" && tok === overTok) $("over").classList.remove("hidden"); }, won ? 0 : 650);
  }

  const segBuf = [];
  function draw() {
    const w = board.width, now = performance.now();
    const dt = state === "play" || state === "over" ? Math.min((now - gScene.lt) / 1000, 0.05) : 0;
    gScene.lt = now;
    stepParts(gScene, dt);
    stepRings(dt);

    const th = curBoard();
    bx.drawImage(bgFor(th, w, w, cell), 0, 0);
    if (!lite && th.scan) { bx.fillStyle = th.scan; bx.fillRect(0, ((now / 18) % (w + 60)) - 30, w, 28); }

    if (bonus) drawBonus(bx, bonus, cell, now);
    if (apple) drawApple(bx, apple, cell, now, save.apple);
    drawRings(bx, cell);
    drawParts(bx, gScene, cell);

    // smooth movement: slide every segment from its old cell to its new one
    const a = state === "play" ? Math.min(acc / ms, 1) : 1, n = snake.length;
    while (segBuf.length < n) segBuf.push({ x: 0, y: 0 });
    for (let i = 0; i < n; i++) {
      const s = snake[i], f = old[i] || old[old.length - 1] || s;
      let x = s.x, y = s.y;
      if (Math.abs(s.x - f.x) <= 1 && Math.abs(s.y - f.y) <= 1) { // skip wrap jumps
        x = f.x + (s.x - f.x) * a;
        y = f.y + (s.y - f.y) * a;
      }
      segBuf[i].x = x; segBuf[i].y = y;
    }
    if (!dead) paintSnake(bx, segBuf, n, cell, curSkin(), curBadge(), dir, now, score);
  }

  /* ================= input ================= */
  const kbuf = [], KONAMI = "arrowup,arrowup,arrowdown,arrowdown,arrowleft,arrowright,arrowleft,arrowright,b,a";
  const KEYS = {
    ArrowUp: [0, -1], w: [0, -1],
    ArrowDown: [0, 1], s: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0],
  };

  addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return; // typing in the terminal
    if (state === "menu") { // old school: up up down down left right left right b a
      kbuf.push(e.key.toLowerCase());
      if (kbuf.length > 10) kbuf.shift();
      if (kbuf.join(",") === KONAMI && !busy) { kbuf.length = 0; $("termWin").classList.remove("hidden"); redeem(SECRETS.find((x) => x.id === "konami")); }
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[k]) { e.preventDefault(); turn(KEYS[k][0], KEYS[k][1]); }
    else if (k === " " || k === "p") { e.preventDefault(); togglePause(); }
    else if (k === "Enter" && state === "over") start();
    else if (k === "Escape" && state !== "menu") toMenu();
  });

  let tx = 0, ty = 0;
  const gameEl = $("game");
  gameEl.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  gameEl.addEventListener("touchmove", (e) => {
    const t = e.touches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0); else turn(0, Math.sign(dy));
    tx = t.clientX; ty = t.clientY;
  }, { passive: true });

  document.querySelectorAll("[data-d]").forEach((b) =>
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const [x, y] = b.dataset.d.split(",").map(Number);
      turn(x, y);
    }));

  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") togglePause(); });
  addEventListener("resize", () => { sizeRain(); if (state !== "menu") fit(); });

  /* ================= random matrix rain (cheap: half-res canvas, ~12 fps) ================= */
  const RAIN = [
    { chars: "01", col: "#00b84a", head: "#d6ffe6" },
    { chars: "0123456789ABCDEF", col: "#00a844", head: "#caffdc" },
    { chars: "{}[]<>/;=+*#$%&!?", col: "#1fbf6a", head: "#eafff2" },
    { chars: "01<>/;", col: "#0a9a3c", head: "#b6ffcf" },
  ];
  let rainMode = pick(RAIN), rainSwitch = 25000, rainT = 0, rainBoost = 0;
  let fs = 9, cols = 0, ypos = [], spd = [];

  function sizeRain() {
    const sc = lite ? 0.4 : 0.5;
    rain.width = Math.ceil(innerWidth * sc);
    rain.height = Math.ceil(innerHeight * sc);
    fs = device === "mobile" ? 10 : 9;
    cols = Math.ceil(rain.width / fs);
    ypos = Array.from({ length: cols }, () => (Math.random() * -30) | 0);
    spd = Array.from({ length: cols }, () => (Math.random() < 0.3 ? 2 : 1));
    rx.fillStyle = "#020a04";
    rx.fillRect(0, 0, rain.width, rain.height);
    rx.font = fs + "px monospace";
  }

  function drawRain() {
    const m = rainMode, L = m.chars.length, boost = performance.now() < rainBoost;
    rx.fillStyle = boost ? "rgba(2,10,4,0.1)" : "rgba(2,10,4,0.16)";
    rx.fillRect(0, 0, rain.width, rain.height);
    for (let i = 0; i < cols; i++) {
      if (!boost && Math.random() < 0.12) continue; // gaps: looks less uniform and costs less
      const y = ypos[i] * fs, x = i * fs;
      rx.fillStyle = m.col; rx.fillText(m.chars[(Math.random() * L) | 0], x, y - fs);
      rx.fillStyle = m.head; rx.fillText(m.chars[(Math.random() * L) | 0], x, y);
      ypos[i] += boost ? spd[i] * 3 : spd[i];
      if (y > rain.height && Math.random() > 0.975) ypos[i] = 0;
    }
  }

  function setLite(v) {
    lite = v; slowN = 0;
    document.body.classList.toggle("lite", v);
    sizeRain();
  }

  /* ================= wallet & shop ================= */
  function showCoins(pop) {
    ["coins", "hudCoins", "shopCoins"].forEach((id) => { $(id).textContent = save.coins; });
    if (pop) {
      const h = $("hudCoins").parentElement;
      h.classList.remove("pop"); void h.offsetWidth; h.classList.add("pop");
    }
  }

  let shopTab = "skin", pvOv = null;
  const shopMsg = (t) => { $("shopMsg").textContent = t; };

  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function renderShop() {
    showCoins();
    document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === shopTab));
    const list = CATS[shopTab], cur = save[shopTab], sk0 = curSkin();
    $("shopList").innerHTML = list.map((it) => {
      const owned = save.owned.includes(it.id), locked = it.secret && !owned;
      const st = locked ? "locked" : cur === it.id ? "equipped" : owned ? "owned" : it.price + " ¢";
      let prev;
      if (locked) prev = "🔒";
      else if (shopTab === "skin") prev = [0, 1, 2, 3, 4, 5].map((i) => '<i style="background:' + skinColor(it, i, 6, 700) + (it.edge ? ";box-shadow:inset 0 0 0 1px " + it.edge : "") + (it.gc ? ";color:" + it.gc : "") + '">' + (it.gl && i ? esc(it.gl[(i * 3) % it.gl.length]) : "") + "</i>").join("");
      else prev = it.id === "none" ? "∅" : '<canvas class="bp" width="48" height="36" data-id="' + it.id + '"></canvas>';
      return '<button class="opt item' + (cur === it.id ? " active" : "") + (locked ? " lock" : "") + '" data-id="' + it.id + '">' +
        (locked ? "???" : esc(it.name)) + '<span class="prev">' + prev + "</span><small>" + st + "</small></button>";
    }).join("");
    $("shopList").querySelectorAll("button").forEach(fxButton);
    $("shopList").querySelectorAll("canvas.bp").forEach((c) => {
      const g = c.getContext("2d"), u = 20, d = { x: 1, y: 0 }, id = c.dataset.id;
      if (shopTab === "badge") {
        g.fillStyle = sk0.head; g.fillRect(14, 14, u, u);
        drawEyes(g, 24, 24, u, d, sk0);
        drawBadge(g, id, 24, 24, u, d, 0);
      } else if (shopTab === "apple") drawApple(g, { x: 0.357, y: 0.143 }, 28, 0, id);
      else { paintBoard(g, 48, 36, 12, BOARDS.find((k) => k.id === id)); g.strokeStyle = BOARDS.find((k) => k.id === id).border; g.strokeRect(0.5, 0.5, 47, 35); }
    });
    startPreview();
  }

  function openShop() {
    $("body").classList.add("hidden");
    $("shopBody").classList.remove("hidden");
    $("winTitle").textContent = "root@snake:~/shop#";
    renderShop();
  }
  function closeShop() {
    $("shopBody").classList.add("hidden");
    $("body").classList.remove("hidden");
    $("winTitle").textContent = "root@snake:~#";
    pvOv = null;
  }

  $("shopBtn").addEventListener("click", openShop);
  $("shopBack").addEventListener("click", closeShop);
  document.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => { shopTab = b.dataset.tab; pvOv = null; renderShop(); }));

  // hover/tap an item to try it on in the live preview
  $("shopList").addEventListener("pointerover", (e) => {
    const b = e.target.closest("button.item");
    pvOv = b && !b.classList.contains("lock") ? { kind: shopTab, id: b.dataset.id } : null;
  });
  $("shopList").addEventListener("pointerleave", () => { pvOv = null; });

  $("shopList").addEventListener("click", (e) => {
    const b = e.target.closest("button.item");
    if (!b) return;
    const it = CATS[shopTab].find((k) => k.id === b.dataset.id);
    if (!it) return;
    if (!save.owned.includes(it.id)) {
      if (it.secret) return shopMsg("> locked: find the secret code");
      if (save.coins < it.price) return shopMsg("> not enough coins: need " + it.price + " ¢");
      save.coins -= it.price;
      save.owned.push(it.id);
      shopMsg("> bought " + it.name + " (-" + it.price + " ¢)");
    } else shopMsg("> equipped " + it.name);
    save[shopTab] = it.id;
    persist();
    renderShop();
  });

  // live preview: a little snake wearing whatever you hover
  const pv = $("shopPrev"), pg = pv.getContext("2d"), pScene = { parts: [], lt: 0 };
  const pBuf = Array.from({ length: 14 }, () => ({ x: 0, y: 0 }));
  let pvRAF = 0, pvLast = 0, pvEmit = 0;
  function startPreview() { if (!pvRAF) pvRAF = requestAnimationFrame(pvFrame); }
  function pvFrame(t) {
    pvRAF = 0;
    if (document.hidden || $("menu").classList.contains("hidden") || $("menu").classList.contains("min") || $("shopBody").classList.contains("hidden")) return;
    pvRAF = requestAnimationFrame(pvFrame);
    if (t - pvLast < (lite ? 70 : 33)) return;
    const dt = Math.min((t - pvLast) / 1000, 0.08);
    pvLast = t;
    const u = 16;
    const ov = (k) => (pvOv && pvOv.kind === k ? pvOv.id : save[k]);
    const sk = SKINS.find((k) => k.id === ov("skin")) || SKINS[0];
    const bd = BADGES.find((k) => k.id === ov("badge")) || BADGES[0];
    pg.drawImage(bgFor(BOARDS.find((k) => k.id === ov("board")) || BOARDS[0], pv.width, pv.height, u), 0, 0);
    for (let i = 0; i < 14; i++) { pBuf[i].x = 14.2 - i * 0.95; pBuf[i].y = 1.5 + Math.sin(t / 300 - i * 0.6) * 0.55; }
    stepParts(pScene, dt);
    if (!lite && t - pvEmit > 110) { pvEmit = t; emitTrail(pScene, sk, pBuf[13].x * u + u / 2, pBuf[13].y * u + u / 2); }
    drawParts(pg, pScene, u);
    drawApple(pg, { x: 16.1, y: 1.5 }, u, t, ov("apple"));
    paintSnake(pg, pBuf, 14, u, sk, bd, { x: 1, y: 0 }, t, 120);
  }

  /* ================= hacker effects (all randomized) ================= */
  const GLYPH_SETS = ["01#$%&@!<>/=+*?", "0123456789ABCDEF", "01", "{}[]()<>;:/|", "▓▒░█▄▀■□"];

  // text turns into code word by word, then decodes word by word
  function scramble(el, opt) {
    clearInterval(el._sc);
    const slow = (opt && opt.slow) || 1, coded = !!(opt && opt.coded), cap = (opt && opt.cap) || 24;
    const set = pick(GLYPH_SETS), rg = () => set[(Math.random() * set.length) | 0];
    const plan = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let nd; (nd = walker.nextNode()); ) {
      if (!nd._o) nd._o = nd.nodeValue;
      if (!/[A-Za-z0-9]/.test(nd._o)) continue;
      const chars = Array.from(nd._o), enc = [], dec = [];
      let wi = 0, ci = 0, inw = false;
      chars.forEach((c) => {
        if (/\s/.test(c)) { if (inw) { wi++; ci = 0; inw = false; } enc.push(0); dec.push(0); }
        else { inw = true; enc.push(wi * 2); dec.push(wi * 2.6 * slow + ci * 0.8 * slow); ci++; }
      });
      const W = wi + (inw ? 1 : 0), base = coded ? 1 : (W - 1) * 2 + 4;
      plan.push({ nd, chars, enc, dec, base, end: base + Math.max.apply(null, dec) });
    }
    if (!plan.length) return;
    const total = Math.max.apply(null, plan.map((p) => p.end)) + 1, s = Math.min(1, cap / total);
    let f = 0;
    el._sc = setInterval(() => {
      const v = ++f / s;
      for (const p of plan) {
        p.nd.nodeValue = p.chars.map((c, i) => (/[A-Za-z0-9]/.test(c) && (coded || v >= p.enc[i]) && v < p.base + p.dec[i] ? rg() : c)).join("");
      }
      if (v > total) { clearInterval(el._sc); plan.forEach((p) => { p.nd.nodeValue = p.nd._o; }); }
    }, 34);
  }

  // flying code characters. mode: undefined (random) | "ring" | "fountain"
  function burst(x, y, cnt, mode) {
    const box = $("fx");
    if (box.childNodes.length > 90) return;
    const n = cnt || (device === "mobile" || lite ? 6 : 10);
    const set = pick(GLYPH_SETS), col = pick(["#00ff66", "#9dffbf", "#ffffff", "#00c24e"]);
    const fountain = mode === "fountain" || (!mode && Math.random() < 0.35);
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span"), ang = mode === "ring" ? (i / n) * 6.283 : Math.random() * 6.283, d = mode === "ring" ? 85 : rr(30, 80);
      s.textContent = set[(Math.random() * set.length) | 0];
      s.style.cssText = "left:" + x + "px;top:" + y + "px;color:" + col + ";--dx:" + ((fountain ? rr(-60, 60) : Math.cos(ang) * d) | 0) + "px;--dy:" + ((fountain ? -rr(50, 130) : Math.sin(ang) * d) | 0) + "px";
      s.addEventListener("animationend", () => s.remove());
      box.appendChild(s);
    }
  }

  /* ---- click on the BACKGROUND (not the window): random code effect ---- */
  let bgT = 0;
  const fxAdd = (el, life) => { const box = $("fx"); if (box.childNodes.length > 90) return; box.appendChild(el); setTimeout(() => el.remove(), life); };
  function ripple(x, y) {
    for (let k = 0; k < 2; k++) {
      const d = document.createElement("div");
      d.className = "ripple" + (k ? " r2" : "");
      d.style.left = x + "px"; d.style.top = y + "px";
      fxAdd(d, 950);
    }
  }
  function glitchLines(y) {
    for (let k = 0; k < (lite ? 2 : 4); k++) {
      const d = document.createElement("div");
      d.className = "gl";
      d.style.top = y + rr(-50, 50) + "px"; d.style.height = rr(2, 7) + "px";
      fxAdd(d, 500);
    }
  }
  function coordTag(x, y) {
    const d = document.createElement("div");
    d.className = "ctag";
    d.textContent = "> click(" + (x | 0) + "," + (y | 0) + ")";
    d.style.left = x + "px"; d.style.top = y + "px";
    fxAdd(d, 1000);
  }
  function rainSplash(x, y) { // the code rain restarts from your click and falls faster for a moment
    const sc = rain.width / innerWidth, c = Math.floor((x * sc) / fs), row = Math.floor((y * sc) / fs), lo = Math.max(0, c - 5), hi = Math.min(cols - 1, c + 5);
    for (let i = lo; i <= hi; i++) { ypos[i] = row; spd[i] = 3; }
    rx.fillStyle = "rgba(0,255,102,.35)"; rx.beginPath(); rx.arc(x * sc, y * sc, 14, 0, 6.283); rx.fill();
    setTimeout(() => { for (let i = lo; i <= hi && i < spd.length; i++) spd[i] = Math.random() < 0.3 ? 2 : 1; }, 2200);
  }
  const BG_FX = [
    (x, y) => { ripple(x, y); burst(x, y, 8); },
    (x, y) => { ripple(x, y); burst(x, y, 18, "ring"); },
    (x, y) => { rainSplash(x, y); burst(x, y, 6); },
    (x, y) => { glitchLines(y); burst(x, y, 6); },
    (x, y) => { burst(x, y, 22, "fountain"); },
  ];
  document.addEventListener("pointerdown", (e) => {
    const tg = e.target;
    if (tg !== $("app") && tg !== document.body && tg !== document.documentElement && tg !== rain) return; // only empty background
    if (state === "play" && device === "mobile") return;
    const now = performance.now();
    if (now - bgT < 140) return;
    bgT = now;
    pick(lite ? [BG_FX[0], BG_FX[4]] : BG_FX)(e.clientX, e.clientY);
    if (Math.random() < 0.6) coordTag(e.clientX, e.clientY);
  });

  const fxButton = (b) => {
    b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") scramble(b); });
    b.addEventListener("pointerdown", (e) => {
      scramble(b);
      burst(e.clientX, e.clientY);
      b.classList.remove("hit"); void b.offsetWidth; b.classList.add("hit");
    });
    b.addEventListener("animationend", (e) => { if (e.animationName === "hit") b.classList.remove("hit"); });
  };
  document.querySelectorAll("button.opt, button.btn").forEach(fxButton);

  const title = document.querySelector("h1");
  title.addEventListener("pointerenter", () => scramble(title, { coded: false }));

  // start: random fake "hacking" boot sequence
  const BOOT_A = ["> connecting to mainframe...", "> tracing route 10.0.0.%N ...", "> handshake with 127.0.0.1 ... OK"];
  const BOOT_B = ["> bypassing firewall ........ OK", "> cracking rsa-2048 ......... OK", "> spoofing mac address ...... OK", "> disabling antivirus ....... OK"];
  const BOOT_C = ["> injecting snake.exe ....... OK", "> loading apples.dll ........ OK", "> mounting /dev/snake ....... OK"];
  let booting = false;
  function bootThen(cb) {
    if (booting) return;
    booting = true;
    const box = $("boot"), pre = $("bootText");
    const lines = [pick(BOOT_A).replace("%N", (Math.random() * 250) | 0), pick(BOOT_B), pick(BOOT_C), "> owner verified: Maithem ... OK", "> ACCESS GRANTED"];
    pre.textContent = "";
    box.classList.remove("hidden");
    lines.forEach((line, i) => setTimeout(() => { pre.textContent += line + "\n"; }, i * 220));
    setTimeout(() => { box.classList.add("hidden"); booting = false; cb(); }, lines.length * 220 + 250);
  }

  /* ================= corner terminal ================= */
  const tOut = $("termOut"), tIn = $("termIn");
  const hist = []; let hIdx = 0, busy = false;

  function tPrint(txt, cls) {
    const d = document.createElement("div");
    d.textContent = txt;
    if (cls) d.className = cls;
    tOut.appendChild(d);
    while (tOut.childNodes.length > 80) tOut.removeChild(tOut.firstChild);
    tOut.scrollTop = tOut.scrollHeight;
  }

  $("termBtn").addEventListener("click", () => {
    const w = $("termWin");
    w.classList.toggle("hidden");
    if (!w.classList.contains("hidden")) {
      if (!tOut.childNodes.length) { tPrint("> mainframe terminal v1.0", "hk"); tPrint("> type  cmd  to list commands", "hk"); }
      tIn.focus();
    }
  });
  $("termX").addEventListener("click", () => $("termWin").classList.add("hidden"));

  tIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (busy) return;
      const v = tIn.value; tIn.value = "";
      if (v.trim()) { hist.push(v); hIdx = hist.length; }
      runCmd(v);
    } else if (e.key === "ArrowUp") { e.preventDefault(); if (hIdx > 0) tIn.value = hist[--hIdx]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); tIn.value = hIdx < hist.length - 1 ? hist[++hIdx] : ((hIdx = hist.length), ""); }
    else if (e.key === "Escape") $("termWin").classList.add("hidden");
  });

  // ---- secrets: 10 hidden codes. c = accepted inputs (stored encoded), rw = reward text for `view secrets`
  const ART_RABBIT = ["  (\\_/)", "  (o.o)", "  (> <)   follow me..."];
  const ART_CUP = ["    ( (", "     ) )", "  .______.", "  |      |]", "  \\      /", "   `----'"];
  const SECRETS = [
    { id: "owner", c: ["bWFpdGhlbQ=="], name: "The Owner", hint: "say the name of whoever built this place.", fx: "hack", coins: -1, master: true, rw: "-1 ¢ + the master key",
      lines: ["> ACCESS GRANTED: owner override", "> wallet: -1 ¢  (the owner takes a coin, lol)", "> master key acquired. try: view secrets"] },
    { id: "skin", c: ["aW5maW5pdHk="], name: "Infinity", hint: "what has no end? type it.", fx: "hack", unlock: "void", equip: true, rw: "secret skin",
      lines: ["> ACCESS GRANTED: secret skin unlocked", "> ∞ VOID is now equipped"] },
    { id: "money", c: ["a2F0dHk="], name: "Katty's Vault", hint: "five letters. she guards the vault and loves coins.", fx: "hack", coins: 99999, rw: "+99999 ¢",
      lines: ["> ACCESS GRANTED: +99999 ¢", "> the shop is yours. go wild."] },
    { id: "wipe", c: ["c3VkbyBybSAtcmYgLw=="], name: "Point of No Return", hint: "the most dangerous command in linux. (it is safe here, promise)", fx: "wipe", unlock: "root", rw: "Root skin",
      lines: ["> lol. just kidding. nothing was deleted.", "> but you did get root access: Root skin unlocked"] },
    { id: "answer", c: ["NDI="], name: "The Answer", hint: "the answer to life, the universe and everything.", fx: "quick", coins: 42, rw: "+42 ¢",
      lines: ["> the answer to life, the universe and everything.", "> +42 ¢"] },
    { id: "konami", c: ["dXVkZGxybHJiYQ==", "dXAgdXAgZG93biBkb3duIGxlZnQgcmlnaHQgbGVmdCByaWdodCBiIGE="], name: "Old School", hint: "up up down down left right left right b a. type it, or press the keys on this menu.", fx: "quick", coins: 300, rw: "+300 ¢",
      lines: ["> KONAMI CODE ACCEPTED", "> +30 lives (just kidding)  +300 ¢"] },
    { id: "hello", c: ["aGVsbG8gd29ybGQ="], name: "First Words", hint: "every programmer's first program. two words.", fx: "quick", coins: 10, rw: "+10 ¢",
      lines: ["> Hello, World!", "> +10 ¢"] },
    { id: "neo", c: ["d2FrZSB1cCBuZW8=", "d2FrZSB1cCwgbmVv"], name: "The Red Pill", hint: "wake up, ___. (take the red pill)", fx: "rabbit", unlock: "matrix", art: ART_RABBIT, rw: "Matrix skin",
      lines: ["> the Matrix skin is yours.", "> there is no spoon."] },
    { id: "coffee", c: ["Y29mZmVl", "c3VkbyBtYWtlIGNvZmZlZQ=="], name: "Fuel", hint: "every developer's favourite fuel.", fx: "quick", coins: 25, art: ART_CUP, rw: "+25 ¢",
      lines: ["> brewing... done.", "> +25 ¢ and unlimited energy"] },
    { id: "gsod", c: ["YnNvZA==", "Z3NvZA=="], name: "Green Screen", hint: "the screen every PC fears. four letters.", fx: "gsod", coins: 20, rw: "+20 ¢",
      lines: ["> you survived the green screen of death.", "> +20 ¢ for your bravery"] },
  ];

  const HK_A = ["> code accepted. starting exploit...", "> handshake with mainframe ... OK", "> secret key recognized ...", "> authenticating as root ..."];
  const HK_B = ["> bruteforcing hash [#####-----]", "> cracking rsa-2048 ......... OK", "> dumping memory %H ...", "> decrypting vault.dat ......"];
  const HK_C = ["> bypassing firewall ....... OK", "> disabling antivirus ...... OK", "> spoofing mac address ..... OK", "> rerouting proxy chain .... OK"];
  const HK_D = ["> injecting payload ........ OK", "> patching wallet.dll ...... OK", "> writing to /dev/coins .... OK"];
  const rndPos = () => burst(Math.random() * innerWidth, Math.random() * innerHeight, lite ? 8 : 14);

  // the visual "show" for each kind of secret
  const SEQ = {
    hack(sec, done) { // one of 3 random green/black hack screens
      const vv = pick(["hk-a", "hk-b", "hk-c"]);
      document.body.classList.add(vv);
      const steps = [pick(HK_A), pick(HK_B), pick(HK_C), pick(HK_D)].map((t) => t.replace("%H", "0x" + rhex(6)));
      steps.forEach((t, i) => setTimeout(() => { tPrint(t, "hk"); rndPos(); }, i * 350));
      setTimeout(() => { document.body.classList.remove(vv); done(); }, steps.length * 350 + 200);
    },
    wipe(sec, done) { // fake system wipe + meltdown
      const L = ["> sudo: password accepted", "> removing /usr/bin ...", "> removing /var/log ...", "> removing /home/player ...", "> removing /dev/apples ...", "> KERNEL PANIC: not syncing"];
      document.body.classList.add("melt");
      L.forEach((t, i) => setTimeout(() => { tPrint(t, i === 5 ? "err" : "hk"); rndPos(); }, i * 260));
      setTimeout(() => { document.body.classList.remove("melt"); done(); }, L.length * 260 + 300);
    },
    gsod(sec, done) { // green screen of death
      const box = $("boot"), pre = $("bootText");
      let p = 0;
      box.classList.add("gs"); box.classList.remove("hidden");
      const iv = setInterval(() => {
        p = Math.min(100, p + 7 + ((Math.random() * 9) | 0));
        pre.textContent = ":(\n\nYour PC ran into a problem.\n(just kidding. it's a snake game.)\n\n" + p + "% complete";
        if (p >= 100) { clearInterval(iv); setTimeout(() => { box.classList.add("hidden"); box.classList.remove("gs"); done(); }, 500); }
      }, 120);
    },
    rabbit(sec, done) { // the code rain goes turbo
      const L = ["> wake up, neo...", "> the matrix has you...", "> follow the white rabbit."];
      rainBoost = performance.now() + 7000;
      L.forEach((t, i) => setTimeout(() => tPrint(t, "hk"), i * 700));
      setTimeout(done, L.length * 700 + 200);
    },
    quick(sec, done) { tPrint("> decoding...", "hk"); burst(innerWidth / 2, innerHeight / 2, lite ? 8 : 16, "ring"); setTimeout(done, 500); },
  };

  function redeem(sec) {
    if (save.codes.includes(sec.id)) { tPrint("> code already redeemed.", "warn"); return; }
    busy = true;
    SEQ[sec.fx](sec, () => {
      save.codes.push(sec.id);
      if (sec.coins) save.coins += sec.coins;
      if (sec.unlock && !save.owned.includes(sec.unlock)) save.owned.push(sec.unlock);
      if (sec.equip) save.skin = sec.unlock;
      if (sec.master) save.master = true;
      (sec.art || []).forEach((l) => tPrint(l, "hk"));
      sec.lines.forEach((l) => tPrint(l, "ok"));
      persist(); showCoins(true);
      if (!$("shopBody").classList.contains("hidden")) renderShop();
      setLog("> secret found: " + sec.name + " (" + save.codes.length + "/" + SECRETS.length + ")");
      busy = false;
      tIn.focus();
    });
  }

  function showSecrets() {
    tPrint("== secrets: " + save.codes.length + "/" + SECRETS.length + " found ==", "hk");
    SECRETS.forEach((s) => {
      const found = save.codes.includes(s.id), code = atob(s.c[0]);
      if (found) tPrint("[x] " + code + "  -  " + s.name + "  (" + s.rw + ")", "ok");
      else if (save.master) tPrint("[ ] " + code + "  -  " + s.name + "  (" + s.rw + ")", "warn");
      else tPrint("[ ] ???  hint: " + s.hint, "warn");
    });
    tPrint(save.master ? "(master key: every code revealed)" : "tip: one of the codes is a master key.", "hk");
  }

  function runCmd(raw) {
    const line = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!line) return;
    tPrint("$ " + raw.trim(), "me");
    const sec = SECRETS.find((x) => x.c.some((c) => atob(c) === line));
    if (sec) return redeem(sec);
    const [c, arg] = line.split(" ");
    switch (c) {
      case "cmd": case "help":
        ["cmd           show all commands", "balance       show your coins", "shop          open the shop",
          "inv           list what you own", "equip <id>    wear a skin, badge, apple or board", "view secrets  hints for the hidden codes",
          "stats         your career numbers", "fx <lite|full> effects quality", "about         who built this", "clear         clear the terminal", "",
          "secret codes found: " + save.codes.length + "/" + SECRETS.length + "  (keep hunting)"].forEach((l) => tPrint(l));
        break;
      case "balance": case "money": tPrint("> wallet: " + save.coins + " ¢", "ok"); break;
      case "shop": if (state === "menu") { openShop(); tPrint("> opening shop...", "hk"); } break;
      case "view": if (arg === "secrets") showSecrets(); else tPrint("> usage: view secrets", "warn"); break;
      case "secrets": showSecrets(); break;
      case "stats": {
        const st = save.stats;
        ["games played  " + st.games, "apples eaten  " + st.apples, "coins earned  " + st.coins + " ¢", "best combo    x" + st.bestCombo,
          "best score    " + best, "secrets       " + save.codes.length + "/" + SECRETS.length].forEach((l) => tPrint(l));
        break;
      }
      case "inv":
        tPrint("skins:  " + SKINS.filter((k) => save.owned.includes(k.id)).map((k) => k.id).join(", "));
        tPrint("badges: " + BADGES.filter((k) => save.owned.includes(k.id)).map((k) => k.id).join(", "));
        tPrint("apples: " + APPLES.filter((k) => save.owned.includes(k.id)).map((k) => k.id).join(", "));
        tPrint("boards: " + BOARDS.filter((k) => save.owned.includes(k.id)).map((k) => k.id).join(", "));
        break;
      case "equip": {
        const kind = ["skin", "badge", "apple", "board"].find((k) => CATS[k].some((x) => x.id === arg));
        if (!arg || !kind) tPrint("> usage: equip <id>   (see inv)", "warn");
        else if (!save.owned.includes(arg)) tPrint("> you don't own that yet", "err");
        else { save[kind] = arg; persist(); tPrint("> equipped " + kind + ": " + arg, "ok"); }
        break;
      }
      case "fx":
        if (arg === "lite") { autoLite = false; setLite(true); tPrint("> low-power mode ON", "ok"); }
        else if (arg === "full") { autoLite = false; setLite(false); tPrint("> full effects ON", "ok"); }
        else tPrint("> usage: fx lite | fx full   (now: " + (lite ? "lite" : "full") + ")", "warn");
        break;
      case "about": tPrint("SNAKE.EXE v1.0 :: built by Maithem (project owner)", "ok"); break;
      case "clear": tOut.textContent = ""; break;
      default: tPrint("command not found: " + c + "   (type cmd)", "err");
    }
  }

  /* ================= draggable hacker window ================= */
  const win = $("menu"), bar = win.querySelector(".bar");
  let wx = 0, wy = 0, drag = null, trailT = 0;
  const place = () => { win.style.translate = wx + "px " + wy + "px"; };

  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".dot")) return;
    const r = win.getBoundingClientRect();
    drag = { sx: e.clientX, sy: e.clientY, ox: wx, oy: wy, bl: r.left - wx, bt: r.top - wy, w: r.width, h: r.height };
    bar.setPointerCapture(e.pointerId);
    win.classList.add("dragging");
  });
  bar.addEventListener("pointermove", (e) => {
    if (!drag) return;
    wx = Math.min(Math.max(drag.ox + e.clientX - drag.sx, 4 - drag.bl), innerWidth - drag.w - 4 - drag.bl);
    wy = Math.min(Math.max(drag.oy + e.clientY - drag.sy, 4 - drag.bt), innerHeight - drag.h - 4 - drag.bt);
    place();
    const now = performance.now();
    if (now - trailT > 70) { trailT = now; burst(e.clientX, e.clientY, 1); }
  });
  const drop = () => { drag = null; win.classList.remove("dragging"); };
  bar.addEventListener("pointerup", drop);
  bar.addEventListener("pointercancel", drop);
  addEventListener("resize", () => { wx = wy = 0; place(); });

  win.querySelectorAll(".dot").forEach((d) => d.addEventListener("click", () => {
    if (d.dataset.act === "min") { win.classList.toggle("min"); if (!win.classList.contains("min")) startPreview(); }
    else if (d.dataset.act === "home") {
      wx = wy = 0; win.classList.add("snap"); place();
      setTimeout(() => win.classList.remove("snap"), 300);
      setLog("> window.center() // OK");
    } else {
      win.classList.remove("hit"); void win.offsetWidth; win.classList.add("hit");
      setLog("> ACCESS DENIED: can't close the mainframe");
    }
  }));
  win.addEventListener("animationend", (e) => { if (e.animationName === "hit" && e.target === win) win.classList.remove("hit"); });

  // scrolling code behind the menu: different mix every time the menu opens
  const CODE_POOL = [
    "const N = 20;", "let snake = [{x:10, y:10}];", "function step() {", "  const head = move(snake[0], dir);",
    "  if (!walls) head.x = (head.x + N) % N;", "  if (hit(head, apple)) grow();", "  else snake.pop();", "  draw();", "}",
    "walls.disable(); // teleport", "while (alive) { eat(apple); }", "if (score > best) save(score);",
    "ssh root@mainframe -p 1337", "sudo rm -rf walls/", "const wallet = load('coins');", "skin.equip('void');",
    "for (const p of parts) p.life -= dt;", "export default class Snake {}", "await fetch('/api/apples');",
    "01001000 01000001 01000011 01001011", "git commit -m 'more apples'", "npm run hack --silent",
  ];
  const ASM = ["mov eax, ", "xor ebx, ", "jmp 0x", "push 0x", "call 0x", "cmp ecx, "];
  function fillCode() {
    const lines = [];
    for (let i = 0; i < 24; i++) lines.push(Math.random() < 0.3 ? "0x" + rhex(4) + "  " + pick(ASM) + rhex(4) : pick(CODE_POOL));
    const txt = lines.join("\n"), el = $("code");
    el.textContent = txt + "\n" + txt;
    el.style.animationDuration = ((rr(18, 32)) | 0) + "s";
    el.style.animationDelay = "-" + ((rr(0, 18)) | 0) + "s";
  }

  // random typed tagline under the title
  const TAGS = ["> eat the apples. grow. don't crash", "> while (alive) eat(apple);", "> sudo make me a snake", "> segfault is not an option",
    "> it's not a bug, it's a feature", "> 99 little bugs in the code...", "> git push --force the apples", "> ctrl+c to cry, ctrl+v to retry"];
  let tagT;
  function setTag(txt) {
    clearInterval(tagT);
    const el = $("tagText");
    let i = 0;
    tagT = setInterval(() => { el.textContent = txt.slice(0, ++i); if (i >= txt.length) clearInterval(tagT); }, 24);
  }

  // one-line typing console
  const LOGS = ["> mounting /dev/apple ... OK", "> scanning ports 22 80 443 ...", "> while (alive) eat(apple);", "> sudo rm -rf walls/ ...",
    "> decrypting high_score.dat", "> ssh root@mainframe -p 1337", "> compiling snake.ts -> snake.js", "> apple.color = 0xFF3B5C",
    "> pinging 8.8.8.8 ... %Nms", "> entropy pool: %N bits", "> loading skins.db ... OK", "> checksum 0x%H verified", "> uptime: %N days"];
  let logT;
  function setLog(txt) {
    clearInterval(logT);
    let i = 0;
    logT = setInterval(() => {
      logEl.textContent = txt.slice(0, ++i) + "_";
      if (i >= txt.length) clearInterval(logT);
    }, 22);
  }
  setInterval(() => {
    if (state === "menu" && !document.hidden) setLog(pick(LOGS).replace("%N", ((Math.random() * 90) | 0) + 10).replace("%H", rhex(6)));
  }, 3200);

  /* ================= main loop ================= */
  function frame(t) {
    requestAnimationFrame(frame);
    const raw = t - last, dt = Math.min(raw, 100);
    last = t;

    // weak device? quietly switch to low-power effects
    if (autoLite && !lite && !document.hidden && raw > 34 && raw < 400) {
      if (++slowN > 50) { setLite(true); setLog("> low-power mode: effects reduced"); }
    } else if (slowN > 0 && raw <= 34) slowN -= 0.25;

    if (state === "play") {
      acc += dt;
      while (acc >= ms && state === "play") { acc -= ms; step(); }
      if (state === "play") draw();
    } else if (state === "over" && gScene.parts.length) draw();

    // rain: ~12 fps, random look every ~30s, off when hidden / reduced motion / busy playing on weak devices
    const rainOn = !reduced && !document.hidden && !(state === "play" && (lite || device === "mobile"));
    if (rainOn && t - rainT >= (lite ? 160 : t < rainBoost ? 45 : 80)) { rainT = t; drawRain(); }
    if (t > rainSwitch) { rainSwitch = t + rr(22000, 40000); rainMode = pick(RAIN.filter((m) => m !== rainMode)); }
  }

  /* ================= init ================= */
  const owner = $("owner");
  owner.parentElement.addEventListener("pointerenter", () => scramble(owner));
  document.body.classList.toggle("lite", lite);
  sizeRain();
  fillCode();
  setTag(pick(TAGS));
  refreshMenu();
  showCoins();
  scramble(title, { coded: true, slow: 2.2, cap: 44 });
  scramble(owner, { coded: true, slow: 2, cap: 40 });
  setLog(migrated ? "> old items converted: +" + migrated + " ¢ refunded" : "> system ready");
  requestAnimationFrame(frame);
})();