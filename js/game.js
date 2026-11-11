/* Llama Trauma — original endless hopper. Canvas 2D, no external assets. */
import * as audio from "./audio.js";

export const BODY_COLORS = [
  "#F3D7A0", "#FFFFFF", "#8B5A2B", "#C9965A",
  "#F4A5C2", "#C5A6E8", "#8EC6F0", "#8FDFC0",
  "#F6E27A", "#F5B48A", "#F08070", "#8FBF88",
  "#C5C0B8", "#E0B15A", "#D6A3D0", "#5FBFB5"
];

export const BLANKET_COLORS = [
  "#E85D4C", "#3D7EDB", "#F2A0C2", "#F4C430",
  "#7C3AED", "#2F9E6B", "#FF8A3D", "#2C2C2C",
  "#FFFFFF", "#5EC8D8", "#E04F8A", "#A8E06C"
];

export const HATS = [
  { id: "none", name: "None", cost: 0 },
  { id: "flower", name: "Flower", cost: 0 },
  { id: "bow", name: "Bow", cost: 0 },
  { id: "party", name: "Party", cost: 25 },
  { id: "cowboy", name: "Cowboy", cost: 50 },
  { id: "beanie", name: "Beanie", cost: 25 },
  { id: "propeller", name: "Propeller", cost: 75 },
  { id: "crown", name: "Crown", cost: 100 },
  { id: "shades", name: "Shades", cost: 40 }
];

export const STORAGE_KEY = "llamaTrauma.v1";
const COLS = 9;
const START_COL = 4;

const CAR_COLORS = ["#FF6B6B", "#4D96FF", "#FFD93D", "#6BCB77", "#FF9F45", "#C77DFF", "#4ECDC4", "#F7FFF7"];

function defaultSave() {
  return {
    highScore: 0,
    coins: 0,
    muted: false,
    seenHint: false,
    custom: { body: "#F3D7A0", blanket: "#E85D4C", hat: "none" },
    unlockedHats: ["none", "flower", "bow"]
  };
}

export function loadSave() {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    return {
      highScore: Math.max(0, s.highScore | 0),
      coins: Math.max(0, s.coins | 0),
      muted: !!s.muted,
      seenHint: !!s.seenHint,
      custom: {
        body: typeof s.custom?.body === "string" ? s.custom.body : d.custom.body,
        blanket: typeof s.custom?.blanket === "string" ? s.custom.blanket : d.custom.blanket,
        hat: typeof s.custom?.hat === "string" ? s.custom.hat : "none"
      },
      unlockedHats: Array.isArray(s.unlockedHats) ? [...new Set([...d.unlockedHats, ...s.unlockedHats])] : d.unlockedHats
    };
  } catch {
    return d;
  }
}

export function writeSave(save) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

export function shade(hex, amt) {
  let h = String(hex || "#888888").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) h = "888888";
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + amt));
  return `rgb(${r},${g},${b})`;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function easeOut(t) { return 1 - (1 - t) * (1 - t); }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

/* ---------------- drawing helpers ---------------- */
function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function strokeEllipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function roundedBox3D(ctx, x, y, w, d, thick, top, side, front) {
  // top face
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y - d);
  ctx.lineTo(x - w / 2, y - d);
  ctx.closePath();
  ctx.fill();
  // front face (toward camera)
  ctx.fillStyle = front;
  ctx.fillRect(x - w / 2, y, w, thick);
  // right side hint
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - d);
  ctx.lineTo(x + w / 2 + thick * 0.35, y - d + thick * 0.15);
  ctx.lineTo(x + w / 2 + thick * 0.35, y + thick * 0.85);
  ctx.lineTo(x + w / 2, y + thick);
  ctx.closePath();
  ctx.fill();
}

