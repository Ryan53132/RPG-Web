// Ataques, rolagens da ficha, magias em área e aplicação automática de efeitos.
import { canControl, isGm } from "../domain/permissions.js";
import { saveMod, spellDc } from "../domain/rules.js";
import { rollDie } from "../lib/util.js";
import { rollExpr } from "../domain/dice.js";
import { areaFixa, makeArea, tokenInArea } from "../domain/areas.js";
import { blockingWalls, canSee, cellVisible, rayHitsWall, visCtx } from "../services/vision.js";
import {
  addCondition, applyDamage, applyHeal, damageFactor, degreeOf, isHit, rollAttack,
} from "../services/combat.js";
import { scheduleSave } from "../infra/storage.js";
import { playersPayload } from "./session.js";

const GRAU = {
  critSuccess: "SUCESSO CRÍTICO", success: "SUCESSO", failure: "FALHA", critFailure: "FALHA CRÍTICA",
};
const SAVE_PF2E = { fort: "Fortitude", ref: "Reflexos", will: "Vontade" };
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const d20Text = (r) => (r.alt !== null ? `[${r.d20}] (de ${Math.max(r.d20, r.alt)}/${Math.min(r.d20, r.alt)})` : `[${r.d20}]`);
const finiteNum = (n) => Number.isFinite(Number(n));

