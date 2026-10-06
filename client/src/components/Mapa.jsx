// O canvas do mapa e o que fica sobre ele (barra do mestre, faixa do turno, aviso de mira).
import { useEffect, useRef } from "react";
import { attachCanvas, attachInput, isGm, state } from "../engine/index.js";
import { resumoDaIniciativa, tokenDoTurno } from "../engine/iniciativa.js";
import { textoDoModo } from "../engine/mira.js";
import { alternarNevoa, cobrirTudo, definirFerramenta, definirPincel, tools } from "../engine/tools.js";
import { useEngine } from "../hooks/useEngine.js";

export default function Mapa() {
  const ref = useRef(null);

  useEffect(() => {
    const desligarCanvas = attachCanvas(ref.current);
    const desligarInput = attachInput(ref.current);
    return () => {
      desligarInput();
      desligarCanvas();
    };
  }, []);

  return (
    <div className="mapa-wrap font-serif select-none">
      {/* classes "arrastando" e "pincel" são aplicadas direto no elemento pelo engine */}
      <canvas id="mesa" ref={ref} />
      <FaixaDoTurno />
      <AvisoDeMira />
      <BarraDoMestre />
    </div>
  );
}

// ---------- faixa "Rodada / Turno" ----------
function FaixaDoTurno() {
  useEngine("initiative", "token:upsert", "token:gone", "players", "state:reset");
  const ini = state.initiative;
  if (!ini.active) return null;
  const t = tokenDoTurno();
  const minha = !!t && t.owner === state.you;
  return (
    <div
      className={`turno-banner ${
        minha
          ? "minha-vez bg-amber-900/90 text-amber-200 border-amber-500 shadow-amber-900/50"
          : "bg-stone-900/90 text-amber-100 border-amber-900/80"
      } w-fit border-2 rounded-xl px-4 py-2 font-serif text-sm font-semibold backdrop-blur-md shadow-2xl transition-all`}
      role="status"
    >
      {minha ? `É a sua vez, ${t.name}! (rodada ${ini.round})` : resumoDaIniciativa()}
    </div>
  );
}

// ---------- aviso do modo de mira ----------
function AvisoDeMira() {
  useEngine("mode", "token:upsert");
  if (!state.mode) return null;
  return (
    <div
      className="modo-banner w-fit bg-stone-900/90 text-amber-300 border-2 border-amber-700/80 rounded-lg px-3 py-1.5 font-serif text-xs font-semibold backdrop-blur-sm shadow-lg ring-1 ring-amber-500/30"
      role="status"
    >
      {textoDoModo()}
    </div>
  );
}

// ---------- barra do mestre ----------
const FERRAMENTAS = [
  [["mover", "✋ Mover", "Mover tokens e câmera. Clique numa porta para abrir ou fechar"],
   ["parede", "🧱 Parede", "Desenhar parede (arraste entre cantos da grade)"],
   ["porta", "🚪 Porta", "Desenhar porta"],
   ["sala", "⬜ Sala", "Desenhar uma sala retangular de paredes"],
   ["apagar", "🧽 Apagar", "Apagar paredes e portas (clique ou arraste sobre elas)"]],
  [["revelar", "👁 Revelar", "Pintar áreas reveladas"],
   ["esconder", "🌑 Esconder", "Pintar áreas escondidas"]],
];

function BarraDoMestre() {
  useEngine("players", "fog", "tool");
  if (!isGm()) return null;
  const atual = tools.atual;
  const pintando = atual === "revelar" || atual === "esconder";

  const botao = ([id, rotulo, dica]) => {
    const ativo = atual === id;
    return (
      <button
        key={id}
        aria-pressed={ativo}
        title={dica}
        onClick={() => definirFerramenta(id)}
        className={`px-2.5 py-1 rounded border text-xs font-serif font-semibold transition cursor-pointer ${
          ativo
            ? "bg-amber-800 text-amber-100 border-amber-500 shadow font-bold"
            : "bg-stone-800/90 text-amber-200 border-amber-900/70 hover:bg-stone-700 hover:text-amber-100"
        }`}
      >
        {rotulo}
      </button>
    );
  };

  return (
    <div
      className="barra-mestre w-fit inline-flex flex-wrap items-center gap-2 bg-stone-900/95 text-amber-100 border-2 border-amber-950 ring-1 ring-amber-700/40 rounded-2xl p-2 shadow-2xl backdrop-blur-md font-serif text-xs"
      role="toolbar"
      aria-label="Ferramentas do mestre"
    >
      <div className="grupo flex items-center gap-1.5 bg-stone-950/60 p-1 rounded-xl border border-amber-950/80">
        {FERRAMENTAS[0].map(botao)}
      </div>
      <div className="grupo flex items-center gap-1.5 bg-stone-950/60 p-1 rounded-xl border border-amber-950/80">
        {FERRAMENTAS[1].map(botao)}
        {pintando && (
          <label className="pincel flex items-center gap-1 text-xs font-semibold text-amber-300 px-2 py-0.5 bg-stone-900 rounded border border-amber-900/60">
            Pincel
            <select
              value={tools.pincel}
              onChange={(e) => definirPincel(e.target.value)}
              className="bg-stone-950 text-amber-100 border border-amber-900/80 rounded px-1 py-0.5 text-xs font-sans outline-none cursor-pointer ml-1"
            >
              {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}x{n}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="grupo flex items-center gap-1.5 bg-stone-950/60 p-1 rounded-xl border border-amber-950/80">
        <button
          aria-pressed={state.fog.enabled}
          onClick={alternarNevoa}
          title="Liga ou desliga a névoa de guerra (o que foi revelado é preservado)"
          className={`px-2.5 py-1 rounded border text-xs font-serif font-semibold transition cursor-pointer ${
            state.fog.enabled
              ? "bg-stone-800 text-amber-200 border-stone-600 hover:bg-stone-700"
              : "bg-amber-900/80 text-amber-100 border-amber-600 hover:bg-amber-800"
          }`}
        >
          {state.fog.enabled ? "☀ Tirar névoa" : "🌫 Pôr névoa"}
        </button>
        <button
          title="Esconde o mapa inteiro de novo"
          onClick={() => confirm("Esconder o mapa inteiro de novo?") && cobrirTudo()}
          className="px-2.5 py-1 rounded border border-red-900/80 bg-red-950/80 hover:bg-red-900 text-red-200 font-serif font-semibold text-xs transition cursor-pointer"
        >
          ⬛ Cobrir tudo
        </button>
      </div>
    </div>
  );
}