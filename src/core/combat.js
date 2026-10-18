// 때리기 규칙. 화면 코드를 참조하지 않음 (나중에 서버로 옮김).
// 주인공 → 몬스터 (맞으면 몬스터가 반격 시작), 몬스터 → 주인공 (물기), 맞히기 도움(aimAssist).
import { provoke } from './monsters.js';

const DIR_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// 바라보는 방향 바로 앞(reach만큼 앞, 좌우로 width/2) 안에 있는 몬스터 중 가장 가까운 1마리
export function findTarget(pos, facing, monsters, reach, width) {
  const d = DIR_VECTORS[facing];
  let best = null;
  let bestDist = Infinity;
  for (const m of monsters) {
    if (m.hp <= 0) continue;
    const dx = m.x - pos.x;
    const dy = m.y - pos.y;
    const forward = dx * d.x + dy * d.y; // 앞쪽 거리
    const side = Math.abs(dx * d.y - dy * d.x); // 옆으로 벗어난 거리
    if (forward < -4 || forward > reach || side > width / 2) continue;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      best = m;
      bestDist = dist;
    }
  }
  return best;
}

// 맞히기: 체력을 깎고, 맞은 방향으로 밀려나게 함 (실제 이동은 monsters.js의 updateMonster에서 벽을 피해 조금씩)
// 반환: { damage, killed }
export function hitMonster(m, facing, damage, knockbackPx, stunMs) {
  damage = Math.max(1, Math.round(damage)); // 무예 배율로 소수가 되면 반올림(최소 1)
  m.hp = Math.max(0, m.hp - damage);
  m.knockDir = facing;
  m.knockLeft = knockbackPx;
  m.stunMs = stunMs;
  m.state = 'rest';
  m.timer = stunMs;
  provoke(m);
  return { damage, killed: m.hp <= 0 };
}

// 회심(docs/spec/skills_impact.md 1): crit.chance 확률로 데미지 crit.damageMul배. force면 반드시(받아치기).
// 반환: { damage, crit }
export function rollCrit(damage, crit, rand = Math.random, force = false) {
  const on = force || !!(crit && rand() < crit.chance);
  return { damage: on ? damage * crit.damageMul : damage, crit: on };
}

// 주인공이 물렸을 때: 체력을 깎음. 반환: { damage, killed }
export function hitPlayer(player, damage) {
  player.hp = Math.max(0, player.hp - damage);
  return { damage, killed: player.hp <= 0 };
}

// 맞히기 도움: 공격(무예 포함)을 누를 때 둘레 radius 안의 몬스터 쪽으로 몸을 돌리고,
// 그래도 닿지 않으면 maxStep까지 다가가게 함(실제 이동은 화면 쪽이 벽을 피해서).
// 반격 중인 몬스터를 먼저, 그다음 가까운 몬스터. 4방향 중 가까운 축으로 돎.
// 반환: { facing, step, target } — 둘레에 몬스터가 없으면 지금 방향 그대로, step 0
export function aimAssist(pos, facing, monsters, { radius, reach, width, maxStep }) {
  let best = null;
  let bestKey = Infinity;
  for (const m of monsters) {
    if (m.hp <= 0) continue;
    const dist = Math.hypot(m.x - pos.x, m.y - pos.y);
    if (dist > radius) continue;
    const key = (m.aggro ? 0 : 1e6) + dist; // 반격 중이면 먼저
    if (key < bestKey) {
      best = m;
      bestKey = key;
    }
  }
  if (!best) return { facing, step: 0, target: null };
  // 지금 방향으로 이미 닿는 몬스터가 그 몬스터면 그대로 침
  const ahead = findTarget(pos, facing, monsters, reach, width);
  if (ahead === best) return { facing, step: 0, target: best };
  const dx = best.x - pos.x;
  const dy = best.y - pos.y;
  const dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  const forward = Math.abs(dir === 'left' || dir === 'right' ? dx : dy);
  // 닿는 거리보다 조금 안쪽까지 다가감
  const step = forward > reach ? Math.min(maxStep, forward - reach + 2) : 0;
  return { facing: dir, step, target: best };
}