export function registerCombat(c) {
  const { io, socket } = c;

  /** Entrega as linhas do log a quem pode ver algum dos tokens (o mestre sempre vê). */
  function broadcastLog(room, tokens, extraViewer, build) {
    const ctx = visCtx(room);
    for (const [sid, pid] of room.online) {
      const gm = isGm(room, pid);
      const sees = (t) => gm || canSee(room, pid, t, ctx);
      if (!gm && !tokens.some(sees) && !extraViewer?.(pid)) continue;
      const nameOf = (t) => (sees(t) ? t.name : "Uma criatura");
      io.to(sid).emit("combat:log", { lines: build({ gm, pid, nameOf, sees, canSeeHp: (t) => gm || t.owner === pid }) });
    }
  }

  const mode = (data) => ({
    advantage: [-1, 0, 1].includes(Number(data.advantage)) ? Number(data.advantage) : 0,
    penalty: [0, -5, -10].includes(Number(data.penalty)) ? Number(data.penalty) : 0,
  });

  // ---------- ataque contra um alvo ----------
  socket.on("combat:attack", (data = {}) => {
    const { room, pid } = c;
    if (!room) return;
    const attacker = room.tokens[data.attackerId];
    const target = room.tokens[data.targetId];
    if (!attacker || !target || attacker === target || !canControl(room, pid, attacker)) return;
    if (!isGm(room, pid) && !canSee(room, pid, target, visCtx(room))) return; // não ataca o que não vê
    const atk = room.sheets[attacker.id]?.attacks?.[Number(data.index)];
    if (!atk) return;

    const r = rollAttack(room.system, atk.bonus, mode(data));
    const ac = room.sheets[target.id]?.ac ?? 10;
    const degree = degreeOf(room.system, r.d20, r.total, ac);
    const hit = isHit(degree);
    const crit = degree === "critSuccess";
    const dmg = hit && atk.damage ? rollExpr(atk.damage, { system: room.system, crit }) : null;
    const hp = dmg && room.autoDamage ? applyDamage(io, room, target, dmg.total) : null;

    broadcastLog(room, [attacker, target], null, ({ gm, nameOf, canSeeHp }) => {
      const lines = [{ t: `⚔ ${nameOf(attacker)} ataca ${nameOf(target)} com ${atk.name || "ataque"}`, k: "head" }];
      lines.push({
        t: `Ataque ${d20Text(r)} ${signed(r.mod)} = ${r.total}${gm ? ` contra CA ${ac}` : ""}: ${hit ? (crit ? "ACERTO CRÍTICO" : "ACERTO") : degree === "critFailure" ? "FALHA CRÍTICA" : "ERRO"}`,
        k: crit ? "crit" : hit ? "hit" : "miss",
      });
      if (dmg) {
        const resto = hp && canSeeHp(target) ? ` (PV ${hp.cur}/${hp.max})` : "";
        const aviso = !room.autoDamage && gm ? " (não aplicado: aplicação automática desligada)" : "";
        lines.push({ t: `Dano ${dmg.detail} = ${dmg.total}${atk.dtype ? ` de ${atk.dtype}` : ""}${resto}${aviso}`, k: "dmg" });
      }
      return lines;
    });
    scheduleSave(room);
  });

  // ---------- rolagem avulsa de ataque ou dano (sem alvo) ----------
  socket.on("combat:roll", (data = {}) => {
    const { room, pid } = c;
    if (!room) return;
    const token = room.tokens[data.tokenId];
    if (!token || !canControl(room, pid, token)) return;
    const atk = room.sheets[token.id]?.attacks?.[Number(data.index)];
    if (!atk) return;
    const dono = (viewerPid) => viewerPid === token.owner;

    if (data.kind === "attack") {
      const r = rollAttack(room.system, atk.bonus, mode(data));
      broadcastLog(room, [token], dono, ({ nameOf }) => [
        { t: `🎲 ${nameOf(token)}: ataque com ${atk.name || "ataque"} ${d20Text(r)} ${signed(r.mod)} = ${r.total}`, k: r.d20 === 20 ? "crit" : "info" },
      ]);
    } else if (data.kind === "damage") {
      const dmg = rollExpr(atk.damage, { system: room.system, crit: !!data.crit });
      if (!dmg) return;
      broadcastLog(room, [token], dono, ({ nameOf }) => [
        { t: `🎲 ${nameOf(token)}: dano de ${atk.name || "ataque"}${data.crit ? " (crítico)" : ""} ${dmg.detail} = ${dmg.total}${atk.dtype ? ` de ${atk.dtype}` : ""}`, k: "dmg" },
      ]);
    }
  });

  // ---------- magia em área ----------
  socket.on("spell:cast", (data = {}) => {
    const { room, pid } = c;
    if (!room) return;
    const caster = room.tokens[data.tokenId];
    if (!caster || !canControl(room, pid, caster)) return;
    const sheet = room.sheets[caster.id];
    const spell = sheet?.spells?.[Number(data.index)];
    if (!spell || ![data.x, data.y, data.angle].every(finiteNum)) return;

    const gm = isGm(room, pid);
    const ctx = visCtx(room);
    const fixa = areaFixa(spell.shape);
    const cx = caster.x + caster.size / 2;
    const cy = caster.y + caster.size / 2;
    const ox = fixa ? Math.max(-100000, Math.min(100000, Number(data.x))) : cx;
    const oy = fixa ? Math.max(-100000, Math.min(100000, Number(data.y))) : cy;
    if (fixa && !gm && room.fog.enabled && !cellVisible(room, ctx, Math.floor(ox), Math.floor(oy))) return; // só mira onde enxerga

    const area = makeArea(spell, room.system, ox, oy, Number(data.angle));
    const paredes = blockingWalls(room);
    const afetados = Object.values(room.tokens).filter((t) => {
      if (t.id === caster.id && !fixa) return false; // cone, linha e emanação não atingem o próprio conjurador
      if (!tokenInArea(area, t)) return false;
      const tx = t.x + t.size / 2, ty = t.y + t.size / 2;
      return !paredes.some((w) => rayHitsWall(ox, oy, tx, ty, w)); // paredes bloqueiam o efeito
    });

    const cura = spell.effect === "heal";
    const dc = spell.dc || spellDc(room.system, sheet);
    const roll = spell.damage ? rollExpr(spell.damage, { system: room.system }) : null;
    const nomeTeste = room.system === "pf2e" ? SAVE_PF2E[spell.save] : String(spell.save).toUpperCase();

    // resolve cada alvo
    const resultados = afetados.map((t) => {
      const ts = room.sheets[t.id];
      let save = null;
      let degree = null;
      if (!cura && spell.save) {
        const mod = saveMod(room.system, ts, spell.save);
        const d20 = rollDie(20);
        degree = degreeOf(room.system, d20, d20 + mod, dc, { isAttack: false });
        save = { d20, mod, total: d20 + mod };
      }
      const falhou = degree === "failure" || degree === "critFailure";
      const amount = roll ? Math.floor(roll.total * (cura ? 1 : damageFactor(room.system, degree, spell.onSave))) : 0;
      const aplicaCond = !!spell.condEmoji && (degree === null || falhou) && !cura;

      let hp = null;
      if (room.autoDamage) {
        if (roll && amount > 0) hp = cura ? applyHeal(io, room, t, amount) : applyDamage(io, room, t, amount);
        if (aplicaCond) addCondition(io, room, t, spell.condEmoji, spell.condRounds);
      }
      return { t, save, degree, amount, hp, aplicaCond };
    });

    const forma = { sphere: "esfera", cube: "cubo", cone: "cone", line: "linha", emanation: "emanação" }[spell.shape];
    const doAfetado = (p) => afetados.some((t) => t.owner === p);
    broadcastLog(room, [caster], doAfetado, ({ gm: ehGm, nameOf, sees, canSeeHp }) => {
      const lines = [{
        t: `✨ ${nameOf(caster)} conjura ${spell.name || "magia"} (${forma} de ${spell.size} pés${!cura && spell.save ? `, CD ${dc}` : ""})`,
        k: "head",
      }];
      if (roll) lines.push({ t: `${cura ? "Cura" : "Dano"} ${roll.detail} = ${roll.total}${spell.dtype ? ` de ${spell.dtype}` : ""}`, k: "dmg" });
      if (!resultados.length) lines.push({ t: "Nenhuma criatura atingida.", k: "info" });
      for (const r of resultados.filter((x) => sees(x.t))) { // cada um só vê o resultado de quem enxerga
        let txt = `${nameOf(r.t)}: `;
        if (r.save) {
          txt += `${nomeTeste} ${d20Text({ d20: r.save.d20, alt: null })} ${signed(r.save.mod)} = ${r.save.total} contra CD ${dc}, ${GRAU[r.degree]}; `;
        }
        txt += roll ? `${cura ? "cura" : "dano"} ${r.amount}` : "sem dano";
        if (r.hp && canSeeHp(r.t)) txt += ` (PV ${r.hp.cur}/${r.hp.max})`;
        if (r.aplicaCond && room.autoDamage) txt += ` ${spell.condEmoji}`;
        lines.push({ t: txt, k: r.degree && !isHit(r.degree) ? "miss" : "hit" });
      }
      if (!room.autoDamage && ehGm) lines.push({ t: "Efeitos não aplicados: aplicação automática desligada.", k: "info" });
      return lines;
    });

    // modelo da área para quem vê o conjurador, o mestre e os atingidos
    const aviso = { casterId: caster.id, area, effect: spell.effect, hit: afetados.map((t) => t.id) };
    for (const [sid, p] of room.online) {
      if (gm || isGm(room, p) || canSee(room, p, caster, ctx) || doAfetado(p)) io.to(sid).emit("spell:area", aviso);
    }
    scheduleSave(room);
  });

  // ---------- aplicar efeitos automaticamente (mestre) ----------
  socket.on("combat:auto", ({ enabled } = {}) => {
    const { room, pid } = c;
    if (!room || !isGm(room, pid)) return;
    room.autoDamage = !!enabled;
    io.to(room.id).emit("players", playersPayload(room));
    scheduleSave(room);
  });
}

