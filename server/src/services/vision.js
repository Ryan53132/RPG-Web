// Paredes, linha de visão, exploração, envio filtrado de tokens e fichas.
// A mesma geometria roda no cliente (client/src/geometry.js).
import { MAX_EXPLORED } from "../config.js";
import { canControl, isGm } from "../domain/permissions.js";

const EPS = 1e-9;

/** Ganchos opcionais (evita import circular com a iniciativa). */
export const hooks = { transition: null }; // (io, room, sid, tokenId) quando um token entra/sai da visão de um cliente

export const isBlocking = (w) => !w.door || !w.open; // porta aberta não bloqueia
export const blockingWalls = (room) => room.walls.filter(isBlocking);
export const visionTokens = (room) => Object.values(room.tokens).filter((t) => t.vision > 0);

/** O raio a→b cruza a parede w? (colinear e toque exato na origem são ignorados) */
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

/** Fonte de luz: token com visão. "near" = só as paredes que podem afetar o raio dela. */
function makeSource(t, blocking) {
  const R = t.vision + t.size / 2;
  const cx = t.x + t.size / 2;
  const cy = t.y + t.size / 2;
  const near = blocking.filter(
    (w) =>
      Math.max(w.x1, w.x2) >= cx - R && Math.min(w.x1, w.x2) <= cx + R &&
      Math.max(w.y1, w.y2) >= cy - R && Math.min(w.y1, w.y2) <= cy + R
  );
  return { t, R, cx, cy, near };
}

function lights(src, i, j) {
  const px = i + 0.5, py = j + 0.5;
  const dx = px - src.cx, dy = py - src.cy;
  if (dx * dx + dy * dy > src.R * src.R) return false;
  return !src.near.some((w) => rayHitsWall(src.cx, src.cy, px, py, w));
}

export function visCtx(room) {
  const blocking = blockingWalls(room);
  return { srcs: visionTokens(room).map((t) => makeSource(t, blocking)), memo: new Map() };
}

export function cellVisible(room, ctx, i, j) {
  return room.fog.revealed.has(`${i},${j}`) || ctx.srcs.some((src) => lights(src, i, j));
}

export function canSee(room, pid, t, ctx) {
  if (isGm(room, pid) || !room.fog.enabled || t.owner === pid || t.vision > 0) return true;
  let v = ctx.memo.get(t.id);
  if (v === undefined) {
    v = cellVisible(room, ctx, Math.floor(t.x + t.size / 2), Math.floor(t.y + t.size / 2));
    ctx.memo.set(t.id, v);
  }
  return v;
}

export function tokensFor(room, pid) {
  const ctx = visCtx(room);
  return Object.fromEntries(Object.entries(room.tokens).filter(([, t]) => canSee(room, pid, t, ctx)));
}

// ---------- memória de exploração (compartilhada pela mesa) ----------
export function exploreCells(room, t, blocking = blockingWalls(room)) {
  if (!room.fog.enabled || !(t.vision > 0)) return [];
  const src = makeSource(t, blocking);
  const fresh = [];
  for (let j = Math.floor(src.cy - src.R); j <= Math.ceil(src.cy + src.R); j++) {
    for (let i = Math.floor(src.cx - src.R); i <= Math.ceil(src.cx + src.R); i++) {
      if (!lights(src, i, j)) continue;
      const key = `${i},${j}`;
      if (room.fog.explored.has(key) || room.fog.explored.size >= MAX_EXPLORED) continue;
      room.fog.explored.add(key);
      fresh.push([i, j]);
    }
  }
  return fresh;
}

export function exploreAndEmit(io, room, t) {
  const fresh = exploreCells(room, t);
  if (fresh.length) io.to(room.id).emit("fog:explored", { cells: fresh });
}

export function exploreAll(io, room) {
  const blocking = blockingWalls(room);
  for (const t of visionTokens(room)) {
    const fresh = exploreCells(room, t, blocking);
    if (fresh.length) io.to(room.id).emit("fog:explored", { cells: fresh });
  }
}

// ---------- envio filtrado de tokens (só emite quando algo muda) ----------
export function pushToken(io, room, token, exceptSid) {
  const ctx = visCtx(room);
  for (const [sid, pid] of room.online) {
    const sent = room.sent.get(sid);
    const had = sent.has(token.id);
    if (canSee(room, pid, token, ctx)) {
      if (sid !== exceptSid || !had) io.to(sid).emit("token:upsert", token);
      sent.add(token.id);
      if (!had) hooks.transition?.(io, room, sid, token.id);
    } else if (sent.delete(token.id)) {
      io.to(sid).emit("token:gone", token.id);
      hooks.transition?.(io, room, sid, token.id);
    }
  }
}

export function resyncVisibility(io, room) {
  const ctx = visCtx(room);
  for (const [sid, pid] of room.online) {
    const sent = room.sent.get(sid);
    for (const token of Object.values(room.tokens)) {
      const vis = canSee(room, pid, token, ctx);
      if (vis && !sent.has(token.id)) {
        sent.add(token.id);
        io.to(sid).emit("token:upsert", token);
        hooks.transition?.(io, room, sid, token.id);
      } else if (!vis && sent.delete(token.id)) {
        io.to(sid).emit("token:gone", token.id);
        hooks.transition?.(io, room, sid, token.id);
      }
    }
  }
}

// ---------- fichas: só dono e mestre recebem ----------
export function sheetsFor(room, pid) {
  return Object.fromEntries(
    Object.values(room.tokens)
      .filter((t) => canControl(room, pid, t) && room.sheets[t.id])
      .map((t) => [t.id, room.sheets[t.id]])
  );
}

export function syncSheet(io, room, token) {
  for (const [sid, pid] of room.online) {
    if (canControl(room, pid, token)) io.to(sid).emit("sheet", { id: token.id, sheet: room.sheets[token.id] });
    else io.to(sid).emit("sheet:gone", { id: token.id });
  }
}
