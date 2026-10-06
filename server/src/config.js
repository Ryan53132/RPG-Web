import path from "path";

export const PORT = Number(process.env.PORT) || 3001;
export const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
export const ROOMS_DIR = path.join(DATA_DIR, "rooms");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

// Limites
export const MAX_UPLOAD = 10 * 1024 * 1024; // 10 MB
export const MAX_TOKENS = 500;
export const MAX_WALLS = 3000;
export const MAX_CONDITIONS = 8;
export const MAX_INITIATIVE = 100;
export const MAX_EXPLORED = 200_000;
export const DEFAULT_PLAYER_VISION = 6;

// Senha: tentativas erradas antes do bloqueio
export const MAX_FAILS = 5;
export const LOCK_MS = 60_000;

// Limpeza de uploads órfãos
export const CLEANUP_HOURS = Number(process.env.CLEANUP_INTERVAL_HOURS ?? 6);
export const GRACE_MINUTES = Number(process.env.UPLOAD_GRACE_MINUTES ?? 60);
