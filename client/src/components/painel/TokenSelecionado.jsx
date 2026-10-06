// Card do token selecionado: nome, dono, visão, condições, ações de combate, ficha e iniciativa.
import { useState } from "react";
import { isGm, canControl, send, state } from "../../engine/index.js";
import { abrirFichaDe } from "../../engine/ficha.js";
import { executarAcao, opcoesDeModo } from "../../engine/mira.js";
import { CONDICOES, nomeDaCondicao } from "../../engine/conditions.js";
import { useEngine } from "../../hooks/useEngine.js";
import { CampoEntrada } from "../Campo.jsx";

const VISOES = [0, 2, 3, 4, 6, 8, 10, 12, 15, 20];
const FORMAS = { sphere: "esfera", cube: "cubo", cone: "cone", line: "linha", emanation: "emanação" };

function Condicoes({ token, pode }) {
  const [duracao, setDuracao] = useState("");
  const [livre, setLivre] = useState("");
  const ativas = new Set(token.conditions.map((c) => c.e));

  const rodadas = () => {
    const n = Math.trunc(Number(duracao));
    return n >= 1 ? Math.min(99, n) : null;
  };
  const definir = (lista) => send("token:update", { id: token.id, conditions: lista });

  function alternar(emoji) {
    definir(
      ativas.has(emoji)
        ? token.conditions.filter((c) => c.e !== emoji)
        : [...token.conditions, { e: emoji, d: rodadas() }]
    );
  }
  function adicionarLivre() {
    const emoji = livre.trim();
    if (!emoji) return;
    definir([...token.conditions.filter((c) => c.e !== emoji), { e: emoji, d: rodadas() }]);
    setLivre("");
  }

  return (
    <div className="space-y-2">
      <p className="rotulo text-xs font-bold text-amber-400 uppercase tracking-wider">Condições</p>
      <div className="cond-ativas flex flex-wrap gap-1.5 min-h-[1.5rem]">
        {token.conditions.map((c) => (
          <span key={c.e} className="chip-cond flex items-center gap-1.5 bg-amber-950/80 text-amber-200 border border-amber-800/80 rounded-full px-2 py-0.5 text-xs shadow-sm" title={nomeDaCondicao(c.e)}>
            {c.e}
            <b className="text-[10px] text-amber-300/80 font-normal">{c.d === null ? "sem fim" : `${c.d} ${c.d === 1 ? "rodada" : "rodadas"}`}</b>
            <button
              type="button"
              aria-label={`Remover ${nomeDaCondicao(c.e)}`}
              disabled={!pode}
              className="hover:text-red-400 font-bold ml-0.5 cursor-pointer"
              onClick={() => definir(token.conditions.filter((x) => x.e !== c.e))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <label className="campo-duracao block text-xs font-semibold text-amber-200/90 space-y-1">
        Duração em rodadas (vazio = sem fim)
        <input
          type="number"
          min="1"
          max="99"
          placeholder="Sem fim"
          disabled={!pode}
          value={duracao}
          onChange={(e) => setDuracao(e.target.value)}
          className="w-full bg-stone-950/90 text-amber-100 placeholder-amber-800/60 border border-amber-900/80 focus:border-amber-500 rounded px-2.5 py-1 text-xs font-sans outline-none"
        />
      </label>
      <div className="cond-paleta flex flex-wrap gap-1 p-2 bg-stone-950/80 rounded-lg border border-amber-950/80">
        {CONDICOES.map(([e, nome]) => (
          <button
            key={e}
            type="button"
            title={nome}
            aria-label={nome}
            aria-pressed={ativas.has(e)}
            disabled={!pode}
            onClick={() => alternar(e)}
            className={`p-1 rounded hover:bg-stone-800 text-base transition cursor-pointer ${
              ativas.has(e) ? "bg-amber-900/90 ring-1 ring-amber-500 shadow-inner" : ""
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="linha flex items-center gap-2">
        <input
          maxLength={16}
          placeholder="Outro emoji"
          aria-label="Outro emoji de condição"
          disabled={!pode}
          value={livre}
          onChange={(e) => setLivre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && adicionarLivre()}
          className="flex-1 bg-stone-950/90 text-amber-100 placeholder-amber-800/60 border border-amber-900/80 focus:border-amber-500 rounded px-2.5 py-1 text-xs font-sans outline-none"
        />
        <button className="sec peq px-2.5 py-1 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer" disabled={!pode} onClick={adicionarLivre}>
          Adicionar
        </button>
      </div>
    </div>
  );
}

function Acoes({ token }) {
  const [modo, setModo] = useState("0");
  const sheet = state.sheets[token.id];
  if (!sheet || (!sheet.attacks?.length && !sheet.spells?.length)) return null;
  const opcoes = opcoesDeModo();
  const modoAtual = opcoes.some(([v]) => v === modo) ? modo : "0";

  return (
    <div className="acoes space-y-2 bg-stone-950/60 p-2.5 rounded-lg border border-amber-950/80">
      <p className="rotulo text-xs font-bold text-amber-400 uppercase tracking-wider">Ações de combate</p>
      <label className="campo-duracao block text-xs font-semibold text-amber-200/90 space-y-1">
        Modo do ataque
        <select
          className="cheio w-full bg-stone-900 text-amber-100 border border-amber-900/80 rounded px-2 py-1 text-xs font-sans outline-none cursor-pointer"
          value={modoAtual}
          onChange={(e) => setModo(e.target.value)}
        >
          {opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <div className="acoes-botoes flex flex-col gap-1.5">
        {sheet.attacks.map((a, i) => (
          <button
            key={i}
            type="button"
            title="Clique e depois escolha o alvo no mapa"
            onClick={() => executarAcao(token.id, "attack", i, modoAtual)}
            className="w-full py-1.5 px-2 bg-stone-800 hover:bg-amber-950 text-amber-100 border border-amber-900/80 hover:border-amber-600 rounded text-xs font-medium text-left transition cursor-pointer shadow-sm truncate"
          >
            ⚔ {a.name || "Ataque"} {a.bonus >= 0 ? "+" : ""}{a.bonus}{a.damage ? ` · ${a.damage}` : ""}
          </button>
        ))}
      </div>
      <div className="acoes-botoes flex flex-col gap-1.5">
        {sheet.spells.map((s, i) => (
          <button
            key={i}
            type="button"
            title="Clique e depois posicione a área no mapa"
            onClick={() => executarAcao(token.id, "cast", i, modoAtual)}
            className="w-full py-1.5 px-2 bg-stone-800 hover:bg-amber-950 text-amber-100 border border-amber-900/80 hover:border-amber-600 rounded text-xs font-medium text-left transition cursor-pointer shadow-sm truncate"
          >
            ✨ {s.name || "Magia"} · {FORMAS[s.shape]} {s.size} pés
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TokenSelecionado() {
  useEngine("selection", "players", "token:upsert", "token:gone", "sheet", "sheets", "sheet:gone", "state:reset");
  const token = state.tokens[state.selected];
  if (!token) return null;

  const pode = canControl(token);
  const gm = isGm();
  const atualizar = (patch) => send("token:update", { id: token.id, ...patch });
  const visao = token.vision ?? 0;
  const visoes = VISOES.includes(visao) ? VISOES : [...VISOES, visao].sort((a, b) => a - b);
  const donoAtual = token.owner && state.members[token.owner] ? token.owner : "";

  return (
    <div className="cartao bg-stone-900/95 border-2 border-amber-950 ring-1 ring-amber-700/40 rounded-xl p-4 shadow-xl text-amber-100 font-serif space-y-3.5 mb-4">
      <h3 className="text-base font-bold text-amber-400 border-b border-amber-900/60 pb-1.5 uppercase tracking-wide">Token selecionado</h3>
      <CampoEntrada
        maxLength={20}
        aria-label="Nome do token"
        disabled={!pode}
        value={token.name}
        className="w-full text-sm font-semibold"
        onCommit={(name) => atualizar({ name })}
      />
      {gm && (
        <div className="opcoes-mestre grid grid-cols-2 gap-2 bg-stone-950/60 p-2 rounded-lg border border-amber-950/80 text-xs">
          <label className="flex flex-col gap-1 font-semibold text-amber-200/90">
            Dono do token
            <select
              className="cheio bg-stone-900 text-amber-100 border border-amber-900/80 rounded px-2 py-1 text-xs font-sans outline-none cursor-pointer"
              value={donoAtual}
              onChange={(e) => atualizar({ owner: e.target.value || null })}
            >
              <option value="">Mestre (NPC)</option>
              {Object.entries(state.members).map(([id, m]) => <option key={id} value={id}>{m.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-semibold text-amber-200/90">
            Visão (casas)
            <select
              className="cheio bg-stone-900 text-amber-100 border border-amber-900/80 rounded px-2 py-1 text-xs font-sans outline-none cursor-pointer"
              value={visao}
              onChange={(e) => atualizar({ vision: Number(e.target.value) })}
            >
              {visoes.map((v) => <option key={v} value={v}>{v === 0 ? "0 (sem visão)" : v}</option>)}
            </select>
          </label>
        </div>
      )}
      <Condicoes token={token} pode={pode} />
      {pode && <Acoes token={token} />}
      <div className="linha flex gap-2">
        <button
          className="w-full py-2 bg-amber-900/90 hover:bg-amber-800 text-amber-100 border border-amber-600 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!state.sheets[token.id]}
          onClick={() => abrirFichaDe(token.id)}
        >
          Abrir ficha
        </button>
        <button
          className="sec w-full py-2 bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded text-xs font-semibold transition cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!pode}
          onClick={() => send("init:add", { tokenIds: [token.id] })}
        >
          + Iniciativa
        </button>
      </div>
      <p className="nota text-xs text-amber-300/60 italic text-center">Dois cliques (ou dois toques) no token também abrem a ficha.</p>
      <button
        className="sec w-full py-1.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-900/60 rounded text-xs font-semibold transition cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!pode}
        onClick={() => send("token:remove", token.id)}
      >
        Remover token
      </button>
    </div>
  );
}