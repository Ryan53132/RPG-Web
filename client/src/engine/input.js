// Mouse/toque no mapa: mover tokens, câmera, zoom, paredes, portas e pincel da névoa.
// attachInput(canvas) liga tudo e devolve a função que desliga.
import { cam, cellKey, canControl, isGm, notify, selecionar, state } from "./state.js";
import { send } from "./net.js";
import { paredeProxima, toWorld, vertice } from "./geometry.js";
import { overlay } from "./render.js";
import { abrirFichaDe, fecharFicha } from "./ficha.js";
import { ferramentaAtual, tamanhoPincel } from "./tools.js";
import { cancelar, cliqueNoMapa, previaMagia } from "./mira.js";

let canvas = null;
let drag = null;
let lastEmit = 0;
let lastTap = null;

const redesenhar = () => notify("draw");
function setDrag(d) {
  drag = d;
  overlay.drag = d;
  state.dragging = d?.type === "token" ? d.id : null;
}

function tokenEm(wx, wy) {
  const cell = state.grid.size;
  return Object.values(state.tokens).reverse().find((t) => {
    const d = t.size * cell;
    return wx >= t.x * cell && wx <= t.x * cell + d && wy >= t.y * cell && wy <= t.y * cell + d;
  });
}

// ---------- névoa (pincel) ----------
function pintarCelula(cx, cy) {
  const n = tamanhoPincel();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = cx - Math.floor(n / 2) + i;
      const y = cy - Math.floor(n / 2) + j;
      const k = cellKey(x, y);
      if (drag.seen.has(k)) continue;
      drag.seen.add(k);
      if (drag.reveal) state.fog.revealed.add(k);
      else { state.fog.revealed.delete(k); state.fog.explored.delete(k); }
      drag.pending.push([x, y]);
    }
  }
}

function pintarAte(w) {
  const cell = state.grid.size;
  const cx = Math.floor(w.x / cell), cy = Math.floor(w.y / cell);
  if (drag.last) {
    const [lx, ly] = drag.last;
    const passos = Math.max(Math.abs(cx - lx), Math.abs(cy - ly));
    for (let i = 1; i <= passos; i++) {
      pintarCelula(Math.round(lx + ((cx - lx) * i) / passos), Math.round(ly + ((cy - ly) * i) / passos));
    }
  } else {
    pintarCelula(cx, cy);
  }
  drag.last = [cx, cy];
}

function enviarNevoa() {
  if (drag?.type === "fog" && drag.pending.length) {
    send("fog:paint", { cells: drag.pending, reveal: drag.reveal });
    drag.pending = [];
  }
}

function apagarEm(w) {
  const parede = paredeProxima(w.x, w.y);
  if (parede && !drag.erased.has(parede.id)) {
    drag.erased.add(parede.id);
    send("wall:remove", parede.id);
  }
}

// ---------- eventos ----------
function aoPressionar(e) {
  canvas.setPointerCapture(e.pointerId);
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const w = toWorld(sx, sy);
  const ferr = ferramentaAtual();

  // mirando um ataque ou uma magia: o clique escolhe o alvo/área em vez de mover tokens
  if (state.mode && e.button === 0) {
    cliqueNoMapa(w.x, w.y, tokenEm(w.x, w.y));
    return;
  }

  // ferramentas do mestre (barra sobre o mapa)
  if (isGm() && ferr !== "mover" && e.button === 0) {
    if (ferr === "revelar" || ferr === "esconder") {
      setDrag({ type: "fog", reveal: ferr === "revelar", seen: new Set(), pending: [], last: null });
      pintarAte(w);
      enviarNevoa();
    } else if (ferr === "parede" || ferr === "porta") {
      const v = vertice(w);
      setDrag({ type: "wall", door: ferr === "porta", x1: v.x, y1: v.y, x2: v.x, y2: v.y });
    } else if (ferr === "sala") {
      const v = vertice(w);
      setDrag({ type: "rect", x1: v.x, y1: v.y, x2: v.x, y2: v.y });
    } else if (ferr === "apagar") {
      setDrag({ type: "erase", erased: new Set() });
      apagarEm(w);
    }
    redesenhar();
    return;
  }

  const t = tokenEm(w.x, w.y);
  if (t && e.button === 0) {
    selecionar(t.id);
    if (canControl(t)) {
      const cell = state.grid.size;
      setDrag({ type: "token", id: t.id, offX: w.x - t.x * cell, offY: w.y - t.y * cell, sx, sy, moved: false });
    } else {
      setDrag({ type: "pan", sx, sy, camX: cam.x, camY: cam.y }); // token alheio: só seleciona
      canvas.classList.add("arrastando");
    }
  } else {
    const porta = isGm() && e.button === 0 ? paredeProxima(w.x, w.y, true) : null; // clique em porta abre/fecha
    if (porta) {
      send("wall:toggle", porta.id);
      return;
    }
    selecionar(null);
    setDrag({ type: "pan", sx, sy, camX: cam.x, camY: cam.y });
    canvas.classList.add("arrastando");
  }
  redesenhar();
}

