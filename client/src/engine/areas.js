// Geometria das áreas de magia (esfera, cubo, cone, linha, emanação).
// ARQUIVO IDÊNTICO no servidor (server/src/areas.js) e no cliente (client/src/areas.js).
// Coordenadas em casas da grade; 1 casa = 5 pés.

export const SHAPES = ["sphere", "cube", "cone", "line", "emanation"];
export const FT_PER_CELL = 5;

/** Meio-ângulo do cone: D&D 5e (largura = comprimento) ≈ 26,57°; Pathfinder 2e = 45° (cone de 90°). */
export const coneHalfAngle = (system) => (system === "pf2e" ? Math.PI / 4 : Math.atan(0.5));

/**
 * Monta a área. (ox, oy) é o centro da esfera/cubo ou a origem (conjurador) do cone/linha/emanação.
 * angle (radianos) só importa para cone e linha.
 */
export function makeArea(spell, system, ox, oy, angle = 0) {
  return {
    shape: spell.shape,
    ox,
    oy,
    angle,
    len: spell.size / FT_PER_CELL,
    wid: Math.max(1, (spell.width || 5) / FT_PER_CELL),
    half: coneHalfAngle(system),
  };
}

export function contains(a, px, py) {
  const dx = px - a.ox, dy = py - a.oy;
  switch (a.shape) {
    case "sphere":
    case "emanation":
      return dx * dx + dy * dy <= a.len * a.len + 1e-9;
    case "cube":
      return Math.abs(dx) <= a.len / 2 + 1e-9 && Math.abs(dy) <= a.len / 2 + 1e-9;
    case "cone": {
      const d = Math.hypot(dx, dy);
      if (d > a.len + 1e-9) return false;
      if (d < 1e-6) return true;
      let da = Math.atan2(dy, dx) - a.angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      return Math.abs(da) <= a.half + 1e-9;
    }
    case "line": {
      const ux = Math.cos(a.angle), uy = Math.sin(a.angle);
      const t = dx * ux + dy * uy;
      const p = -dx * uy + dy * ux;
      return t >= -1e-9 && t <= a.len + 1e-9 && Math.abs(p) <= a.wid / 2 + 1e-9;
    }
    default:
      return false;
  }
}

/** Centro e cantos (levemente recuados) do token: atingido se qualquer ponto estiver na área. */
export function tokenPoints(t) {
  const c = 0.15;
  const x0 = t.x + c, y0 = t.y + c, x1 = t.x + t.size - c, y1 = t.y + t.size - c;
  return [[t.x + t.size / 2, t.y + t.size / 2], [x0, y0], [x1, y0], [x0, y1], [x1, y1]];
}

export const tokenInArea = (a, t) => tokenPoints(t).some(([x, y]) => contains(a, x, y));

/** Esfera e cubo ficam onde o jogador clica; cone, linha e emanação nascem do conjurador. */
export const areaFixa = (shape) => shape === "sphere" || shape === "cube";
