// Ataques e magias em área cadastrados na ficha.
import { useState } from "react";
import { CampoEntrada, CampoSelecao } from "../Campo.jsx";
import { ATTRS } from "../../engine/rules.js";
import { executarAcao, opcoesDeModo } from "../../engine/mira.js";
import { useFicha } from "./contexto.js";

const FORMAS = [["sphere", "Esfera (raio)"], ["cube", "Cubo (lado)"], ["cone", "Cone"], ["line", "Linha"], ["emanation", "Emanação (raio)"]];
const NOVO = {
  attacks: { name: "", bonus: 0, damage: "", dtype: "" },
  spells: { name: "", shape: "sphere", size: 20, width: 5, effect: "damage", damage: "", dtype: "", save: "", dc: 0, onSave: "half", condEmoji: "", condRounds: 0 },
};

/** Edita um campo de um item da lista inteira (a lista é substituída por completo no servidor). */
function useLista(lista) {
  const { sheet, patch } = useFicha();
  const itens = sheet[lista] || [];
  return {
    itens,
    editar: (i, campo, valor) => patch({ [lista]: itens.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)) }),
    adicionar: () => patch({ [lista]: [...itens, { ...NOVO[lista] }] }),
    remover: (i) => patch({ [lista]: itens.filter((_, j) => j !== i) }),
  };
}

const Texto = ({ rotulo, valor, aoMudar, ...resto }) => (
  <label className="campo">{rotulo}<CampoEntrada value={valor} onCommit={aoMudar} {...resto} /></label>
);
const Numero = ({ rotulo, valor, aoMudar, ...resto }) => (
  <label className="campo">{rotulo}<CampoEntrada type="number" value={valor} onCommit={aoMudar} {...resto} /></label>
);
const Lista = ({ rotulo, valor, opcoes, aoMudar }) => (
  <label className="campo">{rotulo}<CampoSelecao value={valor} opcoes={opcoes} onCommit={aoMudar} /></label>
);

export function Ataques() {
  const { id } = useFicha();
  const { itens, editar, adicionar, remover } = useLista("attacks");
  const [modo, setModo] = useState("0");
  const opcoes = opcoesDeModo();
  const modoAtual = opcoes.some(([v]) => v === modo) ? modo : "0";

  return (
    <fieldset><legend>Ataques</legend>
      <label className="campo">Modo do ataque
        <CampoSelecao value={modoAtual} opcoes={opcoes} onCommit={setModo} />
      </label>
      <div className="itens">
        {itens.map((a, i) => (
          <div className="item" key={i}>
            <Texto rotulo="Nome" maxLength={30} valor={a.name} aoMudar={(v) => editar(i, "name", v)} />
            <div className="grade3">
              <Numero rotulo="Bônus" min={-20} max={40} valor={a.bonus} aoMudar={(v) => editar(i, "bonus", v)} />
              <Texto rotulo="Dano" maxLength={40} placeholder="1d8+3" valor={a.damage} aoMudar={(v) => editar(i, "damage", v)} />
              <Texto rotulo="Tipo" maxLength={20} valor={a.dtype} aoMudar={(v) => editar(i, "dtype", v)} />
            </div>
            <div className="acoes-linha">
              <button type="button" onClick={() => executarAcao(id, "attack", i, modoAtual)}>⚔ Atacar</button>
              <button type="button" className="sec" title="Rolar só o ataque, sem alvo" onClick={() => executarAcao(id, "attack-free", i, modoAtual)}>🎲 Ataque</button>
              <button type="button" className="sec" title="Rolar só o dano" onClick={() => executarAcao(id, "damage-free", i)}>💥 Dano</button>
              <button type="button" className="sec" title="Rolar o dano de um acerto crítico" onClick={() => executarAcao(id, "damage-crit", i)}>💥 Crít.</button>
              <button type="button" className="sec" aria-label="Remover ataque" onClick={() => remover(i)}>×</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="sec" onClick={adicionar}>+ Ataque</button>
    </fieldset>
  );
}

export function Magias() {
  const { id, system, calc } = useFicha();
  const { itens, editar, adicionar, remover } = useLista("spells");
  const pf = system === "pf2e";
  const testes = pf
    ? [["", "Sem teste"], ["fort", "Fortitude"], ["ref", "Reflexos"], ["will", "Vontade"]]
    : [["", "Sem teste"], ...ATTRS.map(([k, l]) => [k, l])];
  const aoPassar = [["half", pf ? "Básica (½ / dobro)" : "Metade se passar"], ["none", "Nada se passar"]];

  return (
    <fieldset><legend>Magias em área</legend>
      {!pf && <AtributoDeConjuracao />}
      <p className="calc-linha">CD padrão <output>{calc.spelldc}</output></p>
      <div className="itens">
        {itens.map((s, i) => (
          <div className="item" key={i}>
            <Texto rotulo="Nome" maxLength={30} valor={s.name} aoMudar={(v) => editar(i, "name", v)} />
            <div className="grade2">
              <Lista rotulo="Forma" valor={s.shape} opcoes={FORMAS} aoMudar={(v) => editar(i, "shape", v)} />
              <Numero rotulo="Tamanho (pés)" min={5} max={300} step={5} valor={s.size} aoMudar={(v) => editar(i, "size", v)} />
              <Numero rotulo="Largura da linha (pés)" min={5} max={60} step={5} valor={s.width} aoMudar={(v) => editar(i, "width", v)} />
              <Lista rotulo="Efeito" valor={s.effect} opcoes={[["damage", "Dano"], ["heal", "Cura"]]} aoMudar={(v) => editar(i, "effect", v)} />
              <Texto rotulo="Dano / cura" maxLength={40} placeholder="8d6" valor={s.damage} aoMudar={(v) => editar(i, "damage", v)} />
              <Texto rotulo="Tipo" maxLength={20} valor={s.dtype} aoMudar={(v) => editar(i, "dtype", v)} />
            </div>
            <div className="grade3">
              <Lista rotulo="Teste" valor={s.save} opcoes={testes} aoMudar={(v) => editar(i, "save", v)} />
              <Numero rotulo="CD (0 = padrão)" min={0} max={50} valor={s.dc} aoMudar={(v) => editar(i, "dc", v)} />
              <Lista rotulo="Se passar" valor={s.onSave} opcoes={aoPassar} aoMudar={(v) => editar(i, "onSave", v)} />
              <Texto rotulo="Condição" maxLength={16} placeholder="🔥" valor={s.condEmoji} aoMudar={(v) => editar(i, "condEmoji", v)} />
              <Numero rotulo="Rodadas" min={0} max={99} valor={s.condRounds} aoMudar={(v) => editar(i, "condRounds", v)} />
            </div>
            <div className="acoes-linha">
              <button type="button" onClick={() => executarAcao(id, "cast", i)}>✨ Conjurar</button>
              <button type="button" className="sec" aria-label="Remover magia" onClick={() => remover(i)}>×</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="sec" onClick={adicionar}>+ Magia</button>
    </fieldset>
  );
}

function AtributoDeConjuracao() {
  const { sheet, set } = useFicha();
  return (
    <label className="campo">Atributo de conjuração
      <CampoSelecao value={sheet.sys.spellAttr} opcoes={ATTRS.map(([k, l]) => [k, l])} onCommit={(v) => set("sys.spellAttr", v)} />
    </label>
  );
}
