// Geometria de paredes e luz. Espelha server/src/vision.js: mesma fórmula nos dois lados.
import { cam, cellKey, state } from "./state.js";

export const toWorld = (sx, sy) => ({ x: (sx - cam.x) / cam.zoom, y: (sy - cam.y) / cam.zoom });

/** Canto da grade mais próximo do ponto do mundo. */
export const vertice = (w) => ({ x: Math.round(w.x / state.grid.size), y: Math.round(w.y / state.grid.size) });

const EPS = 1e-9;
export const isBlocking = (w) => !w.door || !w.open;

export function rayHitsWall(ax, ay, bx, by, w) {
  const rx = bx - ax, ry = by - ay;
  const sx = w.x2 - w.x1, sy = w.y2 - w.y1;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < EPS) return false;
  const qx = w.x1 - ax, qy = w.y1 - ay;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  return t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS;
}

function distSeg(px, py, w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const t = Math.max(0, Math.min(1, ((px - w.x1) * dx + (py - w.y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (w.x1 + t * dx), py - (w.y1 + t * dy));
}

/** Parede (ou só porta) mais próxima do ponto do mundo (wx, wy), dentro de uma tolerância. */
export function paredeProxima(wx, wy, soPortas = false) {
  const cell = state.grid.size;
  const px = wx / cell, py = wy / cell;
  let melhor = null;
  let dist = Math.max(0.35 / Math.max(1, cam.zoom), 0.2); // tolerância em casas
  for (const w of state.walls) {
    if (soPortas && !w.door) continue;
    const d = distSeg(px, py, w);
    if (d <= dist) { dist = d; melhor = w; }
  }
  return melhor;
}

// ---------- células iluminadas (com cache) ----------
let litCache = { sig: "", set: new Set() };

export function celulasIluminadas() {
  const fontes = Object.values(state.tokens).filter((t) => t.vision > 0);
  const sig = `${state.wallsVersion}|${fontes.map((t) => `${t.id}:${t.x.toFixed(2)}:${t.y.toFixed(2)}:${t.size}:${t.vision}`).join(",")}`;
  if (sig === litCache.sig) return litCache.set;

  const bloqueiam = state.walls.filter(isBlocking);
  const set = new Set();
  for (const t of fontes) {
    const R = t.vision + t.size / 2, cx = t.x + t.size / 2, cy = t.y + t.size / 2;
    const perto = bloqueiam.filter(
      (w) =>
        Math.max(w.x1, w.x2) >= cx - R && Math.min(w.x1, w.x2) <= cx + R &&
        Math.max(w.y1, w.y2) >= cy - R && Math.min(w.y1, w.y2) <= cy + R
    );
    for (let j = Math.floor(cy - R); j <= Math.ceil(cy + R); j++) {
      for (let i = Math.floor(cx - R); i <= Math.ceil(cx + R); i++) {
        const px = i + 0.5, py = j + 0.5;
        if ((px - cx) ** 2 + (py - cy) ** 2 > R * R) continue;
        if (perto.some((w) => rayHitsWall(cx, cy, px, py, w))) continue;
        set.add(cellKey(i, j));
      }
    }
  }
  litCache = { sig, set };
  return set;
}
