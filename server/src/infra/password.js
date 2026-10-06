import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { MAX_FAILS, LOCK_MS } from "../config.js";

// ---- hash (scrypt + sal) ----
export function hashPassword(pw) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

export function verifyPassword(pw, stored) {
  const [saltHex, hashHex] = String(stored).split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pw, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

// ---- limite de tentativas por IP + sala ----
const attempts = new Map(); // "ip|sala" -> { fails, until }

export const clientIp = (socket) =>
  String(socket.handshake.headers["x-forwarded-for"] || socket.handshake.address).split(",")[0].trim();

export function lockedSeconds(key) {
  const a = attempts.get(key);
  return a && a.until > Date.now() ? Math.ceil((a.until - Date.now()) / 1000) : 0;
}

export function registerFail(key) {
  const a = attempts.get(key) || { fails: 0, until: 0 };
  a.fails += 1;
  if (a.fails >= MAX_FAILS) { a.fails = 0; a.until = Date.now() + LOCK_MS; }
  attempts.set(key, a);
}

export const clearFails = (key) => attempts.delete(key);

export function pruneAttempts() {
  const now = Date.now();
  for (const [key, a] of attempts) if (a.until < now && a.fails === 0) attempts.delete(key);
}
