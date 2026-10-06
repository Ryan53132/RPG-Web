// Salas em memória + persistência em arquivo JSON (uma por sala).
import fs from "fs";
import path from "path";
import { DEFAULT_PLAYER_VISION, ROOMS_DIR, UPLOADS_DIR } from "../config.js";
import { SYSTEMS, defaultSheet, normalizeSheet } from "../domain/rules.js";
import { cleanConditions } from "../domain/conditions.js";
import { newInitiative } from "../services/initiative.js";

export const rooms = new Map(); // salas carregadas
const saveTimers = new Map();
const roomFile = (id) => path.join(ROOMS_DIR, `${id}.json`);

export function ensureDirs() {
  fs.mkdirSync(ROOMS_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function serialize(room) {
  return {
    gmId: room.gmId,
    system: room.system,
    members: room.members,
    tokens: room.tokens,
    sheets: room.sheets,
    walls: room.walls,
    grid: room.grid,
    initiative: room.initiative,
    passwordHash: room.passwordHash || null,
    autoDamage: room.autoDamage,
    fog: {
      enabled: room.fog.enabled,
      revealed: [...room.fog.revealed],
      explored: [...room.fog.explored],
    },
  };
}

export function writeRoom(room) {
  clearTimeout(saveTimers.get(room.id));
  saveTimers.delete(room.id);
  const file = roomFile(room.id);
  const tmp = `${file}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(serialize(room)));
    fs.renameSync(tmp, file); // troca atômica: nunca deixa arquivo pela metade
  } catch (err) {
    console.error(`Falha ao salvar sala ${room.id}:`, err);
  }
}

export function scheduleSave(room) {
  clearTimeout(saveTimers.get(room.id));
  saveTimers.set(room.id, setTimeout(() => writeRoom(room), 400));
}

export function loadRoom(id) {
  if (rooms.has(id)) return rooms.get(id);
  const file = roomFile(id);
  if (!fs.existsSync(file)) return null;
  try {
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    const room = {
      id,
      gmId: d.gmId,
      system: SYSTEMS[d.system] ? d.system : "dnd5e",
      members: d.members || {},
      tokens: d.tokens || {},
      sheets: d.sheets || {},
      walls: d.walls || [],
      grid: { size: 50, bg: "", bgScale: 100, ...d.grid },
      initiative: { ...newInitiative(), ...d.initiative },
      passwordHash: d.passwordHash || null,
      autoDamage: d.autoDamage !== false,
      fog: {
        enabled: !!d.fog?.enabled,
        revealed: new Set(d.fog?.revealed || []),
        explored: new Set(d.fog?.explored || []),
      },
      online: new Map(), // socket.id -> playerId
      sent: new Map(), // socket.id -> ids dos tokens que esse cliente já recebeu
    };
    // migração de salas antigas
    for (const t of Object.values(room.tokens)) {
      if (t.vision === undefined) t.vision = t.owner ? DEFAULT_PLAYER_VISION : 0;
      t.conditions = cleanConditions(t.conditions); // converte emojis soltos em {e, d}
      room.sheets[t.id] = normalizeSheet(room.system, room.sheets[t.id] || defaultSheet(room.system));
    }
    room.initiative.entries = room.initiative.entries.filter((e) => room.tokens[e.tokenId]);
    rooms.set(id, room);
    return room;
  } catch (err) {
    console.error(`Sala ${id} corrompida, ignorando arquivo:`, err);
    return null;
  }
}

export function createRoom(id, gmId, system) {
  const room = {
    id,
    gmId,
    system,
    members: {},
    tokens: {},
    sheets: {},
    walls: [],
    grid: { size: 50, bg: "", bgScale: 100 },
    initiative: newInitiative(),
    passwordHash: null,
    autoDamage: true,
    fog: { enabled: false, revealed: new Set(), explored: new Set() },
    online: new Map(),
    sent: new Map(),
  };
  rooms.set(id, room);
  return room;
}

/** Salva e libera da memória (recarrega do disco quando alguém voltar). */
export function unloadRoom(room) {
  writeRoom(room);
  rooms.delete(room.id);
}

export function flushAll() {
  for (const room of rooms.values()) writeRoom(room);
}
