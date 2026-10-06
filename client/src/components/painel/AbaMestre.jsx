// Aba do mestre: senha da sala, mapa e grade, paredes e opções de combate.
import { useEffect, useState } from "react";
import { SERVER_URL, send, state } from "../../engine/index.js";
import { useEngine } from "../../hooks/useEngine.js";

const TEXTO_ENVIO = "Enviar imagem do mapa (até 10 MB)";

function CartaoSala() {
  const [senha, setSenha] = useState("");
  function definir() {
    if (senha.length < 4) return alert("Use uma senha com pelo menos 4 caracteres.");
    send("room:password", { password: senha });
    sessionStorage.setItem(`rpg-senha:${new URLSearchParams(location.search).get("sala")}`, senha);
    setSenha("");
  }
  return (
    <div className="cartao bg-stone-900/95 border-2 border-amber-950 ring-1 ring-amber-700/40 rounded-xl p-4 shadow-xl text-amber-100 font-serif space-y-3 mb-4">
      <h3 className="text-base font-bold text-amber-400 border-b border-amber-900/60 pb-1.5 uppercase tracking-wide">Sala</h3>
      <p className="nota text-xs text-amber-300/70 leading-relaxed italic">
        {state.locked
          ? "Sala protegida por senha. Quem já está dentro continua conectado ao trocar ou remover."
          : "Sala aberta: qualquer pessoa com o nome da sala entra."}
      </p>
      <div className="linha flex items-center gap-2">
        <input
          type="password"
          maxLength={64}
          autoComplete="new-password"
          placeholder="Nova senha (mín. 4)"
          aria-label="Nova senha da sala"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="flex-1 bg-stone-950/90 text-amber-100 placeholder-amber-800/60 border border-amber-900/80 focus:border-amber-500 rounded px-3 py-1.5 text-xs font-sans outline-none"
        />
        <button className="sec peq px-3 py-1.5 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer" onClick={definir}>
          Definir
        </button>
      </div>
      <button
        className="sec w-full py-1.5 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!state.locked}
        onClick={() => confirm("Deixar a sala aberta, sem senha?") && send("room:password", { password: "" })}
      >
        Remover senha
      </button>
    </div>
  );
}

function CartaoMapa() {
  const [form, setForm] = useState({ tam: 50, bg: "", escala: 100 });
  const [status, setStatus] = useState(TEXTO_ENVIO);

  useEffect(() => {
    setForm({ tam: state.grid.size, bg: state.grid.bg || "", escala: state.grid.bgScale ?? 100 });
  }, [state.grid]);

  const grade = (bg) => ({ size: Number(form.tam), bg: bg ?? form.bg.trim(), bgScale: Number(form.escala) });
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm((f) => ({ ...f, [nome]: e.target.value })) });

  async function enviarArquivo(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return alert("A imagem tem mais de 10 MB.");
    setStatus("Enviando...");
    try {
      const res = await fetch(
        `${SERVER_URL}/upload?room=${encodeURIComponent(state.room)}&player=${encodeURIComponent(state.you)}`,
        { method: "POST", headers: { "Content-Type": file.type }, body: file }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha no envio");
      setForm((f) => ({ ...f, bg: json.url }));
      send("grid:update", grade(json.url));
    } catch (err) {
      alert(err.message);
    } finally {
      setStatus(TEXTO_ENVIO);
    }
  }

  return (
    <div className="cartao bg-stone-900/95 border-2 border-amber-950 ring-1 ring-amber-700/40 rounded-xl p-4 shadow-xl text-amber-100 font-serif space-y-3 mb-4">
      <h3 className="text-base font-bold text-amber-400 border-b border-amber-900/60 pb-1.5 uppercase tracking-wide">Mapa</h3>
      <label className="arquivo block cursor-pointer bg-stone-950/80 hover:bg-stone-950 text-amber-200 border-2 border-dashed border-amber-900/80 hover:border-amber-600 rounded-lg p-3 text-center transition shadow-inner text-xs font-semibold">
        <span>{status}</span>
        <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" onChange={enviarArquivo} />
      </label>
      <label className="block text-xs font-semibold text-amber-200/90 space-y-1">
        ou URL da imagem
        <input placeholder="https://..." className="w-full bg-stone-950/90 text-amber-100 placeholder-amber-800/60 border border-amber-900/80 focus:border-amber-500 rounded px-3 py-1.5 text-xs font-sans outline-none" {...campo("bg")} />
      </label>
      <div className="linha flex gap-3">
        <label className="meio flex-1 text-xs font-semibold text-amber-200/90 flex flex-col gap-1">
          Casa (px) <input type="number" min="20" max="200" className="bg-stone-950/90 text-amber-100 border border-amber-900/80 focus:border-amber-500 rounded px-2.5 py-1 text-xs font-sans outline-none" {...campo("tam")} />
        </label>
        <label className="meio flex-1 text-xs font-semibold text-amber-200/90 flex flex-col gap-1">
          Escala (%) <input type="number" min="10" max="500" className="bg-stone-950/90 text-amber-100 border border-amber-900/80 focus:border-amber-500 rounded px-2.5 py-1 text-xs font-sans outline-none" {...campo("escala")} />
        </label>
      </div>
      <button className="sec w-full py-1.5 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer" onClick={() => send("grid:update", grade())}>
        Aplicar mapa e grade
      </button>
    </div>
  );
}

export default function AbaMestre() {
  useEngine("players", "grid", "state:reset");
  return (
    <>
      <CartaoSala />
      <CartaoMapa />
      <div className="cartao bg-stone-900/95 border-2 border-amber-950 ring-1 ring-amber-700/40 rounded-xl p-4 shadow-xl text-amber-100 font-serif space-y-3 mb-4">
        <h3 className="text-base font-bold text-amber-400 border-b border-amber-900/60 pb-1.5 uppercase tracking-wide">Paredes e névoa</h3>
        <p className="nota text-xs text-amber-300/70 leading-relaxed italic">
          As ferramentas (Parede, Porta, Sala, Apagar, Revelar, Esconder) e os botões de Névoa e Cobrir tudo ficam na barra sobre o mapa.
          Tokens com visão iluminam o entorno respeitando as paredes.
        </p>
        <button
          className="sec w-full py-1.5 text-xs font-serif font-semibold bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-900/60 rounded shadow transition cursor-pointer"
          onClick={() => confirm("Apagar todas as paredes e portas?") && send("wall:clear")}
        >
          Apagar todas as paredes
        </button>
      </div>
      <div className="cartao bg-stone-900/95 border-2 border-amber-950 ring-1 ring-amber-700/40 rounded-xl p-4 shadow-xl text-amber-100 font-serif space-y-3 mb-4">
        <h3 className="text-base font-bold text-amber-400 border-b border-amber-900/60 pb-1.5 uppercase tracking-wide">Combate</h3>
        <label className="chk flex items-center gap-2 text-xs font-semibold text-amber-200 cursor-pointer">
          <input
            type="checkbox"
            className="accent-amber-600 cursor-pointer"
            checked={state.autoDamage}
            onChange={(e) => send("combat:auto", { enabled: e.target.checked })}
          />{" "}
          Aplicar dano, cura e condições automaticamente
        </label>
        <p className="nota text-xs text-amber-300/70 leading-relaxed italic">
          Desligado, as rolagens aparecem no log mas nada muda nas fichas: você aplica à mão.
          A duração das condições diminui a cada nova rodada da iniciativa.
        </p>
      </div>
    </>
  );
}