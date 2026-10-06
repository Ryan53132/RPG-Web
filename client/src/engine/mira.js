// Mira do combate: escolher o alvo de um ataque, posicionar a área de uma magia e rolagens avulsas.
// Os números são sempre rolados no servidor; aqui só se escolhe alvo/área e se desenha a prévia.
import { notify, on, state } from "./state.js";
import { send } from "./net.js";
import { areaFixa, makeArea, tokenInArea } from "./areas.js";
import { isBlocking, rayHitsWall } from "./geometry.js";
import { overlay } from "./render.js";

// ---------- modo de rolagem (vantagem / penalidade) ----------
export function opcoesDeModo() {
  return state.system === "pf2e"
    ? [["0", "1º ataque"], ["-5", "2º ataque (-5)"], ["-10", "3º ataque (-10)"]]
    : [["0", "Normal"], ["1", "Vantagem"], ["-1", "Desvantagem"]];
}
export const modoDe = (valor) =>
  state.system === "pf2e"
    ? { advantage: 0, penalty: Number(valor) || 0 }
    : { advantage: Number(valor) || 0, penalty: 0 };

// ---------- texto do aviso de mira (o componente ModoBanner mostra) ----------
export function textoDoModo() {
  const m = state.mode;
  if (!m) return "";
  const nome = state.tokens[m.tokenId]?.name;
  if (m.type === "attack") return `${nome}: clique no alvo do ataque. Esc cancela.`;
  const como = areaFixa(m.spell.shape) ? "clique para posicionar" : "aponte a direção e clique";
  return `${nome}: ${como} "${m.spell.name || "magia"}". Esc cancela.`;
}

export function cancelar() {
  if (!state.mode) return false;
  state.mode = null;
  overlay.area = null;
  notify("mode");
  notify("draw");
  return true;
}

// ---------- ataque ----------
export function iniciarAtaque(tokenId, index, modo) {
  cancelar();
  state.mode = { type: "attack", tokenId, index, ...modo };
  notify("mode");
}

/** Clique no mapa durante o modo de ataque. */
function cliqueAtaque(token) {
  const m = state.mode;
  if (token && token.id !== m.tokenId) {
    send("combat:attack", { attackerId: m.tokenId, targetId: token.id, index: m.index, advantage: m.advantage, penalty: m.penalty });
  }
  cancelar(); // clicar no vazio (ou no próprio token) cancela
  return true;
}

// ---------- magia em área ----------
export function iniciarMagia(tokenId, index) {
  const spell = state.sheets[tokenId]?.spells?.[index];
  if (!spell) return;
  cancelar();
  state.mode = { type: "spell", tokenId, index, spell, area: null };
  notify("mode");
}

/** Calcula a área sob o cursor (coordenadas do mundo em pixels) e destaca quem seria atingido. */
export function previaMagia(wx, wy) {
  const m = state.mode;
  if (m?.type !== "spell") return;
  const caster = state.tokens[m.tokenId];
  if (!caster) { cancelar(); return; }
  const cell = state.grid.size;
  const px = wx / cell, py = wy / cell;
  const cx = caster.x + caster.size / 2, cy = caster.y + caster.size / 2;
  const fixa = areaFixa(m.spell.shape);
  const ox = fixa ? Math.round(px) : cx; // esfera e cubo encaixam nos cantos da grade
  const oy = fixa ? Math.round(py) : cy;
  const angulo = fixa ? 0 : Math.atan2(py - cy, px - cx);
  const area = makeArea(m.spell, state.system, ox, oy, angulo);

  const paredes = state.walls.filter(isBlocking);
  const hit = Object.values(state.tokens)
    .filter((t) => (fixa || t.id !== caster.id) && tokenInArea(area, t))
    .filter((t) => !paredes.some((w) => rayHitsWall(ox, oy, t.x + t.size / 2, t.y + t.size / 2, w)))
    .map((t) => t.id);

  m.area = area;
  overlay.area = { ...area, effect: m.spell.effect, hit };
  notify("draw");
}

function cliqueMagia(wx, wy) {
  const m = state.mode;
  previaMagia(wx, wy); // garante a área atual mesmo sem movimento do mouse (toque)
  const a = m.area;
  if (a) send("spell:cast", { tokenId: m.tokenId, index: m.index, x: a.ox, y: a.oy, angle: a.angle });
  cancelar();
  return true;
}

/** Chamado pelo input a cada clique. Devolve true se o modo de mira consumiu o clique. */
export function cliqueNoMapa(wx, wy, token) {
  if (!state.mode) return false;
  return state.mode.type === "attack" ? cliqueAtaque(token) : cliqueMagia(wx, wy);
}

// ---------- rolagens avulsas (sem alvo) ----------
export const rolarAvulso = (tokenId, index, kind, modo = {}) =>
  send("combat:roll", { tokenId, index, kind, ...modo });

/** Executa uma ação da ficha ("attack", "cast", "attack-free", "damage-free", "damage-crit"). */
export function executarAcao(tokenId, kind, index, modo) {
  if (kind === "attack") iniciarAtaque(tokenId, index, modoDe(modo)); // depois escolhe o alvo no mapa
  else if (kind === "cast") iniciarMagia(tokenId, index);
  else if (kind === "attack-free") rolarAvulso(tokenId, index, "attack", modoDe(modo));
  else if (kind === "damage-free") rolarAvulso(tokenId, index, "damage");
  else if (kind === "damage-crit") rolarAvulso(tokenId, index, "damage", { crit: true });
}

// área da magia fica visível por alguns segundos para todos
on("spell:area", ({ area, effect, hit }) => {
  overlay.flash = { area: { ...area, effect, hit }, ate: performance.now() + 4000 };
  notify("draw");
  setTimeout(() => notify("draw"), 4100);
});
