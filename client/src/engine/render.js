// Desenho do mapa no canvas: grade, paredes, tokens, condições, PV, turno e névoa.
import { cam, cellKey, isGm, on, state } from "./state.js";
import { assetUrl, connected } from "./net.js";
import { celulasIluminadas, toWorld } from "./geometry.js";

// O <canvas> é criado pelo componente Mapa e entregue aqui por attachCanvas().
let canvas = null;
let ctx = null;
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
let bgImage = null;

// Estado temporário de interação (pré-visualizações), preenchido pelo input.js
export const overlay = { drag: null, area: null, flash: null }; // area: prévia da magia; flash: área recém-conjurada

export const getCanvas = () => canvas;

/** Liga o desenho a um <canvas>. Devolve a função que desfaz a ligação. */
export function attachCanvas(el) {
  canvas = el;
  ctx = el.getContext("2d");
  window.addEventListener("resize", resize);
  resize();
  return () => {
    window.removeEventListener("resize", resize);
    if (canvas === el) { canvas = null; ctx = null; }
  };
}

export function resize() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

export function centralizar() {
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  cam.x = r.width / 2;
  cam.y = r.height / 2;
  cam.zoom = 1;
}

function carregarFundo() {
  if (!state.grid.bg) { bgImage = null; return; }
  bgImage = new Image();
  bgImage.onload = draw;
  bgImage.onerror = () => { bgImage = null; draw(); };
  bgImage.src = assetUrl(state.grid.bg);
}

function tracar(w, cell) {
  ctx.beginPath();
  ctx.moveTo(w.x1 * cell, w.y1 * cell);
  ctx.lineTo(w.x2 * cell, w.y2 * cell);
  ctx.stroke();
}

// ---------- camadas ----------
function desenharGrade(tl, br, cell) {
  if (bgImage && bgImage.complete && bgImage.naturalWidth) {
    const k = (state.grid.bgScale ?? 100) / 100;
    ctx.drawImage(bgImage, 0, 0, bgImage.naturalWidth * k, bgImage.naturalHeight * k);
  }
  const x0 = Math.floor(tl.x / cell) * cell;
  const y0 = Math.floor(tl.y / cell) * cell;
  ctx.beginPath();
  for (let x = x0; x <= br.x; x += cell) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
  for (let y = y0; y <= br.y; y += cell) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
  ctx.strokeStyle = "rgba(233,223,200,.16)";
  ctx.lineWidth = 1 / cam.zoom;
  ctx.stroke();

  ctx.fillStyle = "rgba(201,162,75,.5)";
  ctx.beginPath();
  ctx.arc(0, 0, 3 / cam.zoom, 0, Math.PI * 2);
  ctx.fill();
}

function desenharParedes(cell) {
  ctx.lineCap = "round";
  for (const w of state.walls) {
    if (w.door) {
      ctx.strokeStyle = w.open ? "#6fb5d9" : "#e08a3c";
      ctx.lineWidth = (w.open ? 3 : 6) / cam.zoom;
      ctx.setLineDash(w.open ? [7 / cam.zoom, 7 / cam.zoom] : []);
    } else {
      ctx.strokeStyle = "#e9dfc8";
      ctx.lineWidth = 4 / cam.zoom;
      ctx.setLineDash([]);
    }
    tracar(w, cell);
  }
  ctx.setLineDash([]);
}

