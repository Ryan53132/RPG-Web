// Valores derivados da ficha (modificadores, resistências, CD). Espelha server/src/rules.js só para exibição:
// quem decide de verdade (ataques, magias, dano) é sempre o servidor.
export const ATTRS = [["for", "FOR"], ["des", "DES"], ["con", "CON"], ["int", "INT"], ["sab", "SAB"], ["car", "CAR"]];
export const RANKS = ["Destreinado", "Treinado", "Especialista", "Mestre", "Lenda"];

export const modificador = (v) => Math.floor(((Number(v) || 10) - 10) / 2);
export const comSinal = (n) => (n >= 0 ? `+${n}` : `${n}`);

/** Devolve um mapa chave -> texto com tudo o que a ficha mostra como "calculado". */
export function calcularFicha(system, sheet) {
  const lvl = sheet.level;
  const m = Object.fromEntries(ATTRS.map(([k]) => [k, modificador(sheet.attrs[k])]));
  const r = {};
  for (const [k] of ATTRS) r[`mod.${k}`] = comSinal(m[k]);

  const s = sheet.sys;
  if (system === "pf2e") {
    const prof = (rank) => (rank === 0 ? 0 : lvl + 2 * rank); // Destreinado não soma o nível
    r["save.fort"] = comSinal(m.con + prof(s.saves.fort));
    r["save.ref"] = comSinal(m.des + prof(s.saves.ref));
    r["save.will"] = comSinal(m.sab + prof(s.saves.will));
    const perc = m.sab + prof(s.perception);
    r.perc = comSinal(perc);
    r.init = comSinal(perc + s.initiativeBonus); // no PF2e a iniciativa costuma usar Percepção
    r.classdc = String(10 + m[s.classDcAttr] + prof(s.classDcRank));
    r.spelldc = r.classdc;
  } else {
    const pb = 2 + Math.floor((lvl - 1) / 4);
    r.pb = comSinal(pb);
    for (const [k] of ATTRS) r[`save.${k}`] = comSinal(m[k] + (s.saveProf[k] ? pb : 0));
    r.init = comSinal(m.des + s.initiativeBonus);
    r.perc = String(10 + m.sab + (s.perceptionProf ? pb : 0));
    r.spelldc = String(8 + pb + m[s.spellAttr]);
  }
  return r;
}
