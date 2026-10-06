// Teste de integração do combate: dados, graus de sucesso, áreas, ataque, magia e duração de condições.
// Roda os handlers de verdade contra um Socket.IO falso (test/fake-io.js). Uso: npm test
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mesa-test-")); // antes de importar a config

const { parseExpr, rollExpr } = await import("../src/domain/dice.js");
const { makeArea, tokenInArea } = await import("../src/domain/areas.js");
const { degreeOf, damageFactor, rollAttack } = await import("../src/services/combat.js");
const { saveMod, spellDc, defaultSheet } = await import("../src/domain/rules.js");
const { ensureDirs } = await import("../src/infra/storage.js");
const { registerHandlers } = await import("../src/app.js");
const { FakeIO } = await import("./fake-io.js");

ensureDirs();
const io = new FakeIO();
registerHandlers(io);
const ok = (m) => console.log("ok -", m);

// ---- dados ----
assert.equal(parseExpr("2d6+1d4+3").length, 3);
for (const bad of ["", "abc", "2d", "1d1", "99d6", "1d6++2", "1d6+", "1d6 * 2", "d6"]) assert.equal(parseExpr(bad), null, bad);
for (let i = 0; i < 200; i++) { const r = rollExpr("2d6+3", { system: "dnd5e" }); assert(r.total >= 5 && r.total <= 15); }
const crit5e = rollExpr("1d8+3", { system: "dnd5e", crit: true }); assert(/2d8/.test(crit5e.detail) && crit5e.total >= 5 && crit5e.total <= 19);
for (let i = 0; i < 100; i++) { const r = rollExpr("1d8+3", { system: "pf2e", crit: true }); assert(r.total % 2 === 0 && r.total >= 8 && r.total <= 22); }
ok("dados: parser rejeita lixo; crítico dobra os dados (D&D) ou o total (PF2e)");

// ---- graus de sucesso ----
assert.equal(degreeOf("dnd5e", 20, 20, 30), "critSuccess"); assert.equal(degreeOf("dnd5e", 1, 40, 5), "failure");
assert.equal(degreeOf("dnd5e", 10, 15, 15), "success"); assert.equal(degreeOf("dnd5e", 10, 14, 15), "failure");
assert.equal(degreeOf("pf2e", 10, 25, 15), "critSuccess"); assert.equal(degreeOf("pf2e", 10, 15, 15), "success");
assert.equal(degreeOf("pf2e", 10, 14, 15), "failure"); assert.equal(degreeOf("pf2e", 5, 5, 15), "critFailure");
assert.equal(degreeOf("pf2e", 20, 15, 15), "critSuccess", "20 natural sobe um grau");
assert.equal(degreeOf("pf2e", 1, 15, 15), "failure", "1 natural desce um grau");
assert.equal(degreeOf("dnd5e", 20, 5, 15, { isAttack: false }), "failure", "resistência D&D: 20 natural não é automático");
assert.equal(damageFactor("dnd5e", "success", "half"), 0.5); assert.equal(damageFactor("dnd5e", "success", "none"), 0);
assert.equal(damageFactor("pf2e", "critFailure", "half"), 2); assert.equal(damageFactor("pf2e", "success", "half"), 0.5);
assert.equal(damageFactor("pf2e", "critSuccess", "half"), 0); assert.equal(damageFactor("dnd5e", null, "half"), 1);
ok("graus de sucesso e fator de dano por sistema");

// vantagem/desvantagem e penalidade
for (let i = 0; i < 200; i++) {
  const adv = rollAttack("dnd5e", 5, { advantage: 1 }), dis = rollAttack("dnd5e", 5, { advantage: -1 });
  assert(adv.d20 >= Math.min(adv.d20, adv.alt) && adv.d20 === Math.max(adv.d20, adv.alt));
  assert(dis.d20 === Math.min(dis.d20, dis.alt));
  assert.equal(rollAttack("pf2e", 7, { penalty: -5 }).mod, 2);
}
ok("vantagem pega o maior, desvantagem o menor, penalidade de múltiplos ataques no PF2e");

