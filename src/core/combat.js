// 때리기 규칙. 화면 코드를 참조하지 않음 (나중에 서버로 옮김).
// 지금은 주인공 → 몬스터 한 방향만. 몬스터 반격·레벨·경험치는 아직 없음.

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
  m.hp = Math.max(0, m.hp - damage);
  m.knockDir = facing;
  m.knockLeft = knockbackPx;
  m.stunMs = stunMs;
  m.state = 'rest';
  m.timer = stunMs;
  return { damage, killed: m.hp <= 0 };
}