function aoMover(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const w = toWorld(sx, sy);
  if (state.mode?.type === "spell") previaMagia(w.x, w.y); // área acompanha o cursor
  if (!drag) return;

  if (drag.type === "pan") {
    cam.x = drag.camX + (sx - drag.sx);
    cam.y = drag.camY + (sy - drag.sy);
  } else if (drag.type === "fog") {
    pintarAte(w);
    if (drag.pending.length > 300) enviarNevoa();
    else if (performance.now() - lastEmit > 80) { lastEmit = performance.now(); enviarNevoa(); }
  } else if (drag.type === "wall" || drag.type === "rect") {
    const v = vertice(w);
    drag.x2 = v.x;
    drag.y2 = v.y;
  } else if (drag.type === "erase") {
    apagarEm(w);
  } else if (drag.type === "token") {
    const cell = state.grid.size;
    const t = state.tokens[drag.id];
    if (!t) return;
    if (!drag.moved && Math.hypot(sx - drag.sx, sy - drag.sy) > 4) drag.moved = true;
    if (!drag.moved) return;
    t.x = (w.x - drag.offX) / cell;
    t.y = (w.y - drag.offY) / cell;
    if (performance.now() - lastEmit > 40) {
      lastEmit = performance.now();
      send("token:move", { id: t.id, x: t.x, y: t.y });
    }
  }
  redesenhar();
}

function soltar() {
  if (drag?.type === "token") {
    const t = state.tokens[drag.id];
    if (t && drag.moved) {
      t.x = Math.round(t.x); // encaixa na grade
      t.y = Math.round(t.y);
      send("token:move", { id: t.id, x: t.x, y: t.y });
      lastTap = null;
    } else if (t) {
      // toque sem arrastar: dois toques seguidos abrem a ficha (mouse e celular)
      const agora = Date.now();
      if (lastTap && lastTap.id === t.id && agora - lastTap.t < 400) {
        lastTap = null;
        abrirFichaDe(t.id);
      } else {
        lastTap = { id: t.id, t: agora };
      }
    }
  } else if (drag?.type === "fog") {
    enviarNevoa();
  } else if (drag?.type === "wall") {
    if (drag.x1 !== drag.x2 || drag.y1 !== drag.y2) {
      send("wall:add", { x1: drag.x1, y1: drag.y1, x2: drag.x2, y2: drag.y2, door: drag.door });
    }
  } else if (drag?.type === "rect") {
    const { x1, y1, x2, y2 } = drag;
    if (x1 !== x2 && y1 !== y2) {
      for (const [a, b, c, d] of [[x1, y1, x2, y1], [x2, y1, x2, y2], [x2, y2, x1, y2], [x1, y2, x1, y1]]) {
        send("wall:add", { x1: a, y1: b, x2: c, y2: d, door: false });
      }
    }
  }
  setDrag(null);
  canvas?.classList.remove("arrastando");
  redesenhar();
}

function aoMenuDeContexto(e) {
  if (cancelar()) e.preventDefault(); // botão direito também cancela a mira
}

function aoRolar(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const antes = toWorld(sx, sy);
  cam.zoom = Math.min(3, Math.max(0.25, cam.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  cam.x = sx - antes.x * cam.zoom;
  cam.y = sy - antes.y * cam.zoom;
  redesenhar();
}

function aoTeclar(e) {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if ((e.key === "Delete" || e.key === "Backspace") && canControl(state.tokens[state.selected])) {
    send("token:remove", state.selected);
  }
  if (e.key === "Escape" && !cancelar()) fecharFicha(); // Esc cancela a mira primeiro
}

/** Liga mouse/toque/teclado ao canvas. Devolve a função que desliga tudo. */
export function attachInput(el) {
  canvas = el;
  el.addEventListener("pointerdown", aoPressionar);
  el.addEventListener("pointermove", aoMover);
  el.addEventListener("pointerup", soltar);
  el.addEventListener("pointercancel", soltar);
  el.addEventListener("contextmenu", aoMenuDeContexto);
  el.addEventListener("wheel", aoRolar, { passive: false });
  window.addEventListener("keydown", aoTeclar);
  return () => {
    el.removeEventListener("pointerdown", aoPressionar);
    el.removeEventListener("pointermove", aoMover);
    el.removeEventListener("pointerup", soltar);
    el.removeEventListener("pointercancel", soltar);
    el.removeEventListener("contextmenu", aoMenuDeContexto);
    el.removeEventListener("wheel", aoRolar);
    window.removeEventListener("keydown", aoTeclar);
    if (canvas === el) canvas = null;
    setDrag(null);
  };
}
