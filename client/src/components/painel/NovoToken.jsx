// Criar tokens: pelo botão (centro da tela) ou arrastando a peça até o mapa.
import { useState } from "react";
import { getCanvas, isGm, send, state, toWorld } from "../../engine/index.js";
import { useEngine } from "../../hooks/useEngine.js";

export default function NovoToken() {
  useEngine("players");
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#c0392b");
  const [tam, setTam] = useState("1");
  const [dono, setDono] = useState("");
  const [visao, setVisao] = useState("auto");
  const gm = isGm();
  const donoValido = state.members[dono] ? dono : ""; // quem saiu da sala volta a "Mestre (NPC)"

  function criar(x, y, size = Number(tam)) {
    send("token:add", {
      name: nome.trim() || "Token",
      color: cor,
      size,
      x,
      y,
      owner: donoValido || null,
      vision: gm ? visao : undefined, // jogador não escolhe a própria visão
    });
    setNome("");
  }

  function noCentro() {
    const canvas = getCanvas();
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const c = toWorld(r.width / 2, r.height / 2);
    const cell = state.grid.size;
    criar(Math.round(c.x / cell), Math.round(c.y / cell));
  }

  // peça arrastável: solte sobre o mapa para criar o token naquele ponto
  function arrastarPeca(e) {
    e.preventDefault();
    const puck = e.currentTarget;
    puck.setPointerCapture(e.pointerId);
    const fantasma = document.createElement("div");
    fantasma.className = "puck ghost";
    fantasma.style.background = cor;
    fantasma.textContent = puck.textContent;
    document.body.appendChild(fantasma);

    const mover = (ev) => {
      fantasma.style.left = `${ev.clientX}px`;
      fantasma.style.top = `${ev.clientY}px`;
    };
    const terminar = (ev, soltou) => {
      puck.removeEventListener("pointermove", mover);
      puck.removeEventListener("pointerup", aoSoltar);
      puck.removeEventListener("pointercancel", aoCancelar);
      fantasma.remove();
      const canvas = getCanvas();
      if (!soltou || !canvas) return;
      const r = canvas.getBoundingClientRect();
      const dentro = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (!dentro) return;
      const w = toWorld(ev.clientX - r.left, ev.clientY - r.top);
      const cell = state.grid.size;
      const size = Number(tam);
      criar(Math.round(w.x / cell - size / 2), Math.round(w.y / cell - size / 2), size); // centraliza no cursor
    };
    const aoSoltar = (ev) => terminar(ev, true);
    const aoCancelar = (ev) => terminar(ev, false);
    puck.addEventListener("pointermove", mover);
    puck.addEventListener("pointerup", aoSoltar);
    puck.addEventListener("pointercancel", aoCancelar);
    mover(e);
  }

  return (
    <div className="cartao bg-stone-900/95 border-2 border-amber-950 ring-1 ring-amber-700/40 rounded-xl p-4 shadow-xl text-amber-100 font-serif space-y-3">
      <h3 className="text-base font-bold text-amber-400 border-b border-amber-900/60 pb-1.5 uppercase tracking-wide">Novo token</h3>
      <div className="linha flex items-center gap-2">
        <input
          placeholder="Nome"
          maxLength={20}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="flex-1 bg-stone-950/90 text-amber-100 placeholder-amber-800/60 border border-amber-900/80 focus:border-amber-500 rounded px-2.5 py-1.5 text-xs font-sans outline-none"
        />
        <input
          type="color"
          title="Cor"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          className="w-8 h-8 rounded border border-amber-900/80 bg-stone-950 cursor-pointer p-0.5"
        />
        <select
          title="Tamanho em casas"
          value={tam}
          onChange={(e) => setTam(e.target.value)}
          className="bg-stone-950/90 text-amber-100 border border-amber-900/80 focus:border-amber-500 rounded px-2 py-1.5 text-xs font-sans outline-none cursor-pointer"
        >
          <option value="1">1x1</option>
          <option value="2">2x2</option>
          <option value="3">3x3</option>
        </select>
      </div>
      {gm && (
        <div className="opcoes-mestre grid grid-cols-2 gap-2 bg-stone-950/60 p-2 rounded-lg border border-amber-950/80 text-xs">
          <label className="flex flex-col gap-1 font-semibold text-amber-200/90">
            Dono do token
            <select
              className="cheio bg-stone-900 text-amber-100 border border-amber-900/80 rounded px-2 py-1 text-xs font-sans outline-none cursor-pointer"
              value={donoValido}
              onChange={(e) => setDono(e.target.value)}
            >
              <option value="">Mestre (NPC)</option>
              {Object.entries(state.members).map(([id, m]) => <option key={id} value={id}>{m.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-semibold text-amber-200/90">
            Visão
            <select
              className="cheio bg-stone-900 text-amber-100 border border-amber-900/80 rounded px-2 py-1 text-xs font-sans outline-none cursor-pointer"
              value={visao}
              onChange={(e) => setVisao(e.target.value)}
            >
              <option value="auto">Automática (jogador 6, NPC 0)</option>
              <option value="0">Sem visão</option>
              <option value="3">3 casas</option>
              <option value="6">6 casas</option>
              <option value="9">9 casas</option>
              <option value="12">12 casas</option>
            </select>
          </label>
        </div>
      )}
      <div className="puck-linha flex items-center gap-3 bg-stone-950/40 p-2 rounded-lg border border-amber-950/40">
        <div
          className="puck w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md cursor-grab active:cursor-grabbing shrink-0 border border-white/20 select-none transition-transform hover:scale-105"
          title="Arraste até o mapa para colocar o token"
          style={{ background: cor }}
          onPointerDown={arrastarPeca}
        >
          {(nome.trim() || "T").slice(0, 2).toUpperCase()}
        </div>
        <span className="nota text-xs text-amber-300/70 italic leading-tight">Arraste a peça até o mapa, ou use o botão.</span>
      </div>
      <button
        className="sec w-full py-1.5 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer"
        onClick={noCentro}
      >
        Colocar no centro da tela
      </button>
    </div>
  );
}