/* Cute original llama, drawn procedurally. facing: 0 fwd (away), 1 right, 2 toward camera, 3 left */
export function drawLlama(ctx, x, y, scale, facing, time, custom, opts = {}) {
  const body = custom.body || "#F3D7A0";
  const blanket = custom.blanket || "#E85D4C";
  const hat = custom.hat || "none";
  const hopY = opts.hopY || 0;
  const squash = opts.squash || 1;
  const blink = opts.blink || false;
  const wet = opts.wet || false;

  ctx.save();
  ctx.translate(x, y - hopY * scale);
  const flip = facing === 3 || (facing === 0 && false);
  const dirSign = facing === 3 ? -1 : facing === 1 ? 1 : (facing === 0 ? 1 : 1);
  if (facing === 3) ctx.scale(-1, 1);
  ctx.scale(scale, scale);
  ctx.scale(1 / Math.sqrt(squash), squash);

  const rear = facing === 0;
  const profile = facing === 1 || facing === 3;
  const dark = shade(body, -42);
  const light = shade(body, 28);
  const mid = body;

  const leg = (lx, ly, lift = 0) => {
    ctx.fillStyle = dark;
    roundRect(ctx, lx - 0.09, ly - 0.28 - lift, 0.18, 0.38 + lift, 0.08);
    ctx.fill();
    ctx.fillStyle = shade(body, -20);
    ellipse(ctx, lx, ly + 0.08, 0.1, 0.07);
  };

  const walk = opts.walk || 0;
  const l1 = Math.sin(walk) * 0.06;
  const l2 = Math.sin(walk + Math.PI) * 0.06;

  if (rear) {
    // far legs, body, head peeking over, blanket, near legs, tail
    ctx.fillStyle = dark;
    leg(-0.22, 0.18, Math.max(0, l1));
    leg(0.16, 0.2, Math.max(0, l2));
  } else {
    leg(-0.28, 0.2, Math.max(0, l1));
    leg(0.26, 0.2, Math.max(0, l2));
  }

  // body wool
  ctx.fillStyle = mid;
  ellipse(ctx, 0, -0.22, 0.48, 0.38);
  ctx.fillStyle = light;
  ellipse(ctx, -0.1, -0.34, 0.28, 0.22);
  ctx.fillStyle = mid;
  const tufts = [
    [-0.38, -0.22, 0.16], [0.36, -0.2, 0.16], [-0.22, -0.48, 0.18],
    [0.18, -0.5, 0.16], [0.02, -0.54, 0.16], [-0.34, -0.38, 0.14],
    [0.32, -0.4, 0.14], [0.0, -0.1, 0.22]
  ];
  for (const [tx, ty, tr] of tufts) {
    ctx.fillStyle = (tx + ty) % 0.2 < 0 ? light : mid;
    ellipse(ctx, tx, ty, tr, tr * 0.9);
  }

  // blanket / saddle
  ctx.fillStyle = blanket;
  ctx.beginPath();
  ctx.ellipse(0.02, -0.28, 0.32, 0.16, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(blanket, -30);
  ctx.fillRect(-0.02, -0.36, 0.08, 0.22);
  ctx.fillStyle = shade(blanket, 30);
  ctx.globalAlpha = 0.45;
  ellipse(ctx, -0.08, -0.32, 0.12, 0.06);
  ctx.globalAlpha = 1;

  // tail
  if (rear || profile) {
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.moveTo(-0.4, -0.15);
    ctx.quadraticCurveTo(-0.62, 0.05, -0.5, 0.18);
    ctx.quadraticCurveTo(-0.42, 0.08, -0.34, -0.05);
    ctx.fill();
    ellipse(ctx, -0.5, 0.18, 0.12, 0.1);
  }

  // neck + head
  const hx = rear ? 0.22 : (profile ? 0.42 : 0.08);
  const hy = rear ? -0.7 : (profile ? -0.72 : -0.78);
  ctx.fillStyle = mid;
  ctx.beginPath();
  if (rear) {
    ctx.moveTo(0.08, -0.45);
    ctx.quadraticCurveTo(0.18, -0.62, hx, hy + 0.12);
    ctx.quadraticCurveTo(0.12, -0.55, 0.0, -0.42);
  } else if (profile) {
    ctx.moveTo(0.15, -0.4);
    ctx.quadraticCurveTo(0.32, -0.58, hx - 0.05, hy + 0.14);
    ctx.quadraticCurveTo(0.2, -0.5, 0.05, -0.38);
  } else {
    ctx.moveTo(-0.08, -0.45);
    ctx.quadraticCurveTo(-0.04, -0.7, hx - 0.08, hy + 0.16);
    ctx.lineTo(hx + 0.1, hy + 0.16);
    ctx.quadraticCurveTo(0.16, -0.7, 0.12, -0.45);
  }
  ctx.fill();

  // head
  ctx.fillStyle = mid;
  ellipse(ctx, hx, hy, rear ? 0.22 : 0.24, 0.22);
  ctx.fillStyle = light;
  ellipse(ctx, hx + (rear ? 0.04 : 0.02), hy - 0.04, 0.14, 0.12);

  // ears
  const ear = (ex, ey, ang, drop = 0.18) => {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = mid;
    ellipse(ctx, 0, -drop, 0.08, drop);
    ctx.fillStyle = "#F4B6C2";
    ellipse(ctx, 0, -drop * 0.7, 0.04, drop * 0.55);
    ctx.restore();
  };
  if (rear) {
    ear(hx - 0.12, hy - 0.12, -0.5);
    ear(hx + 0.14, hy - 0.12, 0.5);
  } else if (profile) {
    ear(hx - 0.06, hy - 0.16, -0.35);
    ear(hx + 0.02, hy - 0.18, 0.15);
  } else {
    ear(hx - 0.16, hy - 0.12, -0.55);
    ear(hx + 0.16, hy - 0.12, 0.55);
  }

  // snout + face
  if (!rear) {
    const sx = profile ? hx + 0.16 : hx;
    const sy = hy + 0.08;
    ctx.fillStyle = shade(body, 10);
    ellipse(ctx, sx, sy, profile ? 0.14 : 0.13, 0.1);
    ctx.fillStyle = "#3A2A1A";
    ellipse(ctx, sx + (profile ? 0.06 : -0.04), sy - 0.01, 0.025, 0.02);
    ellipse(ctx, sx + (profile ? 0.08 : 0.04), sy - 0.01, 0.025, 0.02);
    // smile
    ctx.strokeStyle = "#3A2A1A";
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.arc(sx + (profile ? 0.04 : 0), sy + 0.03, 0.05, 0.15, Math.PI - 0.15);
    ctx.stroke();
    // eyes
    const eyeY = hy - 0.04;
    const eyes = profile ? [[hx + 0.06, eyeY]] : [[hx - 0.08, eyeY], [hx + 0.1, eyeY]];
    for (const [ex, ey] of eyes) {
      if (blink) {
        ctx.strokeStyle = "#3A2A1A";
        ctx.lineWidth = 0.035;
        ctx.beginPath();
        ctx.moveTo(ex - 0.05, ey);
        ctx.lineTo(ex + 0.05, ey);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#3A2A1A";
        ellipse(ctx, ex, ey, 0.045, 0.055);
        ctx.fillStyle = "#fff";
        ellipse(ctx, ex - 0.015, ey - 0.018, 0.016, 0.018);
      }
    }
  } else {
    // peek of ear-side eye
    ctx.fillStyle = "#3A2A1A";
    ellipse(ctx, hx + 0.12, hy - 0.02, 0.035, 0.04);
    ctx.fillStyle = "#fff";
    ellipse(ctx, hx + 0.11, hy - 0.03, 0.012, 0.012);
  }

  // cheeks
  if (!rear) {
    ctx.fillStyle = "rgba(240,120,130,0.35)";
    if (profile) ellipse(ctx, hx + 0.08, hy + 0.04, 0.06, 0.04);
    else {
      ellipse(ctx, hx - 0.14, hy + 0.04, 0.06, 0.04);
      ellipse(ctx, hx + 0.16, hy + 0.04, 0.06, 0.04);
    }
  }

  if (hat !== "none") drawHat(ctx, hat, hx, hy, rear, profile, time);
  if (hat === "shades") drawShades(ctx, hx, hy, rear, profile);

  if (wet) {
    ctx.fillStyle = "rgba(180,220,255,0.45)";
    ellipse(ctx, -0.1, -0.3, 0.08, 0.08);
    ellipse(ctx, 0.2, -0.5, 0.06, 0.06);
  }

  // near legs
  if (rear) {
    leg(-0.08, 0.26, Math.max(0, l2));
    leg(0.28, 0.24, Math.max(0, l1));
  } else {
    ctx.globalAlpha = 0.95;
    leg(-0.12, 0.26, Math.max(0, l2));
    leg(0.14, 0.28, Math.max(0, l1));
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawHat(ctx, hat, hx, hy, rear, profile, time) {
  const topY = hy - 0.22;
  if (hat === "flower") {
    const spots = rear || profile
      ? [[hx + 0.02, topY - 0.02], [hx + 0.12, topY + 0.02]]
      : [[hx - 0.1, topY], [hx + 0.1, topY], [hx, topY - 0.08]];
    for (const [fx, fy] of spots) {
      ctx.fillStyle = "#FF8AC0";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ellipse(ctx, fx + Math.cos(a) * 0.07, fy + Math.sin(a) * 0.07, 0.045, 0.045);
      }
      ctx.fillStyle = "#FFE66D";
      ellipse(ctx, fx, fy, 0.035, 0.035);
    }
  } else if (hat === "bow") {
    ctx.fillStyle = "#E85D75";
    ctx.beginPath();
    ctx.moveTo(hx, topY);
    ctx.lineTo(hx - 0.16, topY - 0.1);
    ctx.lineTo(hx - 0.16, topY + 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx, topY);
    ctx.lineTo(hx + 0.16, topY - 0.1);
    ctx.lineTo(hx + 0.16, topY + 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#C23B55";
    ellipse(ctx, hx, topY, 0.05, 0.05);
  } else if (hat === "party") {
    ctx.fillStyle = "#6C5CE7";
    ctx.beginPath();
    ctx.moveTo(hx, topY - 0.38);
    ctx.lineTo(hx - 0.16, topY + 0.02);
    ctx.lineTo(hx + 0.16, topY + 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#FFE66D";
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(hx - 0.1, topY - 0.1);
    ctx.lineTo(hx + 0.1, topY - 0.18);
    ctx.stroke();
    ctx.fillStyle = "#FF6B6B";
    ellipse(ctx, hx, topY - 0.4, 0.055, 0.055);
  } else if (hat === "cowboy") {
    ctx.fillStyle = "#8B5A2B";
    ellipse(ctx, hx, topY + 0.02, 0.28, 0.07);
    ctx.fillStyle = "#6E451F";
    ellipse(ctx, hx, topY - 0.08, 0.15, 0.12);
    ctx.fillStyle = "#C9965A";
    ctx.fillRect(hx - 0.15, topY - 0.04, 0.3, 0.03);
  } else if (hat === "beanie" || hat === "propeller") {
    ctx.fillStyle = hat === "propeller" ? "#3D7EDB" : "#E85D4C";
    ellipse(ctx, hx, topY - 0.02, 0.2, 0.12);
    ctx.fillRect(hx - 0.2, topY - 0.02, 0.4, 0.08);
    ctx.fillStyle = "#FFF8EC";
    ellipse(ctx, hx, topY - 0.14, 0.06, 0.06);
    if (hat === "propeller") {
      const ang = time * 10;
      ctx.save();
      ctx.translate(hx, topY - 0.2);
      ctx.rotate(ang);
      ctx.fillStyle = "#F7D560";
      ellipse(ctx, 0, 0, 0.22, 0.04);
      ellipse(ctx, 0, 0, 0.04, 0.22);
      ctx.restore();
    }
  } else if (hat === "crown") {
    ctx.fillStyle = "#F4C430";
    ctx.beginPath();
    ctx.moveTo(hx - 0.18, topY + 0.04);
    ctx.lineTo(hx - 0.18, topY - 0.08);
    ctx.lineTo(hx - 0.1, topY - 0.0);
    ctx.lineTo(hx, topY - 0.2);
    ctx.lineTo(hx + 0.1, topY - 0.0);
    ctx.lineTo(hx + 0.18, topY - 0.08);
    ctx.lineTo(hx + 0.18, topY + 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#E85D4C";
    ellipse(ctx, hx, topY - 0.2, 0.035, 0.035);
  }
}

function drawShades(ctx, hx, hy, rear, profile) {
  if (rear) return;
  ctx.fillStyle = "#2C2C2C";
  if (profile) {
    roundRect(ctx, hx - 0.02, hy - 0.1, 0.16, 0.1, 0.03);
    ctx.fill();
  } else {
    roundRect(ctx, hx - 0.18, hy - 0.1, 0.14, 0.1, 0.03);
    ctx.fill();
    roundRect(ctx, hx + 0.02, hy - 0.1, 0.14, 0.1, 0.03);
    ctx.fill();
    ctx.strokeStyle = "#2C2C2C";
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(hx - 0.04, hy - 0.05);
    ctx.lineTo(hx + 0.02, hy - 0.05);
    ctx.stroke();
  }
}

export function drawPoop(ctx, x, y, scale, age) {
  const bounce = age < 0.35 ? Math.sin((age / 0.35) * Math.PI) * 0.35 : 0;
  const squash = age < 0.4 ? 1 + Math.sin((age / 0.4) * Math.PI) * 0.15 : 1;
  ctx.save();
  ctx.translate(x, y - bounce * scale * 1.2);
  ctx.scale(scale * (1 / squash), scale * squash);

  // shadow
  ctx.fillStyle = "rgba(58,42,26,0.2)";
  ellipse(ctx, 0, 0.28, 0.32, 0.1);

  // stacked swirls — cute emoji-style pile
  const layers = [
    { y: 0.16, rx: 0.32, ry: 0.18, c: "#8A4B1F" },
    { y: 0.02, rx: 0.26, ry: 0.16, c: "#A35A24" },
    { y: -0.12, rx: 0.2, ry: 0.14, c: "#C46A2B" }
  ];
  for (const L of layers) {
    ctx.fillStyle = L.c;
    ellipse(ctx, 0, L.y, L.rx, L.ry);
    ctx.fillStyle = "rgba(255,220,160,0.35)";
    ellipse(ctx, -L.rx * 0.3, L.y - L.ry * 0.2, L.rx * 0.35, L.ry * 0.35);
  }
  // soft-serve tip
  ctx.fillStyle = "#D07A3A";
  ctx.beginPath();
  ctx.moveTo(0, -0.36);
  ctx.quadraticCurveTo(0.14, -0.22, 0.04, -0.18);
  ctx.quadraticCurveTo(-0.1, -0.22, 0, -0.36);
  ctx.fill();
  ctx.fillStyle = "rgba(255,230,180,0.5)";
  ellipse(ctx, -0.03, -0.28, 0.04, 0.05);

  // friendly face
  ctx.fillStyle = "#3A2A1A";
  ellipse(ctx, -0.07, 0.0, 0.035, 0.045);
  ellipse(ctx, 0.08, 0.0, 0.035, 0.045);
  ctx.fillStyle = "#fff";
  ellipse(ctx, -0.08, -0.012, 0.012, 0.014);
  ellipse(ctx, 0.07, -0.012, 0.012, 0.014);
  ctx.strokeStyle = "#3A2A1A";
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.arc(0.01, 0.06, 0.06, 0.15, Math.PI - 0.15);
  ctx.stroke();
  ctx.fillStyle = "rgba(240,120,130,0.35)";
  ellipse(ctx, -0.16, 0.08, 0.04, 0.025);
  ellipse(ctx, 0.17, 0.08, 0.04, 0.025);

  // stink lines + puff
  const rise = (age * 0.55) % 0.9;
  ctx.strokeStyle = "rgba(140,190,80,0.85)";
  ctx.lineWidth = 0.045;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const bx = -0.16 + i * 0.16;
    const by = -0.42 - rise - i * 0.04;
    ctx.beginPath();
    ctx.moveTo(bx, by + 0.28);
    ctx.quadraticCurveTo(bx + 0.08, by + 0.18, bx, by + 0.1);
    ctx.quadraticCurveTo(bx - 0.08, by + 0.02, bx, by - 0.06);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(170,210,90,0.35)";
  ellipse(ctx, 0.02, -0.55 - rise * 0.3, 0.09, 0.06);
  ellipse(ctx, -0.12, -0.62 - rise * 0.25, 0.07, 0.05);
  ctx.restore();
}

export function drawLlamaIcon(ctx, size) {
  ctx.clearRect(0, 0, size, size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r * 0.7, r * 0.6, 8, r, r, r);
  g.addColorStop(0, "#BDEB9F");
  g.addColorStop(1, "#5DBF6A");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  // ground
  ctx.fillStyle = "#4CAF62";
  ctx.beginPath();
  ctx.ellipse(r, size * 0.78, size * 0.38, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  drawLlama(ctx, r, size * 0.72, size * 0.38, 2, 0.4, {
    body: "#F3D7A0",
    blanket: "#E85D4C",
    hat: "flower"
  }, { blink: false });
}

/* ---------------- game instance ---------------- */
export function createGame(opts) {
  const canvas = opts.canvas;
  const preview = opts.preview;
  const ui = opts.ui || {};
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const pctx = preview.getContext("2d", { alpha: true });

  let save = loadSave();
  audio.setMuted(save.muted);

  let screen = "title"; // title | play | customizer | gameover
  let running = true;
  let width = 390, height = 844, dpr = 1;
  let tileW = 72, tileH = 54, thick = 16;

  const world = {
    lanes: new Map(),
    coins: [],
    particles: [],
    poops: [],
    splashes: [],
    maxRow: 0
  };

  const player = {
    x: START_COL, z: 0, col: START_COL, row: 0,
    facing: 0, hopping: false,
    fromX: 0, fromZ: 0, toX: 0, toZ: 0, hopT: 0, hopDur: 0.16,
    hopY: 0, squash: 1, alive: true, wet: false,
    riding: null, rideOff: 0, score: 0, runCoins: 0
  };

  const camera = { z: -1.2, x: START_COL, minZ: -1.2, push: 0, shake: 0 };
  let queued = null;
  let lastT = 0;
  let time = 0;
  let playTime = 0;
  let firstHop = false;
  let hintUntil = 0;
  let overReason = "";
  let overText = "Oops!";
  let overDelay = 0;
  let cloud = { active: false, t: 0, y: 0 };
  let blinkT = 0;
  let previewTime = 0;
  let goShown = false;
  let pendingInput = null;

  function hudRefresh() {
    if (ui.hudScore) ui.hudScore.textContent = String(player.score);
    if (ui.hudCoins) ui.hudCoins.textContent = String(save.coins + (screen === "play" ? player.runCoins : 0));
    if (ui.titleBest) ui.titleBest.textContent = String(save.highScore);
    if (ui.titleCoins) ui.titleCoins.textContent = String(save.coins);
    const label = audio.isMuted() ? "🔇" : "🔊";
    const pressed = audio.isMuted() ? "true" : "false";
    for (const b of [ui.btnMute, ui.btnMuteTitle]) {
      if (!b) continue;
      b.textContent = label;
      b.setAttribute("aria-label", audio.isMuted() ? "Unmute sounds" : "Mute sounds");
      b.setAttribute("aria-pressed", pressed);
    }
  }

  function setScreen(name) {
    screen = name;
    if (ui.titleScreen) ui.titleScreen.classList.toggle("hidden", name !== "title");
    if (ui.customScreen) ui.customScreen.classList.toggle("hidden", name !== "customizer");
    if (ui.goScreen) ui.goScreen.classList.toggle("hidden", name !== "gameover");
    if (ui.hud) ui.hud.classList.toggle("hidden", name !== "play");
    if (ui.hint) {
      const show = name === "play" && time < hintUntil;
      ui.hint.classList.toggle("hidden", !show);
    }
    hudRefresh();
  }

  function grassLane(row, obstacleChance) {
    const blocked = new Set();
    const props = [];
    if (row > 0) {
      for (let c = 0; c < COLS; c++) {
        if (Math.random() < obstacleChance) {
          // keep a path: don't block every col, and never block start column on early rows
          if (row < 6 && c === START_COL) continue;
          blocked.add(c);
          props.push({ kind: Math.random() < 0.55 ? "tree" : "rock", col: c });
        }
      }
      // ensure at least 3 openings
      if (COLS - blocked.size < 3) {
        const keys = [...blocked];
        while (COLS - blocked.size < 3 && keys.length) {
          const k = keys.pop();
          blocked.delete(k);
          const i = props.findIndex((p) => p.col === k);
          if (i >= 0) props.splice(i, 1);
        }
      }
    }
    // flowers
    for (let c = 0; c < COLS; c++) {
      if (!blocked.has(c) && Math.random() < 0.22) props.push({ kind: "flower", col: c, tint: Math.random() });
    }
    return { type: "grass", row, blocked, props, shade: (row & 1) === 0 };
  }

  function roadLane(row, kind) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const difficulty = Math.min(1, row / 80);
    const isTruckLane = kind === "truck" || (kind !== "car" && Math.random() < 0.35);
    const speed = (isTruckLane ? rand(1.3, 2.2) : rand(1.7, 3.1)) * (1 + difficulty * 0.7);
    const gap = rand(3.6, 5.8) - difficulty * 0.6;
    const vehicles = [];
    const w = isTruckLane ? 2.0 : 1.25;
    let x = rand(0, COLS);
    for (let i = 0; i < 5; i++) {
      vehicles.push({
        x, w, kind: isTruckLane ? "truck" : "car",
        color: pick(CAR_COLORS)
      });
      x += (dir * -1) * (w + gap);
    }
    return { type: "road", row, dir, speed, gap, vehicles, line: row % 2 };
  }

  function riverLane(row) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const difficulty = Math.min(1, row / 80);
    const speed = rand(0.9, 1.8) * (1 + difficulty * 0.5);
    const platforms = [];
    const lily = Math.random() < 0.35;
    const w = lily ? 1.0 : rand(1.6, 2.4);
    const gap = lily ? rand(1.6, 2.3) : rand(1.4, 2.2);
    let x = rand(-1, COLS);
    for (let i = 0; i < 7; i++) {
      platforms.push({ x, w, kind: lily ? "lily" : "log" });
      x += dir * -1 * (w + gap);
    }
    return { type: "river", row, dir, speed, platforms };
  }

  function railLane(row) {
    return {
      type: "rail", row,
      dir: Math.random() < 0.5 ? 1 : -1,
      state: "idle",
      timer: rand(1.4, 3.2),
      trainX: -10,
      warned: false,
      len: 10
    };
  }

  function generateLane(row) {
    if (row <= 3) return grassLane(row, row === 0 ? 0 : 0.08);
    const prev = world.lanes.get(row - 1);
    const prevType = prev?.type || "grass";
    const difficulty = Math.min(1, row / 100);
    const r = Math.random();
    let type;
    if (prevType === "rail") type = "grass";
    else if (prevType === "river" && Math.random() < 0.55) type = "grass";
    else if (prevType === "road" && Math.random() < 0.45) type = Math.random() < 0.7 ? "road" : "grass";
    else if (r < 0.26 - difficulty * 0.06) type = "grass";
    else if (r < 0.58) type = "road";
    else if (r < 0.84) type = "river";
    else type = "rail";

    let lane;
    if (type === "grass") lane = grassLane(row, 0.18 + difficulty * 0.08);
    else if (type === "road") lane = roadLane(row);
    else if (type === "river") lane = riverLane(row);
    else lane = railLane(row);

    // coins on open grass / some platforms
    if (type === "grass") {
      for (let c = 0; c < COLS; c++) {
        if (!lane.blocked.has(c) && Math.random() < 0.08) {
          world.coins.push({ x: c, z: row, taken: false });
        }
      }
    } else if (type === "river" && Math.random() < 0.25) {
      const p = pick(lane.platforms);
      world.coins.push({ x: p.x, z: row, taken: false, float: true, plat: p });
    }
    return lane;
  }

  function ensureLanes() {
    const lo = Math.floor(camera.z) - 2;
    const hi = Math.ceil(Math.max(player.z, camera.z) + 16);
    for (let r = Math.max(0, lo); r <= hi; r++) {
      if (!world.lanes.has(r)) world.lanes.set(r, generateLane(r));
    }
    for (const key of [...world.lanes.keys()]) {
      if (key < lo - 4) world.lanes.delete(key);
    }
    world.coins = world.coins.filter((c) => !c.taken && c.z > lo - 2);
  }

  function resetWorld() {
    world.lanes.clear();
    world.coins = [];
    world.particles = [];
    world.poops = [];
    world.splashes = [];
    world.maxRow = 0;
    Object.assign(player, {
      x: START_COL, z: 0, col: START_COL, row: 0,
      facing: 0, hopping: false, hopY: 0, squash: 1,
      alive: true, wet: false, riding: null, rideOff: 0,
      score: 0, runCoins: 0, hopT: 0
    });
    Object.assign(camera, { z: -1.2, x: START_COL, minZ: -1.2, push: 0, shake: 0 });
    queued = null;
    firstHop = false;
    playTime = 0;
    overReason = "";
    overText = "Oops!";
    overDelay = 0;
    goShown = false;
    cloud = { active: false, t: 0, y: 0 };
    ensureLanes();
  }

  function occupied(col, row) {
    const lane = world.lanes.get(row);
    if (!lane || lane.type !== "grass") return false;
    const c = Math.round(col);
    return lane.blocked.has(c);
  }

  function platformAt(lane, x) {
    if (!lane || lane.type !== "river") return null;
    for (const p of lane.platforms) {
      if (x >= p.x - p.w / 2 + 0.12 && x <= p.x + p.w / 2 - 0.12) return p;
    }
    return null;
  }

  function tryHop(dx, dz) {
    if (!player.alive || screen !== "play") return false;
    if (player.hopping) {
      queued = { dx, dz };
      return false;
    }
    if (cloud.active) return false;
    let destX = player.x + dx;
    let destZ = player.z + dz;
    destZ = Math.max(0, Math.round(destZ));
    // snap sideways to grid unless staying on same river row? hops to integer cols when leaving logs
    const destLane = world.lanes.get(destZ);
    if (!destLane || destLane.type !== "river") {
      destX = Math.round(player.x + dx);
    } else {
      destX = player.x + dx;
      // snap toward a platform if close
      let best = null, bestD = 99;
      for (const p of destLane.platforms) {
        const d = Math.abs(destX - p.x);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best && bestD < best.w / 2 + 0.35) destX = clamp(destX, best.x - best.w / 2 + 0.25, best.x + best.w / 2 - 0.25);
    }
    destX = clamp(destX, 0, COLS - 1);
    if (occupied(destX, destZ)) {
      camera.shake = 0.15;
      return false;
    }
    if (destX === player.x && destZ === player.z) return false;

    player.hopping = true;
    player.fromX = player.x;
    player.fromZ = player.z;
    player.toX = destX;
    player.toZ = destZ;
    player.hopT = 0;
    player.riding = null;
    if (dz > 0) player.facing = 0;
    else if (dz < 0) player.facing = 2;
    else if (dx > 0) player.facing = 1;
    else if (dx < 0) player.facing = 3;
    audio.playHop();
    firstHop = true;
    return true;
  }

  function collectCoins() {
    for (const c of world.coins) {
      if (c.taken) continue;
      const cx = c.float && c.plat ? c.plat.x : c.x;
      if (Math.abs(player.x - cx) < 0.45 && Math.abs(player.z - c.z) < 0.45) {
        c.taken = true;
        player.runCoins += 1;
        audio.playCoin();
        burst(player.x, player.z, "#F4C430", 8);
        hudRefresh();
      }
    }
  }

  function burst(x, z, color, n) {
    for (let i = 0; i < n; i++) {
      world.particles.push({
        x, z, vx: rand(-1.4, 1.4), vz: rand(-0.6, 0.6), vy: rand(1.2, 2.8),
        y: 0.4, life: rand(0.35, 0.7), age: 0, color, r: rand(0.06, 0.12)
      });
    }
  }

  function die(reason) {
    if (!player.alive) return;
    player.alive = false;
    player.hopping = false;
    overReason = reason;
    overDelay = 0.95;
    goShown = false;
    camera.shake = 0.35;
    save.coins += player.runCoins;
    if (player.score > save.highScore) save.highScore = player.score;
    writeSave(save);

    if (reason === "water") {
      overText = "Oops!";
      if (ui.goOops) ui.goOops.textContent = "Oops!";
      if (ui.goReason) ui.goReason.textContent = "Splash! The llama took a dip.";
      player.wet = true;
      audio.playSplash();
      audio.playBubblyFart();
      world.splashes.push({ x: player.x, z: player.z, age: 0 });
    } else if (reason === "cloud") {
      overText = "Gotcha!";
      if (ui.goOops) ui.goOops.textContent = "Gotcha!";
      if (ui.goReason) ui.goReason.textContent = "Nimbus the cloud scooped you up!";
      cloud = { active: true, t: 0, y: 0 };
      audio.playCloud();
    } else {
      overText = "Oops!";
      if (ui.goOops) ui.goOops.textContent = "Oops!";
      const who = reason === "train" ? "A train zoomed by!" : "Bumped by a ride!";
      if (ui.goReason) ui.goReason.textContent = who + " Somebody tooted.";
      audio.playFart();
      burst(player.x, player.z, "#F7E7C6", 10);
      const side = player.x < START_COL ? 0.55 : -0.55;
      world.poops.push({ x: player.x + side, z: player.z, age: 0 });
    }
    if (ui.goScore) ui.goScore.textContent = String(player.score);
    if (ui.goBest) ui.goBest.textContent = String(save.highScore);
    if (ui.goCoins) ui.goCoins.textContent = String(player.runCoins);
    hudRefresh();
  }

  function vehicleHit(lane) {
    if (!lane || (lane.type !== "road" && lane.type !== "rail")) return null;
    if (lane.type === "rail") {
      if (lane.state !== "passing") return null;
      const x = lane.trainX;
      const w = lane.len;
      if (player.x > x - w / 2 && player.x < x + w / 2) return "train";
      return null;
    }
    for (const v of lane.vehicles) {
      const pad = 0.28;
      if (player.x > v.x - v.w / 2 + pad && player.x < v.x + v.w / 2 - pad) {
        return v.kind === "truck" ? "truck" : "car";
      }
    }
    return null;
  }

  function finishHop() {
    player.hopping = false;
    player.x = player.toX;
    player.z = player.toZ;
    player.col = Math.round(player.x);
    player.row = Math.round(player.z);
    player.squash = 0.78;
    if (player.row > world.maxRow) {
      world.maxRow = player.row;
      player.score = world.maxRow;
    }
    const lane = world.lanes.get(player.row);
    if (lane?.type === "river") {
      const p = platformAt(lane, player.x);
      if (!p) { die("water"); return; }
      player.riding = p;
      player.rideOff = player.x - p.x;
    } else {
      player.riding = null;
    }
    collectCoins();
    if (player.alive) {
      const hit = vehicleHit(lane);
      if (hit) die(hit);
    }
    if (player.alive && queued) {
      const q = queued; queued = null;
      tryHop(q.dx, q.dz);
    }
  }

  function updateTraffic(dt) {
    for (const lane of world.lanes.values()) {
      if (lane.type === "road") {
        for (const v of lane.vehicles) v.x += lane.dir * lane.speed * dt;
        const minX = -6, maxX = COLS + 6;
        lane.vehicles = lane.vehicles.filter((v) => v.x > minX && v.x < maxX);
        const spawnX = lane.dir > 0 ? minX + 0.5 : maxX - 0.5;
        const clear = lane.vehicles.every((v) => Math.abs(v.x - spawnX) > lane.gap + v.w);
        if (clear) {
          lane.vehicles.push({
            x: spawnX, w: lane.vehicles[0]?.w || 1.25,
            kind: lane.vehicles[0]?.kind || "car",
            color: pick(CAR_COLORS)
          });
        }
      } else if (lane.type === "river") {
        for (const p of lane.platforms) p.x += lane.dir * lane.speed * dt;
        for (const p of lane.platforms) {
          if (lane.dir > 0 && p.x - p.w / 2 > COLS + 3) p.x -= (COLS + 8);
          if (lane.dir < 0 && p.x + p.w / 2 < -3) p.x += (COLS + 8);
        }
      } else if (lane.type === "rail") {
        lane.timer -= dt;
        if (lane.state === "idle" && lane.timer <= 0) {
          lane.state = "warning";
          lane.timer = 1.05;
          lane.warned = true;
          if (Math.abs(lane.row - player.z) < 8) audio.playWarning();
        } else if (lane.state === "warning" && lane.timer <= 0) {
          lane.state = "passing";
          lane.timer = 0.7;
          lane.trainX = lane.dir > 0 ? -6 : COLS + 6;
          if (Math.abs(lane.row - player.z) < 8) audio.playTrain();
        } else if (lane.state === "passing") {
          const span = COLS + 14;
          const t = 1 - lane.timer / 0.7;
          lane.trainX = lane.dir > 0 ? lerp(-6, COLS + 8, t) : lerp(COLS + 6, -8, t);
          if (lane.timer <= 0) {
            lane.state = "idle";
            lane.timer = rand(2.2, 4.8);
            lane.warned = false;
          }
        }
      }
    }
  }

  function update(dt) {
    time += dt;
    previewTime += dt;
    blinkT += dt;
    if (camera.shake > 0) camera.shake = Math.max(0, camera.shake - dt * 2);

    for (const p of world.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.y += p.vy * dt;
      p.vy -= 6 * dt;
    }
    world.particles = world.particles.filter((p) => p.age < p.life);
    for (const p of world.poops) p.age += dt;
    for (const s of world.splashes) s.age += dt;
    world.splashes = world.splashes.filter((s) => s.age < 0.9);

    if (screen === "play" && player.alive) {
      playTime += dt;
      if (player.hopping) {
        player.hopT += dt / player.hopDur;
        const t = clamp(player.hopT, 0, 1);
        const e = easeOut(t);
        player.x = lerp(player.fromX, player.toX, e);
        player.z = lerp(player.fromZ, player.toZ, e);
        player.hopY = Math.sin(t * Math.PI) * 0.55;
        if (t >= 1) finishHop();
      } else if (player.riding) {
        player.x = player.riding.x + player.rideOff;
        if (player.x < -0.45 || player.x > COLS - 0.55) die("water");
      }
      if (player.squash < 1) player.squash = Math.min(1, player.squash + dt * 3);

      if (player.alive && !player.hopping) {
        const lane = world.lanes.get(Math.round(player.z));
        const hit = vehicleHit(lane);
        if (hit) die(hit);
        if (lane?.type === "river" && !player.riding && !platformAt(lane, player.x)) die("water");
        collectCoins();
      }

      // camera push
      if (firstHop || playTime > 2.2) {
        camera.push = Math.min(0.72, camera.push + dt * 0.08);
        if (camera.push < 0.32) camera.push = 0.32;
      }
      camera.minZ += camera.push * dt;
      const follow = player.z - 1.15;
      camera.z = Math.max(camera.minZ, lerp(camera.z, follow, 1 - Math.pow(0.001, dt)));
      camera.x = lerp(camera.x, player.x, 1 - Math.pow(0.02, dt));
      if (player.alive && player.z < camera.minZ - 0.4) die("cloud");

      ensureLanes();
      updateTraffic(dt);
      hudRefresh();
    } else if (screen === "play" && !player.alive) {
      updateTraffic(dt * 0.4);
      if (cloud.active) cloud.t += dt;
      overDelay -= dt;
      if (!goShown && overDelay <= 0) {
        goShown = true;
        setScreen("gameover");
      }
    } else {
      // title ambient: slow traffic, idle llama
      ensureLanes();
      updateTraffic(dt * 0.5);
      camera.z = lerp(camera.z, -1.0, 0.02);
      camera.x = lerp(camera.x, START_COL, 0.02);
    }
  }

  function toScreen(col, row, h = 0) {
    const z = row - camera.z;
    const x = col - camera.x;
    const sx = width / 2 + x * tileW + (camera.shake ? (Math.random() - 0.5) * 10 * camera.shake : 0);
    const sy = height * 0.80 - z * tileH - h * tileH * 0.9;
    return { x: sx, y: sy, z };
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "#8FD6F2");
    g.addColorStop(0.45, "#BFE9F7");
    g.addColorStop(0.62, "#E7F7C8");
    g.addColorStop(1, "#7BC47A");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    // sun
    ctx.fillStyle = "#FFE66D";
    ctx.beginPath();
    ctx.arc(width * 0.82, height * 0.12, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,230,110,0.28)";
    ctx.beginPath();
    ctx.arc(width * 0.82, height * 0.12, 62, 0, Math.PI * 2);
    ctx.fill();
    // fluffy decorative clouds (not Nimbus)
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const cx = (time * 8) % (width + 200) - 80;
    puff(ctx, cx, height * 0.16, 28);
    puff(ctx, (cx + width * 0.5) % (width + 200) - 40, height * 0.1, 22);
  }

  function puff(ctx, x, y, s) {
    ellipse(ctx, x, y, s, s * 0.65);
    ellipse(ctx, x - s * 0.7, y + s * 0.1, s * 0.7, s * 0.5);
    ellipse(ctx, x + s * 0.7, y + s * 0.12, s * 0.65, s * 0.48);
  }

  function drawGrassTile(sx, sy, w, d, alt) {
    const top = alt ? "#6BC96C" : "#62C464";
    roundedBox3D(ctx, sx, sy, w, d, thick, top, "#3E9A4C", "#2F7D3C");
    ctx.fillStyle = alt ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)";
    ctx.fillRect(sx - w / 2 + 4, sy - d + 4, w - 8, d - 8);
  }

  function drawRoadTile(sx, sy, w, d) {
    roundedBox3D(ctx, sx, sy, w, d, thick, "#5A5F66", "#3E4348", "#2F3338");
    ctx.strokeStyle = "#F4C430";
    ctx.setLineDash([10, 12]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 + 6, sy - d / 2);
    ctx.lineTo(sx + w / 2 - 6, sy - d / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawRiverTile(sx, sy, w, d, t) {
    const top = "#3CA0D0";
    roundedBox3D(ctx, sx, sy, w, d, thick, top, "#2B7FA8", "#1F6284");
    ctx.strokeStyle = "rgba(200,240,255,0.45)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const oy = sy - d * (0.3 + i * 0.35) + Math.sin(t * 2 + sx * 0.02 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(sx - w / 2 + 6, oy);
      ctx.bezierCurveTo(sx - 10, oy + 4, sx + 10, oy - 4, sx + w / 2 - 6, oy);
      ctx.stroke();
    }
  }

  function drawRailTile(sx, sy, w, d) {
    roundedBox3D(ctx, sx, sy, w, d, thick, "#8A7A62", "#6B5C48", "#534634");
    ctx.strokeStyle = "#C0C6CC";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx - w / 2 + 4, sy - d * 0.65);
    ctx.lineTo(sx + w / 2 - 4, sy - d * 0.65);
    ctx.moveTo(sx - w / 2 + 4, sy - d * 0.3);
    ctx.lineTo(sx + w / 2 - 4, sy - d * 0.3);
    ctx.stroke();
    ctx.strokeStyle = "#6B4A2A";
    ctx.lineWidth = 5;
    const tieStep = 22;
    const x0 = sx - w / 2 + 16;
    const x1 = sx + w / 2 - 16;
    for (let tx = x0; tx <= x1; tx += tieStep) {
      ctx.beginPath();
      ctx.moveTo(tx - 9, sy - d + 5);
      ctx.lineTo(tx + 9, sy - 3);
      ctx.stroke();
    }
  }

  function drawTree(sx, sy, s) {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ellipse(ctx, sx, sy + 4, 16 * s, 6 * s);
    ctx.fillStyle = "#8B5A2B";
    ctx.fillRect(sx - 5 * s, sy - 22 * s, 10 * s, 24 * s);
    ctx.fillStyle = "#2F9E4F";
    ellipse(ctx, sx, sy - 38 * s, 22 * s, 20 * s);
    ctx.fillStyle = "#47C066";
    ellipse(ctx, sx - 14 * s, sy - 30 * s, 14 * s, 13 * s);
    ctx.fillStyle = "#3AAF58";
    ellipse(ctx, sx + 14 * s, sy - 30 * s, 14 * s, 13 * s);
    ctx.fillStyle = "#6FCF7A";
    ellipse(ctx, sx - 4 * s, sy - 44 * s, 10 * s, 8 * s);
  }

  function drawRock(sx, sy, s) {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ellipse(ctx, sx, sy + 4, 16 * s, 6 * s);
    ctx.fillStyle = "#8A8F96";
    ellipse(ctx, sx, sy - 8 * s, 18 * s, 12 * s);
    ctx.fillStyle = "#B0B5BB";
    ellipse(ctx, sx - 6 * s, sy - 12 * s, 8 * s, 6 * s);
    ctx.fillStyle = "#6E737A";
    ellipse(ctx, sx + 8 * s, sy - 4 * s, 7 * s, 5 * s);
  }

  function drawFlower(sx, sy, tint) {
    const colors = ["#FF8AC0", "#FFE66D", "#C77DFF", "#FF9F45"];
    ctx.fillStyle = "#2F9E4F";
    ctx.fillRect(sx - 1.5, sy - 10, 3, 12);
    ctx.fillStyle = colors[(tint * colors.length) | 0];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ellipse(ctx, sx + Math.cos(a) * 5, sy - 12 + Math.sin(a) * 5, 4, 4);
    }
    ctx.fillStyle = "#FFE66D";
    ellipse(ctx, sx, sy - 12, 3, 3);
  }

  function drawCarShape(ctx, x, y, w, h, color, truck) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ellipse(ctx, x, y + h * 0.45, w * 0.45, 6);
    ctx.fillStyle = shade(color, -50);
    // wheels
    ctx.fillStyle = "#2C2C2C";
    const ww = truck ? 0.18 : 0.22;
    ellipse(ctx, x - w * 0.32, y + h * 0.38, 9, 8);
    ellipse(ctx, x + w * 0.32, y + h * 0.38, 9, 8);
    if (truck) ellipse(ctx, x, y + h * 0.38, 9, 8);
    ctx.fillStyle = color;
    roundRect(ctx, x - w / 2, y - h / 2, w, h, 8);
    ctx.fill();
    ctx.fillStyle = shade(color, 30);
    roundRect(ctx, x - w / 2 + 4, y - h / 2 + 3, w - 8, h * 0.28, 4);
    ctx.fill();
    ctx.fillStyle = "#D8F0FF";
    if (truck) {
      roundRect(ctx, x + w * 0.18, y - h * 0.28, w * 0.22, h * 0.32, 4);
      ctx.fill();
    } else {
      roundRect(ctx, x - w * 0.22, y - h * 0.28, w * 0.44, h * 0.28, 4);
      ctx.fill();
    }
  }

  function drawLog(sx, sy, wpx) {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ellipse(ctx, sx, sy + 6, wpx * 0.5, 7);
    ctx.fillStyle = "#A36B3C";
    roundRect(ctx, sx - wpx / 2, sy - 14, wpx, 22, 10);
    ctx.fill();
    ctx.strokeStyle = "#7A4A24";
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(sx + i * (wpx / 6), sy - 3, 6, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#C48A55";
    ellipse(ctx, sx - wpx / 2 + 6, sy - 3, 8, 10);
    ellipse(ctx, sx + wpx / 2 - 6, sy - 3, 8, 10);
  }

  function drawLily(sx, sy, wpx) {
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ellipse(ctx, sx, sy + 6, wpx * 0.45, 7);
    ctx.fillStyle = "#5BB85A";
    ellipse(ctx, sx, sy - 4, wpx * 0.45, wpx * 0.28);
    ctx.fillStyle = "#7ED67A";
    ellipse(ctx, sx - 6, sy - 8, wpx * 0.2, wpx * 0.14);
    ctx.fillStyle = "#3A8F40";
    ctx.beginPath();
    ctx.moveTo(sx, sy - 4);
    ctx.lineTo(sx + wpx * 0.45, sy - 2);
    ctx.lineTo(sx + 8, sy + 2);
    ctx.closePath();
    ctx.fill();
  }

  function drawTrain(sx, sy, dir) {
    const cars = 5;
    const cw = tileW * 1.6;
    for (let i = 0; i < cars; i++) {
      const cx = sx + (dir > 0 ? -i : i) * (cw + 8);
      const color = i === 0 ? "#E85D4C" : pick(["#3D7EDB", "#F4C430", "#2F9E6B", "#C77DFF"]);
      drawCarShape(ctx, cx, sy - 16, cw, 28, color, true);
      if (i === 0) {
        // cheerful engine cabin, not scary
        ctx.fillStyle = "#FFF8EC";
        ellipse(ctx, cx + dir * 20, sy - 28, 8, 8);
        ctx.fillStyle = "#3A2A1A";
        ellipse(ctx, cx + dir * 18, sy - 28, 2, 2.5);
        ctx.fillStyle = "#888";
        ctx.fillRect(cx - dir * 30, sy - 40, 10, 16);
        ctx.fillStyle = "rgba(200,200,200,0.5)";
        ellipse(ctx, cx - dir * 26, sy - 52, 10, 8);
      }
    }
  }

  function drawSignal(sx, sy, on) {
    ctx.fillStyle = "#3A2A1A";
    ctx.fillRect(sx - 4, sy - 50, 8, 50);
    ctx.fillStyle = "#2C2C2C";
    roundRect(ctx, sx - 14, sy - 74, 28, 28, 6);
    ctx.fill();
    ctx.fillStyle = on ? "#FF4D4D" : "#5A2020";
    ellipse(ctx, sx, sy - 60, 8, 8);
    if (on) {
      ctx.fillStyle = "rgba(255,70,70,0.28)";
      ellipse(ctx, sx, sy - 60, 14, 14);
    }
  }

  function drawCoin(sx, sy, t) {
    const spin = 0.55 + Math.abs(Math.cos(t * 4)) * 0.45;
    ctx.save();
    ctx.translate(sx, sy - 18 - Math.sin(t * 3) * 4);
    ctx.scale(spin, 1);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ellipse(ctx, 0, 16, 10, 4);
    ctx.fillStyle = "#F4C430";
    ellipse(ctx, 0, 0, 12, 12);
    ctx.fillStyle = "#FFE66D";
    ellipse(ctx, -2, -2, 7, 7);
    ctx.strokeStyle = "#C48A10";
    ctx.lineWidth = 2;
    strokeEllipse(ctx, 0, 0, 8, 8);
    ctx.restore();
  }

  function drawNimbus(sx, sy, t) {
    const bob = Math.sin(t * 3) * 6;
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    puff(ctx, 0, 0, 48);
    puff(ctx, -40, 8, 32);
    puff(ctx, 42, 10, 30);
    // smile face
    ctx.fillStyle = "rgba(240,140,150,0.4)";
    ellipse(ctx, -22, 8, 10, 6);
    ellipse(ctx, 22, 8, 10, 6);
    ctx.fillStyle = "#3A2A1A";
    ellipse(ctx, -16, -4, 5, 7);
    ellipse(ctx, 16, -4, 5, 7);
    ctx.fillStyle = "#fff";
    ellipse(ctx, -18, -7, 2, 2.4);
    ellipse(ctx, 14, -7, 2, 2.4);
    ctx.strokeStyle = "#3A2A1A";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 8, 14, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function drawSplashFx(s) {
    const p = toScreen(s.x, s.z, 0);
    const a = s.age;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = 1 - a / 0.9;
    ctx.fillStyle = "rgba(220,245,255,0.8)";
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI + 0.2;
      const d = 10 + a * 40;
      ellipse(ctx, Math.cos(ang) * d, -a * 30 + Math.sin(ang) * 8, 6, 10);
    }
    ctx.fillStyle = "rgba(80,170,210,0.5)";
    ellipse(ctx, 0, 4, 20 + a * 30, 8);
    // bubbles
    ctx.fillStyle = "rgba(200,240,255,0.8)";
    for (let i = 0; i < 6; i++) {
      ellipse(ctx, -16 + i * 7, -20 - a * 50 - (i % 3) * 8, 4, 4);
    }
    ctx.restore();
  }

  function renderWorld() {
    drawSky();
    const lo = Math.floor(camera.z) - 1;
    const hi = lo + 18;
    const rows = [];
    for (let r = hi; r >= lo; r--) {
      if (r < 0) continue;
      const lane = world.lanes.get(r);
      if (lane) rows.push(lane);
    }

    for (const lane of rows) {
      const mid = toScreen((COLS - 1) / 2, lane.row, 0);
      const d = tileH * 0.78;
      if (lane.type === "grass") {
        for (let c = 0; c < COLS; c++) {
          const p = toScreen(c, lane.row, 0);
          drawGrassTile(p.x, p.y, tileW + 1.5, d, (c + lane.row) % 2 === 0);
        }
      } else if (lane.type === "road") {
        drawRoadTile(mid.x, mid.y, tileW * COLS + 2, d);
      } else if (lane.type === "river") {
        drawRiverTile(mid.x, mid.y, tileW * COLS + 2, d, time);
      } else {
        drawRailTile(mid.x, mid.y, tileW * COLS + 2, d);
        const sig = toScreen(-0.65, lane.row, 0);
        const on = (lane.state === "warning" && Math.sin(time * 16) > 0) || lane.state === "passing";
        drawSignal(sig.x, sig.y, on);
      }
    }

    // platforms, props, coins, vehicles — still far to near
    for (const lane of rows) {
      if (lane.type === "river") {
        for (const p of lane.platforms) {
          const s = toScreen(p.x, lane.row, 0.15);
          if (p.kind === "log") drawLog(s.x, s.y, p.w * tileW);
          else drawLily(s.x, s.y, Math.max(tileW * 0.9, p.w * tileW));
        }
      }
      if (lane.type === "grass") {
        for (const prop of lane.props) {
          const s = toScreen(prop.col, lane.row, 0);
          if (prop.kind === "tree") drawTree(s.x, s.y, 1);
          else if (prop.kind === "rock") drawRock(s.x, s.y, 1);
          else drawFlower(s.x, s.y, prop.tint || 0);
        }
      }
      for (const c of world.coins) {
        if (c.taken || c.z !== lane.row) continue;
        const cx = c.float && c.plat ? c.plat.x : c.x;
        const s = toScreen(cx, c.z, 0.2);
        drawCoin(s.x, s.y, time);
      }

      const drawPlayerHere = (screen === "play" || screen === "gameover") && (player.alive || overReason !== "cloud");
      const pz = player.z;
      if (drawPlayerHere && Math.round(pz) === lane.row) {
        // poop in this row first / beside
        for (const po of world.poops) {
          if (Math.round(po.z) !== lane.row) continue;
          const s = toScreen(po.x, po.z, 0);
          drawPoop(ctx, s.x, s.y + 8, tileW * 0.85, po.age);
        }
        const s = toScreen(player.x, player.z, 0);
        const blinking = (blinkT % 3.2) > 3.0;
        drawLlama(ctx, s.x, s.y + 6, tileW * 0.82, player.facing, time, save.custom, {
          hopY: player.hopY * tileH * 0.9 / (tileW * 0.82),
          squash: player.squash,
          blink: blinking,
          wet: player.wet,
          walk: player.hopping ? time * 12 : 0
        });
        // Oops tag
        if (!player.alive && overReason !== "cloud" && overReason !== "water") {
          ctx.font = "bold 28px -apple-system, Trebuchet MS, sans-serif";
          ctx.textAlign = "center";
          ctx.lineWidth = 6;
          ctx.strokeStyle = "#3A2A1A";
          ctx.fillStyle = "#E85D4C";
          const oy = s.y - tileW * 1.15 + Math.sin(Math.min(world.poops[0]?.age || 0, 1) * Math.PI) * 8;
          ctx.strokeText("Oops!", s.x, oy);
          ctx.fillText("Oops!", s.x, oy);
        }
        if (!player.alive && overReason === "water") {
          ctx.font = "bold 28px -apple-system, Trebuchet MS, sans-serif";
          ctx.textAlign = "center";
          ctx.lineWidth = 6;
          ctx.strokeStyle = "#3A2A1A";
          ctx.fillStyle = "#3D7EDB";
          ctx.strokeText("Oops!", s.x, s.y - 70);
          ctx.fillText("Oops!", s.x, s.y - 70);
        }
      } else {
        for (const po of world.poops) {
          if (Math.round(po.z) !== lane.row) continue;
          const s = toScreen(po.x, po.z, 0);
          drawPoop(ctx, s.x, s.y + 8, tileW * 0.85, po.age);
        }
      }

      if (lane.type === "road") {
        for (const v of lane.vehicles) {
          const s = toScreen(v.x, lane.row, 0.2);
          drawCarShape(ctx, s.x, s.y - 12, v.w * tileW, 26, v.color, v.kind === "truck");
        }
      }
      if (lane.type === "rail" && lane.state === "passing") {
        const s = toScreen(lane.trainX, lane.row, 0.25);
        drawTrain(s.x, s.y, lane.dir);
      }

      for (const sp of world.splashes) {
        if (Math.round(sp.z) === lane.row) drawSplashFx(sp);
      }
    }

    // particles
    for (const p of world.particles) {
      const s = toScreen(p.x, p.z, p.y);
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = p.color;
      ellipse(ctx, s.x, s.y, p.r * tileW, p.r * tileW);
      ctx.globalAlpha = 1;
    }

    if (cloud.active) {
      const s = toScreen(player.x, player.z, 0);
      const rise = Math.min(1, cloud.t / 0.8);
      drawNimbus(s.x, s.y - 20 - rise * 40, time);
      // llama scooped
      drawLlama(ctx, s.x, s.y - rise * 80, tileW * 0.55, 2, time, save.custom, {
        hopY: 0, squash: 1, blink: false
      });
    }

    if (screen === "title") {
      // big idle llama in the foreground
      drawLlama(ctx, width / 2, height * 0.62, Math.min(tileW * 1.35, width * 0.28), 2, time, save.custom, {
        hopY: Math.sin(time * 2) * 0.08,
        squash: 1,
        blink: (blinkT % 3.4) > 3.15,
        walk: 0
      });
    }
  }

  function renderPreview() {
    if (screen !== "customizer" && !opts.alwaysPreview) return;
    const pw = preview.width, ph = preview.height;
    pctx.clearRect(0, 0, pw, ph);
    // soft meadow
    const g = pctx.createLinearGradient(0, 0, 0, ph);
    g.addColorStop(0, "#8FD6F2");
    g.addColorStop(0.7, "#D4F0A8");
    g.addColorStop(1, "#6BC96C");
    pctx.fillStyle = g;
    pctx.fillRect(0, 0, pw, ph);
    pctx.fillStyle = "rgba(255,255,255,0.8)";
    puff(pctx, 70, 50, 18);
    puff(pctx, 260, 40, 16);
    pctx.fillStyle = "#54B45A";
    pctx.beginPath();
    pctx.ellipse(pw / 2, ph * 0.86, 120, 24, 0, 0, Math.PI * 2);
    pctx.fill();
    const blinking = (previewTime % 3.2) > 3.0;
    drawLlama(pctx, pw / 2, ph * 0.78, 90, 2, previewTime, save.custom, {
      hopY: Math.sin(previewTime * 2) * 0.1,
      squash: 1,
      blink: blinking,
      walk: 0
    });
  }

  function frame(ts) {
    if (!running) return;
    const t = ts * 0.001;
    let dt = lastT ? t - lastT : 0.016;
    lastT = t;
    dt = Math.min(0.05, Math.max(0, dt));
    update(dt);
    if (ui.hint && screen === "play") {
      ui.hint.classList.toggle("hidden", time >= hintUntil);
    }
    renderWorld();
    renderPreview();
    requestAnimationFrame(frame);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = width / 390;
    tileW = 62 * Math.max(0.9, scale);
    tileH = 50 * Math.max(0.9, scale);
    thick = 16 * Math.max(0.9, scale);
    // preview backing store
    const prect = preview.getBoundingClientRect();
    const pdpr = Math.min(2, window.devicePixelRatio || 1);
    if (prect.width) {
      preview.width = Math.round(prect.width * pdpr);
      preview.height = Math.round(prect.height * pdpr);
      pctx.setTransform(pdpr, 0, 0, pdpr, 0, 0);
    }
  }

  // input
  let touchId = null, t0x = 0, t0y = 0, t0t = 0;

  function onPointerDown(e) {
    if (screen !== "play") return;
    if (e.target && e.target.closest && e.target.closest("button")) return;
    audio.unlock();
    const pt = e.changedTouches ? e.changedTouches[0] : e;
    touchId = pt.identifier ?? "m";
    t0x = pt.clientX; t0y = pt.clientY; t0t = performance.now();
  }
  function onPointerUp(e) {
    if (screen !== "play") return;
    const pt = e.changedTouches ? e.changedTouches[0] : e;
    if ((pt.identifier ?? "m") !== touchId && e.changedTouches) return;
    const dx = pt.clientX - t0x;
    const dy = pt.clientY - t0y;
    const dist = Math.hypot(dx, dy);
    if (dist < 22) tryHop(0, 1);
    else if (Math.abs(dx) > Math.abs(dy)) tryHop(dx > 0 ? 1 : -1, 0);
    else tryHop(0, dy > 0 ? -1 : 1);
    touchId = null;
  }

  function onKey(e) {
    if (e.repeat) return;
    audio.unlock();
    const k = e.key;
    if (k === "ArrowUp" || k === "w" || k === "W" || k === " ") { e.preventDefault(); tryHop(0, 1); }
    else if (k === "ArrowDown" || k === "s" || k === "S") { e.preventDefault(); tryHop(0, -1); }
    else if (k === "ArrowLeft" || k === "a" || k === "A") { e.preventDefault(); tryHop(-1, 0); }
    else if (k === "ArrowRight" || k === "d" || k === "D") { e.preventDefault(); tryHop(1, 0); }
    else if (k === "m" || k === "M") toggleMuted();
  }

  function toggleMuted() {
    const m = audio.toggleMute();
    save.muted = m;
    writeSave(save);
    hudRefresh();
    return m;
  }

  function startGame() {
    audio.unlock();
    audio.playUi();
    resetWorld();
    hintUntil = save.seenHint ? 0 : time + 4.5;
    if (!save.seenHint) { save.seenHint = true; writeSave(save); }
    setScreen("play");
  }

  function showTitle() {
    setScreen("title");
    resetWorld();
    player.facing = 2;
  }

  function openCustomizer() {
    audio.unlock();
    audio.playUi();
    setScreen("customizer");
    if (opts.onCustomOpen) opts.onCustomOpen(save);
    renderPreview();
  }

  function closeCustomizer(thenPlay) {
    audio.playUi();
    writeSave(save);
    if (thenPlay) startGame();
    else showTitle();
  }

  function setBodyColor(hex) {
    save.custom.body = hex;
    writeSave(save);
    renderPreview();
  }
  function setBlanketColor(hex) {
    save.custom.blanket = hex;
    writeSave(save);
    renderPreview();
  }
  function unlockHat(id) {
    const hat = HATS.find((h) => h.id === id);
    if (!hat) return { ok: false, reason: "missing" };
    if (save.unlockedHats.includes(id)) {
      save.custom.hat = id;
      writeSave(save);
      renderPreview();
      return { ok: true, already: true };
    }
    if (save.coins < hat.cost) return { ok: false, reason: "coins", need: hat.cost, have: save.coins };
    save.coins -= hat.cost;
    save.unlockedHats.push(id);
    save.custom.hat = id;
    writeSave(save);
    audio.playUnlock();
    hudRefresh();
    renderPreview();
    return { ok: true, unlocked: true };
  }
  function setHat(id) { return unlockHat(id); }

  /** Test helper: trigger a specific game-over immediately. */
  function forceHit(reason) {
    startGame();
    // Stand on a clear grass tile so the poop/splash is easy to see.
    player.x = START_COL;
    player.z = 2;
    player.col = START_COL;
    player.row = 2;
    player.riding = null;
    player.wet = false;
    player.hopping = false;
    player.alive = true;
    player.score = Math.max(player.score, 2);
    world.maxRow = Math.max(world.maxRow, 2);
    camera.z = player.z - 1.15;
    camera.minZ = camera.z;
    world.splashes = [];
    world.poops = [];
    die(reason || "car");
  }

  function getState() {
    return {
      screen, score: player.score, runCoins: player.runCoins,
      coins: save.coins, highScore: save.highScore,
      custom: { ...save.custom }, unlockedHats: [...save.unlockedHats],
      muted: audio.isMuted(),
      alive: player.alive, hopping: player.hopping,
      x: player.x, z: player.z, facing: player.facing,
      overReason, overText, goShown, overDelay,
      poops: world.poops.map((p) => ({ ...p })),
      swExpected: true
    };
  }

  // boot
  resize();
  resetWorld();
  player.facing = 2;
  setScreen("title");
  window.addEventListener("resize", resize);
  canvas.addEventListener("touchstart", onPointerDown, { passive: true });
  canvas.addEventListener("touchend", onPointerUp, { passive: true });
  canvas.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mouseup", onPointerUp);
  window.addEventListener("keydown", onKey);
  requestAnimationFrame(frame);

  return {
    startGame, showTitle, openCustomizer, closeCustomizer,
    setBodyColor, setBlanketColor, setHat, unlockHat,
    toggleMuted, hop: tryHop, forceHit, getState, getSave: () => save,
    resize, drawLlamaIcon, hudRefresh,
    BODY_COLORS, BLANKET_COLORS, HATS
  };
}
