import { useState } from "react";

function valoresIniciais(inicial) {
  if (inicial) return { nome: inicial.nome, sala: inicial.sala, senha: inicial.senha, system: inicial.system };
  const sala = new URLSearchParams(location.search).get("sala") || "";
  return {
    nome: localStorage.getItem("rpg-nome") || "",
    sala,
    senha: sessionStorage.getItem(`rpg-senha:${sala}`) || "", // só dura enquanto a aba existir
    system: "dnd5e",
  };
}

export default function Entrada({ inicial, erro, onEntrar }) {
  const [form, setForm] = useState(() => valoresIniciais(inicial));
  const campo = (nome) => ({
    value: form[nome],
    onChange: (e) => setForm((f) => ({ ...f, [nome]: e.target.value })),
    onKeyDown: (e) => e.key === "Enter" && onEntrar(form),
  });

  return (
    <div className="entrada bg-stone-950 font-serif">
      <div className="entrada-box bg-stone-900/95 border-4 border-amber-950 ring-2 ring-amber-700/50 rounded-2xl p-6 md:p-8 shadow-2xl text-amber-100 space-y-4">
        <h1 className="text-2xl font-extrabold text-amber-400 uppercase tracking-wider text-center border-b-2 border-amber-900/60 pb-3">
          Mesa de RPG
        </h1>

        <label className="text-sm font-semibold text-amber-200/90 flex flex-col gap-1">
          Seu nome
          <input
            maxLength={20}
            placeholder="Ex.: Aragorn"
            className="bg-stone-950/90 text-amber-100 placeholder-amber-800/60 border-2 border-amber-900/70 focus:border-amber-500 rounded px-3 py-2 shadow-inner outline-none font-sans text-sm"
            {...campo("nome")}
          />
        </label>

        <label className="text-sm font-semibold text-amber-200/90 flex flex-col gap-1">
          Sala
          <input
            maxLength={30}
            placeholder="Ex.: taverna"
            className="bg-stone-950/90 text-amber-100 placeholder-amber-800/60 border-2 border-amber-900/70 focus:border-amber-500 rounded px-3 py-2 shadow-inner outline-none font-sans text-sm"
            {...campo("sala")}
          />
        </label>

        <label className="text-sm font-semibold text-amber-200/90 flex flex-col gap-1">
          Senha da sala
          <input
            type="password"
            maxLength={64}
            autoComplete="off"
            placeholder="Opcional ao criar a sala"
            autoFocus={!!erro}
            className="bg-stone-950/90 text-amber-100 placeholder-amber-800/60 border-2 border-amber-900/70 focus:border-amber-500 rounded px-3 py-2 shadow-inner outline-none font-sans text-sm"
            {...campo("senha")}
          />
        </label>

        <label className="text-sm font-semibold text-amber-200/90 flex flex-col gap-1">
          Sistema de jogo (vale só ao criar a sala)
          <select
            className="cheio bg-stone-950/90 text-amber-100 border-2 border-amber-900/70 focus:border-amber-500 rounded px-3 py-2 shadow-inner outline-none font-sans text-sm cursor-pointer"
            value={form.system}
            onChange={(e) => setForm((f) => ({ ...f, system: e.target.value }))}
          >
            <option value="dnd5e" className="bg-stone-900 text-amber-100">D&amp;D 5e</option>
            <option value="pf2e" className="bg-stone-900 text-amber-100">Pathfinder 2e</option>
          </select>
        </label>

        {erro && <p className="erro text-red-400 text-xs font-semibold text-center" role="alert">{erro}</p>}

        <button
          onClick={() => onEntrar(form)}
          className="w-full bg-gradient-to-b from-amber-800 via-amber-900 to-amber-950 hover:from-amber-700 hover:to-amber-900 text-amber-100 font-bold uppercase tracking-wider rounded border-2 border-amber-600/80 shadow-md cursor-pointer transition py-2.5 text-sm"
        >
          Entrar na mesa
        </button>

        <p className="dica text-xs text-amber-300/60 italic leading-relaxed text-center border-t border-amber-900/40 pt-3">
          Quem cria a sala vira o mestre; a senha e o sistema escolhidos passam a valer para ela. Em sala que já existe,
          use a senha combinada e o sistema dela é mantido.
        </p>
      </div>
    </div>
  );
}