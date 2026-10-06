// Sistemas de RPG e fichas. O núcleo é comum; o que diverge fica em sheet.sys.
import { cleanStr, isPlain } from "../lib/util.js";
import { SHAPES } from "./areas.js";
import { validExpr } from "./dice.js";
import { cleanConditions } from "./conditions.js";

export const PF2E_SAVES = ["fort", "ref", "will"];
export const SYSTEMS = { dnd5e: "D&D 5e", pf2e: "Pathfinder 2e" };
export const ATTRS = ["for", "des", "con", "int", "sab", "car"];
export const ALIGNMENTS = [
  "Leal e Bom", "Neutro e Bom", "Caótico e Bom",
  "Leal e Neutro", "Neutro", "Caótico e Neutro",
  "Leal e Mau", "Neutro e Mau", "Caótico e Mau",
];

const attrMap = (v) => Object.fromEntries(ATTRS.map((k) => [k, v]));

export function defaultSheet(system) {
  const sys = system === "pf2e"
    ? {
        class: "", ancestry: "", heritage: "", background: "",
        saves: { fort: 1, ref: 1, will: 1 }, // posto TEML: 0 Destreinado ... 4 Lenda
        perception: 1,
        initiativeBonus: 0,
        classDcRank: 1, classDcAttr: "for",
        heroPoints: 1, focusMax: 0, focusCur: 0,
      }
    : {
        class: "", species: "", background: "",
        spellAttr: "int",
        saveProf: attrMap(false), perceptionProf: false,
        initiativeBonus: 0,
        hitDie: 8, hitDiceTotal: 1, hitDiceUsed: 0,
        inspiration: false, deathSuccess: 0, deathFailure: 0,
      };
  return {
    level: 1,
    alignment: "",
    attrs: attrMap(10),
    hp: { max: 10, cur: 10, temp: 0 },
    ac: 10,
    speed: system === "pf2e" ? 25 : 30,
    attacks: [],
    spells: [],
    sys,
    notes: "",
  };
}

/** Reconstrói a ficha só com campos conhecidos, tipos e limites válidos. */
export function normalizeSheet(system, input) {
  const d = defaultSheet(system);
  const s = isPlain(input) ? input : {};
  const num = (v, min, max, def) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const str = (v, max = 30) => cleanStr(v, max);
  const bool = (v) => v === true;
  const sy = isPlain(s.sys) ? s.sys : {};

  const hpMax = num(s.hp?.max, 0, 9999, d.hp.max);
  const out = {
    level: num(s.level, 1, 20, 1),
    alignment: ALIGNMENTS.includes(s.alignment) ? s.alignment : "",
    attrs: Object.fromEntries(ATTRS.map((k) => [k, num(s.attrs?.[k], 1, 30, 10)])),
    hp: { max: hpMax, cur: num(s.hp?.cur, 0, hpMax, hpMax), temp: num(s.hp?.temp, 0, 999, 0) },
    ac: num(s.ac, 0, 99, d.ac),
    speed: num(s.speed, 0, 999, d.speed),
    notes: str(s.notes, 2000),
    attacks: (Array.isArray(s.attacks) ? s.attacks : []).slice(0, 12).map((a) => ({
      name: str(a?.name),
      bonus: num(a?.bonus, -20, 40, 0),
      damage: validExpr(a?.damage) ? str(a.damage, 40) : "",
      dtype: str(a?.dtype, 20),
    })),
    spells: (Array.isArray(s.spells) ? s.spells : []).slice(0, 20).map((sp) => ({
      name: str(sp?.name),
      shape: SHAPES.includes(sp?.shape) ? sp.shape : "sphere",
      size: num(sp?.size, 5, 300, 20),
      width: num(sp?.width, 5, 60, 5),
      effect: sp?.effect === "heal" ? "heal" : "damage",
      damage: validExpr(sp?.damage) ? str(sp.damage, 40) : "",
      dtype: str(sp?.dtype, 20),
      save: (system === "pf2e" ? PF2E_SAVES : ATTRS).includes(sp?.save) ? sp.save : "",
      dc: num(sp?.dc, 0, 50, 0), // 0 = usar a CD padrão da ficha
      onSave: sp?.onSave === "none" ? "none" : "half",
      condEmoji: cleanConditions([sp?.condEmoji])[0]?.e ?? "",
      condRounds: num(sp?.condRounds, 0, 99, 0), // 0 = sem duração definida
    })),
  };

  if (system === "pf2e") {
    const focusMax = num(sy.focusMax, 0, 3, 0);
    out.sys = {
      class: str(sy.class), ancestry: str(sy.ancestry), heritage: str(sy.heritage), background: str(sy.background),
      saves: {
        fort: num(sy.saves?.fort, 0, 4, 1),
        ref: num(sy.saves?.ref, 0, 4, 1),
        will: num(sy.saves?.will, 0, 4, 1),
      },
      perception: num(sy.perception, 0, 4, 1),
      initiativeBonus: num(sy.initiativeBonus, -20, 20, 0),
      classDcRank: num(sy.classDcRank, 0, 4, 1),
      classDcAttr: ATTRS.includes(sy.classDcAttr) ? sy.classDcAttr : "for",
      heroPoints: num(sy.heroPoints, 0, 3, 1),
      focusMax,
      focusCur: num(sy.focusCur, 0, focusMax, 0),
    };
  } else {
    const hitDiceTotal = num(sy.hitDiceTotal, 0, 20, 1);
    out.sys = {
      class: str(sy.class), species: str(sy.species), background: str(sy.background),
      spellAttr: ATTRS.includes(sy.spellAttr) ? sy.spellAttr : "int",
      saveProf: Object.fromEntries(ATTRS.map((k) => [k, bool(sy.saveProf?.[k])])),
      perceptionProf: bool(sy.perceptionProf),
      initiativeBonus: num(sy.initiativeBonus, -20, 20, 0),
      hitDie: [6, 8, 10, 12].includes(Number(sy.hitDie)) ? Number(sy.hitDie) : 8,
      hitDiceTotal,
      hitDiceUsed: num(sy.hitDiceUsed, 0, hitDiceTotal, 0),
      inspiration: bool(sy.inspiration),
      deathSuccess: num(sy.deathSuccess, 0, 3, 0),
      deathFailure: num(sy.deathFailure, 0, 3, 0),
    };
  }
  return out;
}

