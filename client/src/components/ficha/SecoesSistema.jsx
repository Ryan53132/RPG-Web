// Seções que mudam conforme o sistema da sala (D&D 5e ou Pathfinder 2e).
import { ATTRS, RANKS } from "../../engine/rules.js";
import { Chk, Num, Saida, Sel, Txt } from "./Campos.jsx";

const postos = RANKS.map((r, i) => [i, r]);
const atributos = ATTRS.map(([k, l]) => [k, l]);

export function Origem({ system }) {
  return system === "pf2e" ? (
    <>
      <Txt path="sys.class" label="Classe" />
      <Txt path="sys.ancestry" label="Ancestralidade" />
      <Txt path="sys.heritage" label="Herança" />
      <Txt path="sys.background" label="Antecedente" />
    </>
  ) : (
    <>
      <Txt path="sys.class" label="Classe" />
      <Txt path="sys.species" label="Espécie" />
      <Txt path="sys.background" label="Antecedente" />
    </>
  );
}

export function SecaoDnd() {
  return (
    <>
      <fieldset><legend>Proficiência</legend>
        <p className="calc-linha">Bônus de proficiência <Saida chave="pb" /></p>
        <div className="grade2">
          {ATTRS.map(([k, l]) => (
            <Chk key={k} path={`sys.saveProf.${k}`} className="chk save">Resistência {l} <Saida chave={`save.${k}`} /></Chk>
          ))}
        </div>
      </fieldset>
      <fieldset><legend>Iniciativa e Percepção</legend>
        <div className="grade2">
          <Num path="sys.initiativeBonus" label="Bônus de iniciativa" min={-20} max={20} />
          <p className="calc-linha">Iniciativa (DES) <Saida chave="init" /></p>
        </div>
        <Chk path="sys.perceptionProf">Proficiente em Percepção</Chk>
        <p className="calc-linha">Percepção passiva <Saida chave="perc" /></p>
      </fieldset>
      <fieldset><legend>Recursos</legend>
        <div className="grade3">
          <Sel path="sys.hitDie" label="Dado de Vida" numerico opcoes={[6, 8, 10, 12].map((d) => [d, `d${d}`])} />
          <Num path="sys.hitDiceTotal" label="Total" min={0} max={20} />
          <Num path="sys.hitDiceUsed" label="Gastos" min={0} max={20} />
        </div>
        <Chk path="sys.inspiration">Inspiração</Chk>
        <div className="grade2">
          <Num path="sys.deathSuccess" label="Teste de Morte: sucessos" min={0} max={3} />
          <Num path="sys.deathFailure" label="Teste de Morte: falhas" min={0} max={3} />
        </div>
      </fieldset>
    </>
  );
}

export function SecaoPf2e() {
  return (
    <>
      <fieldset><legend>Proficiência (TEML + nível)</legend>
        <div className="grade2">
          <Sel path="sys.saves.fort" label="Fortitude (CON)" numerico opcoes={postos} /><p className="calc-linha">Total <Saida chave="save.fort" /></p>
          <Sel path="sys.saves.ref" label="Reflexos (DES)" numerico opcoes={postos} /><p className="calc-linha">Total <Saida chave="save.ref" /></p>
          <Sel path="sys.saves.will" label="Vontade (SAB)" numerico opcoes={postos} /><p className="calc-linha">Total <Saida chave="save.will" /></p>
        </div>
      </fieldset>
      <fieldset><legend>Percepção e Iniciativa</legend>
        <div className="grade2">
          <Sel path="sys.perception" label="Percepção (SAB)" numerico opcoes={postos} /><p className="calc-linha">Total <Saida chave="perc" /></p>
          <Num path="sys.initiativeBonus" label="Bônus de iniciativa" min={-20} max={20} /><p className="calc-linha">Iniciativa <Saida chave="init" /></p>
        </div>
      </fieldset>
      <fieldset><legend>Class DC</legend>
        <div className="grade3">
          <Sel path="sys.classDcRank" label="Proficiência" numerico opcoes={postos} />
          <Sel path="sys.classDcAttr" label="Atributo-chave" opcoes={atributos} />
          <p className="calc-linha">CD <Saida chave="classdc" /></p>
        </div>
      </fieldset>
      <fieldset><legend>Recursos</legend>
        <div className="grade3">
          <Num path="sys.heroPoints" label="Pontos de Herói" min={0} max={3} />
          <Num path="sys.focusCur" label="Foco atual" min={0} max={3} />
          <Num path="sys.focusMax" label="Foco máx." min={0} max={3} />
        </div>
      </fieldset>
    </>
  );
}