function desenharCondicoes(t, px, py, d, cell, deslocamento) {
  if (!t.conditions?.length) return;
  const n = t.conditions.length;
  const tam = Math.min(Math.max(14, cell * 0.34), (d + cell * 0.6) / n);
  ctx.font = `${tam}px ${EMOJI_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,.9)";
  ctx.shadowBlur = 4;
  const total = tam * n;
  const x0 = px + d / 2 - total / 2 + tam / 2;
  const y = py - deslocamento - tam / 2 - 2;
  t.conditions.forEach((c, i) => {
    ctx.font = `${tam}px ${EMOJI_FONT}`;
    ctx.fillText(c.e, x0 + i * tam, y);
    if (c.d !== null) { // rodadas restantes
      ctx.font = `bold ${Math.max(9, tam * 0.5)}px Georgia, serif`;
      ctx.fillStyle = "#fff";
      ctx.fillText(String(c.d), x0 + i * tam + tam * 0.34, y + tam * 0.34);
    }
  });
  ctx.shadowBlur = 0;
}

function desenharTokens(cell) {
  const turno = state.initiative.active ? state.initiative.turn : null;

  for (const t of Object.values(state.tokens)) {
    const px = t.x * cell, py = t.y * cell, d = t.size * cell;
    const cx = px + d / 2, cy = py + d / 2, rad = d / 2 - 3;
    const sel = t.id === state.selected;

    if (t.id === turno) { // anel dourado no token da vez
      ctx.beginPath();
      ctx.arc(cx, cy, rad + 6 / cam.zoom, 0, Math.PI * 2);
      ctx.strokeStyle = "#f0d98a";
      ctx.lineWidth = 4 / cam.zoom;
      ctx.shadowColor = "#c9a24b";
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = t.color;
    ctx.fill();
    ctx.lineWidth = (sel ? 4 : 2) / cam.zoom;
    ctx.strokeStyle = sel ? "#c9a24b" : "rgba(0,0,0,.6)";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,.85)";
    ctx.shadowBlur = 3;
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(11, d * 0.28)}px Georgia, serif`;
    ctx.fillText(t.name, cx, cy, d - 8);

    const dono = t.owner && state.members[t.owner]?.name; // nome do dono sob o token
    if (dono) {
      ctx.fillStyle = "#e9dfc8";
      ctx.font = `${Math.max(10, cell * 0.22)}px Georgia, serif`;
      ctx.fillText(dono, cx, py + d + Math.max(8, cell * 0.14), d + cell);
    }
    ctx.shadowBlur = 0;

    // barra de PV: só para quem tem acesso à ficha (dono e mestre)
    let deslocamento = 0;
    const hp = state.sheets[t.id]?.hp;
    if (hp && hp.max > 0) {
      const bw = d - 8, bh = Math.max(4, cell * 0.09), bx = px + 4, by = py - bh - 3;
      const pct = Math.max(0, Math.min(1, hp.cur / hp.max));
      ctx.fillStyle = "rgba(0,0,0,.7)";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#e0a030" : "#d9503f";
      ctx.fillRect(bx, by, bw * pct, bh);
      if (hp.temp > 0) {
        ctx.fillStyle = "#6fb5d9";
        ctx.fillRect(bx, by - 2 / cam.zoom, bw * Math.min(1, hp.temp / hp.max), 2 / cam.zoom);
      }
      deslocamento = bh + 5;
    }
    desenharCondicoes(t, px, py, d, cell, deslocamento);
  }
}

function desenharPreviews(cell) {
  const drag = overlay.drag;
  if (!drag) return;
  if (drag.type === "token" && state.tokens[drag.id]) { // destino do encaixe
    const t = state.tokens[drag.id];
    ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
    ctx.strokeStyle = "#c9a24b";
    ctx.lineWidth = 2 / cam.zoom;
    ctx.strokeRect(Math.round(t.x) * cell, Math.round(t.y) * cell, t.size * cell, t.size * cell);
  } else if (drag.type === "wall") {
    ctx.strokeStyle = drag.door ? "#e08a3c" : "#e9dfc8";
    ctx.lineWidth = 4 / cam.zoom;
    ctx.setLineDash([8 / cam.zoom, 6 / cam.zoom]);
    tracar(drag, cell);
  } else if (drag.type === "rect") {
    ctx.strokeStyle = "#e9dfc8";
    ctx.lineWidth = 4 / cam.zoom;
    ctx.setLineDash([8 / cam.zoom, 6 / cam.zoom]);
    ctx.strokeRect(
      Math.min(drag.x1, drag.x2) * cell, Math.min(drag.y1, drag.y2) * cell,
      Math.abs(drag.x2 - drag.x1) * cell, Math.abs(drag.y2 - drag.y1) * cell
    );
  }
  ctx.setLineDash([]);
}