export const abilityMod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);

/** Modificador de iniciativa: D&D usa DES; Pathfinder 2e usa Percepção (TEML + nível). */
export function initiativeMod(system, sheet) {
  if (!sheet) return 0;
  const m = (k) => abilityMod(sheet.attrs[k]);
  if (system === "pf2e") {
    const rank = sheet.sys.perception;
    const prof = rank === 0 ? 0 : sheet.level + 2 * rank; // Destreinado não soma o nível
    return m("sab") + prof + sheet.sys.initiativeBonus;
  }
  return m("des") + sheet.sys.initiativeBonus;
}

// ---------- bônus usados no combate ----------
export const profBonus = (level) => 2 + Math.floor((level - 1) / 4); // D&D 5e
export const teml = (rank, level) => (rank === 0 ? 0 : level + 2 * rank); // Pathfinder 2e: Destreinado não soma o nível

const PF2E_SAVE_ATTR = { fort: ["con", "fort"], ref: ["des", "ref"], will: ["sab", "will"] };

/** Modificador de resistência (D&D: 6 atributos; Pathfinder: Fortitude, Reflexos, Vontade). */
export function saveMod(system, sheet, key) {
  if (!sheet) return 0;
  if (system === "pf2e") {
    const e = PF2E_SAVE_ATTR[key];
    return e ? abilityMod(sheet.attrs[e[0]]) + teml(sheet.sys.saves[e[1]], sheet.level) : 0;
  }
  if (!ATTRS.includes(key)) return 0;
  return abilityMod(sheet.attrs[key]) + (sheet.sys.saveProf[key] ? profBonus(sheet.level) : 0);
}

/** CD padrão de magia: D&D = 8 + proficiência + atributo de conjuração; Pathfinder 2e = Class DC. */
export function spellDc(system, sheet) {
  if (system === "pf2e") {
    return 10 + abilityMod(sheet.attrs[sheet.sys.classDcAttr]) + teml(sheet.sys.classDcRank, sheet.level);
  }
  return 8 + profBonus(sheet.level) + abilityMod(sheet.attrs[sheet.sys.spellAttr]);
}
