// Aba Iniciativa: lista ordenada, rolagem e controle de turnos.
import { canControl, isGm, send, state } from "../../engine/index.js";
import { meusTokens, resumoDaIniciativa, tokenDoTurno } from "../../engine/iniciativa.js";
import { useEngine } from "../../hooks/useEngine.js";
import { CampoEntrada } from "../Campo.jsx";

function Linha({ entrada }) {
  const t = state.tokens[entrada.tokenId];
  if (!t) return null;
  const pode = canControl(t);
  const turno = state.initiative.active && state.initiative.turn === t.id;
  return (
    <li
      className={`ini-linha flex items-center gap-2 p-2 rounded-lg bg-stone-950/60 border border-amber-950/80 transition-all ${
        turno ? "turno bg-amber-950/60 border-amber-500 shadow-md ring-1 ring-amber-500/50" : ""
      }`}
    >
      <span className="seta text-amber-500 font-bold text-xs" aria-hidden="true">▶</span>
      <span className="ponto inline-block w-3 h-3 rounded-full border border-stone-800 shadow-sm shrink-0" style={{ background: t.color }} />
      <span className="nome truncate text-xs font-semibold text-amber-100 flex-1" title={t.name}>{t.name}</span>
      <span className="conds text-xs text-amber-300/80 flex items-center gap-1">
        {(t.conditions || []).map((c, i) => (
          <span key={c.e}>{i > 0 && " "}{c.e}{c.d !== null && <sub>{c.d}</sub>}</span>
        ))}
      </span>
      <CampoEntrada
        type="number"
        anulavel
        min={-99}
        max={999}
        placeholder="—"
        aria-label={`Iniciativa de ${t.name}`}
        disabled={!pode}
        value={entrada.value}
        className="w-14 text-center font-bold text-xs py-1"
        onCommit={(value) => send("init:set", { tokenId: t.id, value })}
      />
      <button
        title="Rolar 1d20 + modificador"
        aria-label={`Rolar iniciativa de ${t.name}`}
        disabled={!pode}
        className="px-2 py-1 bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => send("init:roll", { tokenIds: [t.id] })}
      >
        🎲
      </button>
      <button
        title="Tirar da iniciativa"
        aria-label={`Remover ${t.name}`}
        disabled={!pode}
        className="px-2 py-1 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-900/60 rounded text-xs transition cursor-pointer font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => send("init:remove", { tokenId: t.id })}
      >
        ×
      </button>
    </li>
  );
}

export default function AbaIniciativa() {
  useEngine("initiative", "players", "state:reset", "token:upsert", "token:gone");
  const ini = state.initiative;
  const gm = isGm();
  const t = tokenDoTurno();
  const minhaVez = !!t && t.owner === state.you;
  const pendentes = ini.entries
    .filter((e) => e.value === null && canControl(state.tokens[e.tokenId]))
    .map((e) => e.tokenId);

  return (
    <div className="cartao bg-stone-900/95 border-2 border-amber-950 ring-1 ring-amber-700/40 rounded-xl p-4 shadow-xl text-amber-100 font-serif space-y-3">
      <p className="ini-resumo text-xs font-semibold text-amber-300/90 bg-stone-950/80 p-2.5 rounded-lg border border-amber-950/80 text-center tracking-wide">
        {resumoDaIniciativa()}
      </p>
      <div className="ini-controles flex flex-wrap items-center gap-1.5 justify-center">
        {gm && ini.active && (
          <button
            className="sec peq px-2.5 py-1 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer"
            title="Voltar um turno"
            onClick={() => send("init:prev")}
          >
            ◀
          </button>
        )}
        {ini.active && (gm || minhaVez) && (
          <button
            className="peq px-2.5 py-1 text-xs font-serif font-bold bg-amber-900/80 hover:bg-amber-800 text-amber-100 border border-amber-600 rounded shadow transition cursor-pointer"
            title="Passar o turno"
            onClick={() => send("init:next")}
          >
            Próximo ▶
          </button>
        )}
        {gm && !ini.active && (
          <button
            className="peq px-2.5 py-1 text-xs font-serif font-bold bg-amber-900/80 hover:bg-amber-800 text-amber-100 border border-amber-600 rounded shadow transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={ini.entries.length === 0}
            onClick={() => send("init:start")}
          >
            Iniciar
          </button>
        )}
        {gm && ini.active && (
          <button
            className="sec peq px-2.5 py-1 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer"
            onClick={() => send("init:end")}
          >
            Encerrar
          </button>
        )}
      </div>
      <div className="ini-controles flex flex-wrap items-center gap-1.5 justify-center">
        {!gm && (
          <button
            className="sec peq px-2.5 py-1 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer"
            onClick={() => send("init:add", { tokenIds: meusTokens().map((x) => x.id) })}
          >
            + Meus tokens
          </button>
        )}
        {gm && (
          <button
            className="sec peq px-2.5 py-1 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer"
            onClick={() => send("init:add", { tokenIds: Object.keys(state.tokens) })}
          >
            + Todos
          </button>
        )}
        <button
          className="sec peq px-2.5 py-1 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={pendentes.length === 0}
          onClick={() => send("init:roll", { tokenIds: pendentes })}
        >
          🎲 Rolar pendentes
        </button>
        {gm && (
          <button
            className="sec peq px-2.5 py-1 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer"
            onClick={() => confirm("Limpar a lista de iniciativa?") && send("init:clear")}
          >
            Limpar lista
          </button>
        )}
      </div>
      <ol className="ini-lista space-y-1.5 max-h-80 overflow-y-auto pr-1" aria-label="Ordem de iniciativa">
        {ini.entries.map((e) => <Linha key={e.tokenId} entrada={e} />)}
      </ol>
      {ini.entries.length === 0 && (
        <p className="nota text-xs text-amber-300/60 italic text-center pt-2 border-t border-amber-900/40">
          Ninguém na iniciativa. Adicione tokens aqui ou pelo botão "+ Iniciativa" do token selecionado.
        </p>
      )}
    </div>
  );
}