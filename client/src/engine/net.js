// Conexão Socket.IO: recebe os eventos do servidor, atualiza o estado e avisa a interface.
import { io } from "socket.io-client";
import { cellKey, notify, playerId, state } from "./state.js";

// Em produção (Docker) o nginx serve tudo na mesma origem; em dev o servidor fica na porta 3001.
export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? `http://${location.hostname}:3001` : location.origin);
export const assetUrl = (u) => (u && u.startsWith("/") ? SERVER_URL + u : u);

let socket = null;
export const connected = () => !!socket;
export const send = (evt, data) => socket?.emit(evt, data);

export function disconnect() {
  socket?.disconnect();
  socket = null;
}

export function connect({ sala, nome, senha, system }) {
  disconnect();
  socket = io(SERVER_URL);
  // "connect" também dispara em reconexões: reenvia a senha e o servidor devolve o estado atual.
  socket.on("connect", () => socket.emit("join", { room: sala, name: nome, playerId, password: senha, system }));
  bind(socket);
}

function setPlayers({ gmId, locked, autoDamage, online, members }) {
  Object.assign(state, { gmId, locked, autoDamage, online, members });
}

function bind(s) {
  s.on("join:error", ({ message }) => {
    disconnect();
    notify("join:error", message);
  });

  s.on("state", (d) => {
    state.selected = null;
    Object.assign(state, {
      room: d.room, you: d.you ?? playerId, system: d.system, alignments: d.alignments, tokens: d.tokens, sheets: d.sheets,
      walls: d.walls, grid: d.grid, initiative: d.initiative,
      fog: { enabled: d.fog.enabled, revealed: new Set(d.fog.revealed), explored: new Set(d.fog.explored) },
    });
    state.wallsVersion++;
    setPlayers(d.players);
    notify("state:reset");
    notify("players");
    notify("grid");
    notify("fog");
    notify("initiative");
    notify("selection");
    notify("draw");
  });
  s.on("players", (p) => { setPlayers(p); notify("players"); });

  // ----- tokens e fichas -----
  s.on("token:upsert", (t) => {
    if (state.dragging !== t.id) state.tokens[t.id] = t; // não atropela o token que estou arrastando
    notify("token:upsert", t);
    notify("draw");
  });
  s.on("token:gone", (id) => {
    delete state.tokens[id];
    if (state.selected === id) state.selected = null;
    notify("token:gone", id);
    notify("selection");
    notify("draw");
  });
  s.on("sheet", ({ id, sheet }) => {
    state.sheets[id] = sheet;
    notify("sheet", id);
    notify("draw");
  });
  s.on("sheet:gone", ({ id }) => {
    delete state.sheets[id];
    notify("sheet:gone", id);
    notify("draw");
  });
  s.on("sheets", ({ sheets }) => {
    state.sheets = sheets;
    notify("sheets");
    notify("draw");
  });

  // ----- paredes -----
  const paredes = () => { state.wallsVersion++; notify("draw"); };
  s.on("wall:added", (w) => { state.walls.push(w); paredes(); });
  s.on("wall:removed", (id) => { state.walls = state.walls.filter((w) => w.id !== id); paredes(); });
  s.on("wall:updated", (w) => {
    const i = state.walls.findIndex((x) => x.id === w.id);
    if (i >= 0) state.walls[i] = w;
    paredes();
  });
  s.on("walls", (list) => { state.walls = list; paredes(); });

  // ----- mapa e névoa -----
  s.on("grid:updated", (g) => { state.grid = g; notify("grid"); notify("draw"); });
  s.on("fog", (f) => {
    state.fog = { enabled: f.enabled, revealed: new Set(f.revealed), explored: new Set(f.explored) };
    notify("fog");
    notify("draw");
  });
  s.on("fog:delta", ({ cells, reveal }) => {
    for (const [x, y] of cells) {
      const k = cellKey(x, y);
      if (reveal) state.fog.revealed.add(k);
      else { state.fog.revealed.delete(k); state.fog.explored.delete(k); }
    }
    notify("draw");
  });
  s.on("fog:explored", ({ cells }) => {
    for (const [x, y] of cells) state.fog.explored.add(cellKey(x, y));
    notify("draw");
  });

  // ----- iniciativa, chat e dados -----
  s.on("initiative", (v) => { state.initiative = v; notify("initiative"); notify("draw"); });
  s.on("combat:log", (m) => notify("combat:log", m));
  s.on("spell:area", (a) => notify("spell:area", a));
  s.on("chat", (m) => notify("chat", m));
  s.on("roll", (r) => notify("roll", r));
}