/** Área de magia (prévia ou recém-conjurada): preenchimento translúcido + contorno + anel nos atingidos. */
function desenharArea(a, cell, alpha) {
  const cura = a.effect === "heal";
  ctx.save();
  ctx.fillStyle = cura ? `rgba(76,175,80,${0.28 * alpha})` : `rgba(217,80,63,${0.28 * alpha})`;
  ctx.strokeStyle = cura ? `rgba(120,220,120,${alpha})` : `rgba(255,120,90,${alpha})`;
  ctx.lineWidth = 2.5 / cam.zoom;
  ctx.beginPath();
  const ox = a.ox * cell, oy = a.oy * cell, len = a.len * cell;
  if (a.shape === "sphere" || a.shape === "emanation") {
    ctx.arc(ox, oy, len, 0, Math.PI * 2);
  } else if (a.shape === "cube") {
    ctx.rect(ox - len / 2, oy - len / 2, len, len);
  } else if (a.shape === "cone") {
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, len, a.angle - a.half, a.angle + a.half);
    ctx.closePath();
  } else if (a.shape === "line") {
    ctx.translate(ox, oy);
    ctx.rotate(a.angle);
    ctx.rect(0, (-a.wid / 2) * cell, len, a.wid * cell);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = cura ? "#8fe08f" : "#ff8a6b";
  ctx.lineWidth = 3 / cam.zoom;
  for (const id of a.hit || []) {
    const t = state.tokens[id];
    if (!t) continue;
    ctx.beginPath();
    ctx.arc((t.x + t.size / 2) * cell, (t.y + t.size / 2) * cell, (t.size * cell) / 2 + 3 / cam.zoom, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function desenharAreasMagia(cell) {
  if (overlay.area) desenharArea(overlay.area, cell, 1);
  const f = overlay.flash;
  if (f) {
    const resta = f.ate - performance.now();
    if (resta <= 0) overlay.flash = null;
    else desenharArea(f.area, cell, Math.min(1, resta / 1200)); // some suavemente no fim
  }
}

/** Névoa em 3 camadas: iluminado agora (limpo), explorado (esmaecido), desconhecido (preto). */
function desenharNevoa(tl, br, cell) {
  if (!state.fog.enabled) return;
  const gm = isGm(); // o mestre vê translúcido para continuar enxergando o mapa
  const cx0 = Math.floor(tl.x / cell), cx1 = Math.ceil(br.x / cell);
  const cy0 = Math.floor(tl.y / cell), cy1 = Math.ceil(br.y / cell);
  const lit = celulasIluminadas();
  const dark = new Path2D();

  if ((cx1 - cx0) * (cy1 - cy0) > 40000) {
    // muito afastado: cobre tudo e abre "buracos" nas células visíveis (sem camada de explorado)
    dark.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    for (const k of new Set([...state.fog.revealed, ...lit])) {
      const [i, j] = k.split(",").map(Number);
      dark.rect(i * cell, j * cell, cell, cell);
    }
    ctx.fillStyle = gm ? "rgba(0,0,0,.55)" : "#000";
    ctx.fill(dark, "evenodd");
    return;
  }
  const dim = new Path2D();
  for (let y = cy0; y < cy1; y++) {
    for (let x = cx0; x < cx1; x++) {
      const k = cellKey(x, y);
      if (lit.has(k) || state.fog.revealed.has(k)) continue;
      (state.fog.explored.has(k) ? dim : dark).rect(x * cell - 0.5, y * cell - 0.5, cell + 1, cell + 1);
    }
  }
  ctx.fillStyle = gm ? "rgba(0,0,0,.55)" : "#000";
  ctx.fill(dark);
  ctx.fillStyle = gm ? "rgba(0,0,0,.22)" : "rgba(0,0,0,.62)";
  ctx.fill(dim);
}

export function draw() {
  if (!canvas || !connected()) return;
  const r = canvas.getBoundingClientRect();
  const cell = state.grid.size;
  ctx.clearRect(0, 0, r.width, r.height);

  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.zoom, cam.zoom);
  const tl = toWorld(0, 0);
  const br = toWorld(r.width, r.height);

  desenharGrade(tl, br, cell);
  desenharParedes(cell); // ficam sob a névoa: paredes não exploradas não aparecem para os jogadores
  desenharTokens(cell);
  desenharPreviews(cell);
  desenharAreasMagia(cell);
  desenharNevoa(tl, br, cell);
  ctx.restore();
}

on("draw", draw);
on("grid", carregarFundo);
on("state:reset", centralizar);
