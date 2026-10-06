// Estado compartilhado, constantes, helpers e um barramento de eventos simples.
// O engine (canvas, rede, regras) não conhece o React: os componentes escutam estes eventos
// pelo hook useEngine e leem `state` na hora de renderizar.

export const SISTEMAS = { dnd5e: "D&D 5e", pf2e: "Pathfinder 2e" };

export const state = {
  room: "",
  system: "dnd5e",
  alignments: [],
  you: null,
  gmId: null,
  locked: false,
  autoDamage: true,
  members: {},
  online: [],
  tokens: {},
  sheets: {}, // só as fichas dos tokens que eu controlo
  walls: [],
  grid: { size: 50, bg: "", bgScale: 100 },
  fog: { enabled: false, revealed: new Set(), explored: new Set() },
  initiative: { active: false, round: 1, turn: null, turnHidden: false, entries: [] },
  selected: null,
  fichaId: null, // token cuja ficha está aberta
  dragging: null, // id do token que o usuário está arrastando agora
  mode: null, // modo de mira: { type: "attack"|"spell", tokenId, index, ... } enquanto escolhe alvo/área
  wallsVersion: 0, // invalida o cache de luz quando as paredes mudam
};

export const cam = { x: 0, y: 0, zoom: 1 };

export const isGm = () => state.you === state.gmId;
export const canControl = (t) => !!t && (isGm() || t.owner === state.you);
export const cellKey = (x, y) => `${x},${y}`;

// ---------- barramento de eventos ----------
const listeners = new Map();
/** Registra um ouvinte e devolve a função que o remove. */
export const on = (evt, fn) => {
  if (!listeners.has(evt)) listeners.set(evt, []);
  listeners.get(evt).push(fn);
  return () => listeners.set(evt, (listeners.get(evt) || []).filter((f) => f !== fn));
};
export const notify = (evt, payload) => (listeners.get(evt) || []).forEach((fn) => fn(payload));

/** Seleciona um token (ou nenhum) e avisa a interface. */
export function selecionar(id) {
  state.selected = id;
  notify("selection");
  notify("draw");
}

// ---------- identidade do jogador (fica salva no navegador) ----------
function uid() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const playerId = (() => {
  let id = localStorage.getItem("rpg-pid");
  if (!id) {
    id = uid();
    localStorage.setItem("rpg-pid", id);
  }
  return id;
})();
