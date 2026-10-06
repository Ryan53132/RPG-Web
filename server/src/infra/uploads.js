// HTTP: upload/entrega de mapas, health check e limpeza de imagens órfãs.
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { CLEANUP_HOURS, GRACE_MINUTES, MAX_UPLOAD, ROOMS_DIR, UPLOADS_DIR } from "../config.js";
import { cleanRoomId, validPid } from "../lib/util.js";
import { loadRoom, rooms } from "./storage.js";
import { pruneAttempts } from "./password.js";

const EXT_BY_MIME = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const MIME_BY_EXT = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // necessário só no modo dev (portas diferentes)
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, body) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function handleUpload(req, res, url) {
  const room = loadRoom(cleanRoomId(url.searchParams.get("room")));
  const player = url.searchParams.get("player");
  const ext = EXT_BY_MIME[(req.headers["content-type"] || "").split(";")[0].trim()];

  if (!room || !validPid(player) || room.gmId !== player) {
    req.resume();
    return sendJson(res, 403, { error: "Apenas o mestre pode enviar mapas." });
  }
  if (!ext) {
    req.resume();
    return sendJson(res, 415, { error: "Use PNG, JPG, WEBP ou GIF." });
  }

  let size = 0;
  let aborted = false;
  const chunks = [];
  req.on("data", (chunk) => {
    if (aborted) return;
    size += chunk.length;
    if (size > MAX_UPLOAD) {
      aborted = true;
      sendJson(res, 413, { error: "Imagem maior que 10 MB." });
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    if (aborted) return;
    const name = `${randomUUID()}.${ext}`;
    fs.writeFile(path.join(UPLOADS_DIR, name), Buffer.concat(chunks), (err) => {
      if (err) return sendJson(res, 500, { error: "Falha ao salvar a imagem." });
      sendJson(res, 200, { url: `/uploads/${name}` });
    });
  });
}

function serveUpload(res, pathname) {
  const name = path.basename(pathname);
  const m = /^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.exec(name);
  if (!m) return sendJson(res, 404, { error: "Não encontrado" });
  const file = path.join(UPLOADS_DIR, name);
  fs.stat(file, (err, st) => {
    if (err) return sendJson(res, 404, { error: "Não encontrado" });
    cors(res);
    res.writeHead(200, {
      "Content-Type": MIME_BY_EXT[m[1]],
      "Content-Length": st.size,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    });
    fs.createReadStream(file).pipe(res);
  });
}

export function handleHttp(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    return res.end();
  }
  if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { ok: true });
  if (req.method === "POST" && url.pathname === "/upload") return handleUpload(req, res, url);
  if (req.method === "GET" && url.pathname.startsWith("/uploads/")) return serveUpload(res, url.pathname);
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Servidor da Mesa de RPG online.");
}

// ---------- limpeza: apaga imagens que nenhuma sala usa mais ----------
const UPLOAD_NAME_RE = /^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/;
const UPLOAD_REF_RE = /\/uploads\/([a-f0-9-]{36}\.(?:png|jpg|webp|gif))$/;

function referencedUploads() {
  const used = new Set();
  const add = (bg) => {
    const m = UPLOAD_REF_RE.exec(bg || "");
    if (m) used.add(m[1]);
  };
  for (const room of rooms.values()) add(room.grid.bg); // a memória pode estar à frente do disco
  for (const file of fs.readdirSync(ROOMS_DIR)) {
    if (!file.endsWith(".json")) continue;
    // arquivo de sala ilegível => lança erro e a limpeza é abortada (nunca apaga no escuro)
    add(JSON.parse(fs.readFileSync(path.join(ROOMS_DIR, file), "utf8")).grid?.bg);
  }
  return used;
}

export function cleanupUploads() {
  let used;
  try {
    used = referencedUploads();
  } catch (err) {
    console.error("Limpeza de uploads abortada:", err.message);
    return;
  }
  const now = Date.now();
  let removed = 0;
  let bytes = 0;
  for (const name of fs.readdirSync(UPLOADS_DIR)) {
    if (!UPLOAD_NAME_RE.test(name) || used.has(name)) continue;
    try {
      const file = path.join(UPLOADS_DIR, name);
      const st = fs.statSync(file);
      if (now - st.mtimeMs < GRACE_MINUTES * 60_000) continue; // tolerância para upload ainda não aplicado
      fs.unlinkSync(file);
      removed += 1;
      bytes += st.size;
    } catch { /* arquivo sumiu no meio do caminho */ }
  }
  pruneAttempts();
  if (removed) console.log(`Limpeza: ${removed} imagem(ns) removida(s), ${(bytes / 1048576).toFixed(1)} MB liberados.`);
}

export function startCleanup() {
  cleanupUploads();
  if (CLEANUP_HOURS > 0) setInterval(cleanupUploads, CLEANUP_HOURS * 3_600_000).unref();
}