// ---- bônus de ficha ----
const d = defaultSheet("dnd5e"); d.level = 5; d.attrs.des = 14; d.sys.saveProf.des = true; d.attrs.int = 16;
assert.equal(saveMod("dnd5e", d, "des"), 5); assert.equal(spellDc("dnd5e", d), 14);
const p = defaultSheet("pf2e"); p.level = 5; p.attrs.con = 12; p.sys.saves.fort = 2; p.attrs.for = 18; p.sys.classDcRank = 1;
assert.equal(saveMod("pf2e", p, "fort"), 1 + 9); assert.equal(spellDc("pf2e", p), 10 + 4 + 7);
ok("modificador de resistência e CD de magia por sistema");

// ---- áreas ----
const T = (x, y, size = 1) => ({ x, y, size });
const esf = makeArea({ shape: "sphere", size: 20 }, "dnd5e", 10, 10);
assert(tokenInArea(esf, T(10, 10))); assert(tokenInArea(esf, T(13, 10))); assert(!tokenInArea(esf, T(16, 10)));
const cubo = makeArea({ shape: "cube", size: 20 }, "dnd5e", 10, 10);
assert(tokenInArea(cubo, T(8.2, 8.2))); assert(!tokenInArea(cubo, T(13, 10)));
const cone5 = makeArea({ shape: "cone", size: 30 }, "dnd5e", 0.5, 0.5, 0);
assert(tokenInArea(cone5, T(4, 0))); assert(!tokenInArea(cone5, T(4, 3))); assert(!tokenInArea(cone5, T(-3, 0))); assert(!tokenInArea(cone5, T(8, 0)));
const cone2 = makeArea({ shape: "cone", size: 30 }, "pf2e", 0.5, 0.5, 0);
assert(tokenInArea(cone2, T(3, 2.5)), "cone de 90° é mais largo"); assert(!tokenInArea(cone5, T(3, 2.5)));
const linha = makeArea({ shape: "line", size: 60, width: 5 }, "dnd5e", 0.5, 0.5, Math.PI / 2);
assert(tokenInArea(linha, T(0, 6))); assert(!tokenInArea(linha, T(2, 6))); assert(!tokenInArea(linha, T(0, 14)));
ok("áreas: esfera, cubo, cone (5e estreito / PF2e 90°) e linha");

// ---- fluxo de combate completo (D&D) ----
const gm = io.connect(); const GM = "gmgmgmgm-1111";
gm.send("join", { room: "cmb", name: "Mestre", playerId: GM, password: "", system: "dnd5e" });
const pl = io.connect("2.2.2.2"); const P = "playerpl-2222";
pl.send("join", { room: "cmb", name: "Ana", playerId: P, password: "" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

pl.send("token:add", { name: "Ana", color: "#00f", size: 1, x: 0, y: 0 });
const ana = pl.events("token:upsert").find((t) => t.name === "Ana");
gm.send("token:add", { name: "Orc", color: "#080", size: 1, x: 3, y: 0, owner: null });
const orc = gm.events("token:upsert").find((t) => t.name === "Orc");
gm.send("token:add", { name: "Rato", color: "#888", size: 1, x: 4, y: 1, owner: null });
const rato = gm.events("token:upsert").find((t) => t.name === "Rato");

pl.send("sheet:update", { id: ana.id, patch: { attacks: [{ name: "Espada", bonus: 100, damage: "1d8+3", dtype: "cortante" }, { name: "Ruim", bonus: 0, damage: "xx" }], spells: [{ name: "Bola de Fogo", shape: "sphere", size: 20, effect: "damage", damage: "8d6", dtype: "fogo", save: "des", dc: 99, onSave: "half", condEmoji: "🔥", condRounds: 2 }] } });
const sa = pl.events("sheet").at(-1).sheet;
assert.equal(sa.attacks[1].damage, "", "expressão inválida descartada"); assert.equal(sa.spells[0].dc, 50, "CD limitada a 50");
gm.send("sheet:update", { id: orc.id, patch: { hp: { max: 30, cur: 30 }, ac: 12 } });
gm.send("sheet:update", { id: rato.id, patch: { hp: { max: 4, cur: 4 }, ac: 10, attrs: { des: 1 } } });
ok("ficha aceita ataques e magias válidos e limpa os inválidos");

// ataque (bônus 100 => sempre acerta; 1 natural ainda falha)
let acertos = 0, mortes = 0;
for (let i = 0; i < 30; i++) {
  gm.send("sheet:update", { id: orc.id, patch: { hp: { max: 500, cur: 500, temp: 0 } } });
  pl.clear();
  pl.send("combat:attack", { attackerId: ana.id, targetId: orc.id, index: 0 });
  const lines = pl.events("combat:log").at(-1).lines.map((l) => l.t).join("|");
  if (/ACERTO/.test(lines)) { acertos++; assert(/Dano/.test(lines)); assert(!/CA 12/.test(lines), "jogador não vê a CA"); }
}
assert(acertos >= 25, "bônus 100 acerta quase sempre"); 
gm.clear(); gm.send("sheet:update", { id: orc.id, patch: { hp: { max: 500, cur: 500 } } });
gm.send("combat:attack", { attackerId: orc.id, targetId: ana.id, index: 0 });
assert.equal(gm.events("combat:log").length, 0, "mestre sem ataque cadastrado no orc: nada acontece");
// um 1 natural sempre erra: repete até acertar (40 tentativas deixam a chance de falha em ~0)
let hpOrc = 500;
for (let i = 0; i < 40 && hpOrc >= 500; i++) {
  gm.clear(); pl.clear(); pl.send("combat:attack", { attackerId: ana.id, targetId: orc.id, index: 0 });
  hpOrc = gm.events("sheet").filter((s) => s.id === orc.id).at(-1)?.sheet.hp.cur ?? 500;
}
const gmLines = gm.events("combat:log").at(-1).lines.map((l) => l.t).join("|");
assert(/CA 12/.test(gmLines), "mestre vê a CA");
assert(hpOrc < 500, "dano aplicado ao alvo");
ok("ataque: rola, compara com a CA, aplica dano; CA só aparece ao mestre");

// aplicar dano com PV temporário e morte
gm.send("sheet:update", { id: rato.id, patch: { hp: { max: 4, cur: 4, temp: 3 } } });
gm.send("combat:auto", { enabled: true });
gm.send("sheet:update", { id: ana.id, patch: { attacks: [{ name: "Maça", bonus: 100, damage: "10", dtype: "" }] } });
gm.clear(); pl.send("combat:attack", { attackerId: ana.id, targetId: rato.id, index: 0 });
for (let i = 0; i < 20 && !gm.events("sheet").some((s) => s.id === rato.id && s.sheet.hp.cur === 0); i++) { pl.send("combat:attack", { attackerId: ana.id, targetId: rato.id, index: 0 }); }
const ratoHp = gm.events("sheet").filter((s) => s.id === rato.id).at(-1).sheet.hp;
assert.equal(ratoHp.cur, 0); assert.equal(ratoHp.temp, 0);
assert(gm.events("token:upsert").some((t) => t.id === rato.id && t.conditions.some((c) => c.e === "💀")), "💀 automático em 0 PV");
gm.send("sheet:update", { id: rato.id, patch: { hp: { cur: 2 } } });
assert(gm.events("token:upsert").filter((t) => t.id === rato.id).at(-1).conditions.every((c) => c.e !== "💀"), "💀 some ao curar");
ok("PV temporário absorve primeiro; 💀 aparece em 0 PV e some ao curar");

// aplicação automática desligada
gm.send("combat:auto", { enabled: false });
gm.send("sheet:update", { id: orc.id, patch: { hp: { max: 500, cur: 500 } } });
gm.clear();
let rolouDano = false;
for (let i = 0; i < 40 && !rolouDano; i++) { // repete se cair um 1 natural (erro, sem dano)
  pl.send("combat:attack", { attackerId: ana.id, targetId: orc.id, index: 0 });
  rolouDano = gm.events("combat:log").some((m) => m.lines.some((l) => /não aplicado/.test(l.t)));
}
assert(rolouDano, "o log avisa que o dano não foi aplicado");
assert(!gm.events("sheet").some((s) => s.id === orc.id && s.sheet.hp.cur < 500), "nada aplicado com o modo manual");
gm.send("combat:auto", { enabled: true });
ok("modo manual: mostra o dano mas não aplica");

// jogador não ataca com token alheio nem alvo oculto
gm.clear(); pl.send("combat:attack", { attackerId: orc.id, targetId: ana.id, index: 0 });
assert.equal(gm.events("combat:log").length, 0);
gm.send("fog:toggle", { enabled: true });
gm.send("token:add", { name: "Longe", color: "#f00", size: 1, x: 40, y: 0, owner: null });
const longe = gm.events("token:upsert").find((t) => t.name === "Longe");
pl.clear(); pl.send("combat:attack", { attackerId: ana.id, targetId: longe.id, index: 0 });
assert.equal(pl.events("combat:log").length, 0, "não ataca o que não enxerga");
gm.send("fog:toggle", { enabled: false });
ok("permissões: só ataca com o próprio token e só em alvo visível");

// ---- magia em área ----
for (const t of [orc, rato]) gm.send("sheet:update", { id: t.id, patch: { hp: { max: 500, cur: 500, temp: 0 }, attrs: { des: 1 } } });
gm.send("sheet:update", { id: ana.id, patch: { hp: { max: 500, cur: 500 } } });
gm.send("token:move", { id: longe.id, x: 3, y: 1 });
gm.clear(); pl.clear();
pl.send("spell:cast", { tokenId: ana.id, index: 0, x: 3.5, y: 0.5, angle: 0 });
const area = pl.events("spell:area").at(-1);
assert(area && area.hit.includes(orc.id) && area.hit.includes(longe.id) && area.hit.includes(ana.id), "esfera também atinge o conjurador se ele estiver dentro");
const log = gm.events("combat:log").at(-1).lines.map((l) => l.t);
assert(log.some((l) => /conjura Bola de Fogo/.test(l)) && log.some((l) => /Dano .* = \d+ de fogo/.test(l)));
assert(log.some((l) => /DES .* contra CD 50/.test(l)));
const orcDepois = gm.events("sheet").filter((s) => s.id === orc.id).at(-1).sheet.hp.cur;
assert(orcDepois < 500, "falhou na resistência (CD 50) e levou dano");
assert(gm.events("token:upsert").some((t) => t.id === orc.id && t.conditions.some((c) => c.e === "🔥" && c.d === 2)), "condição com duração aplicada");
ok("magia: esfera atinge quem está na área, rola resistência por alvo, aplica dano e condição de 2 rodadas");

// parede bloqueia
gm.send("wall:add", { x1: 3, y1: -5, x2: 3, y2: 5 });
gm.send("sheet:update", { id: orc.id, patch: { hp: { max: 500, cur: 500 } } });
gm.clear(); pl.clear();
pl.send("spell:cast", { tokenId: ana.id, index: 0, x: 2.5, y: 0.5, angle: 0 }); // ponto à esquerda da parede
const hitParede = pl.events("spell:area").at(-1).hit;
assert(hitParede.includes(ana.id), "mesmo lado da parede: atingido");
assert(![orc.id, longe.id, rato.id].some((id) => hitParede.includes(id)), "do outro lado da parede: protegido");
gm.send("wall:clear");
ok("paredes bloqueiam o efeito da magia");

// duração das condições por rodada
gm.send("token:update", { id: ana.id, conditions: [{ e: "😵", d: 2 }, { e: "🛡️", d: null }] });
gm.send("init:add", { tokenIds: [ana.id, orc.id] });
gm.send("init:set", { tokenId: ana.id, value: 10 }); gm.send("init:set", { tokenId: orc.id, value: 5 });
gm.send("init:start");
const cond = () => gm.events("token:upsert").filter((t) => t.id === ana.id).at(-1).conditions;
gm.send("init:next"); // orc
assert.equal(cond().find((c) => c.e === "😵").d, 2, "ainda na rodada 1");
gm.send("init:next"); // volta à Ana: rodada 2
assert.equal(cond().find((c) => c.e === "😵").d, 1, "uma rodada passou");
gm.clear();
gm.send("init:next"); gm.send("init:next"); // rodada 3
assert(!cond().some((c) => c.e === "😵"), "expirou"); assert(cond().some((c) => c.e === "🛡️"), "sem duração permanece");
assert(gm.events("combat:log").some((m) => m.lines.some((l) => /😵 terminou em Ana/.test(l.t))));
ok("duração das condições diminui a cada nova rodada, expira e avisa; sem duração permanece");
fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
process.exit(0);