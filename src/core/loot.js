// 전리품·엽전 떨어뜨리기와 바닥에 떨어진 물건 줍기(화면과 무관).
// 몬스터 정의(data/monsters.json): drops: [{ item, chance, count }], coins: { chance, min, max }

// 반환: [{ item, n } | { coins }]
export function rollDrops(def, rand = Math.random) {
  const out = [];
  for (const d of def.drops || []) {
    if (rand() < d.chance) out.push({ item: d.item, n: d.count || 1 });
  }
  const c = def.coins;
  if (c && rand() < c.chance) {
    const v = c.min + Math.floor(rand() * (c.max - c.min + 1));
    if (v > 0) out.push({ coins: v });
  }
  return out;
}

// 시험 배율(docs/spec/test_boost.md, data/game.json testBoost). 꺼져 있으면 그대로.
// 경험치·엽전은 곱한 뒤 반올림(최소 1), 확률은 min(1, 확률 × dropChance)
export function boostAmount(v, boost, key) {
  if (!boost || !boost.enabled || !v) return v;
  return Math.max(1, Math.round(v * (boost[key] || 1)));
}

export function boostChance(chance, boost) {
  if (!boost || !boost.enabled) return chance;
  return Math.min(1, chance * (boost.dropChance || 1));
}

// 몬스터를 쓰러뜨렸을 때 받는 것을 정하는 한 곳(쥐왕 포함). 반환: { exp, entries: rollDrops 꼴 }
// 전리품 확률만 dropChance를 곱하고, 엽전은 나올 확률은 그대로·금액에 coins를 곱함
export function killRewards(def, boost, rand = Math.random) {
  const drops = (def.drops || []).map((d) => ({ ...d, chance: boostChance(d.chance, boost) }));
  const entries = rollDrops({ ...def, drops }, rand).map((e) => (e.coins ? { coins: boostAmount(e.coins, boost, 'coins') } : e));
  return { exp: boostAmount(def.exp || 0, boost, 'exp'), entries };
}

// 바닥에 떨어진 물건들. cfg = data/economy.json groundDrops
export class GroundDrops {
  constructor(cfg) {
    this.cfg = cfg;
    this.list = []; // { id, x, y, item?, n?, coins?, age }
    this.nextId = 1;
  }

  // 쓰러진 자리(x, y) 둘레에 흩뿌림. grid가 있으면 못 가는 칸에는 떨어뜨리지 않음
  spawn(x, y, entries, grid = null, rand = Math.random) {
    const born = [];
    entries.forEach((e, i) => {
      const a = (i / Math.max(1, entries.length)) * Math.PI * 2 + rand() * 0.8;
      const r = this.cfg.scatterPx * (0.4 + rand() * 0.6);
      let px = x + Math.cos(a) * r;
      let py = y + Math.sin(a) * r * 0.6;
      if (grid && grid.isPointBlocked(px, py)) {
        px = x;
        py = y;
      }
      const d = { id: this.nextId++, x: px, y: py, fromX: x, fromY: y, age: 0, ...e };
      this.list.push(d);
      born.push(d);
    });
    return born;
  }

  // 가방에서 버린 물건(docs/spec/feedback_1020.md 10): 그 자리에 그대로, lifeMs 뒤 사라짐.
  // 버리자마자 다시 줍지 않게, 주인공이 줍는 거리 밖으로 한 번 나갔다 와야 주움(held)
  drop(x, y, entry, lifeMs) {
    const d = { id: this.nextId++, x, y, fromX: x, fromY: y - 10, age: 0, lifeMs, held: true, ...entry };
    this.list.push(d);
    return d;
  }

  // 시간 흐름 + 주인공 가까이 온 것 줍기. 반환: { picked: [...], expired: [...] }
  update(dt, player) {
    const picked = [];
    const expired = [];
    const r2 = this.cfg.pickupRadius * this.cfg.pickupRadius;
    this.list = this.list.filter((d) => {
      d.age += dt;
      if (player && d.age >= this.cfg.pickupDelayMs) {
        const dx = d.x - player.x;
        const dy = d.y - player.y;
        if (d.held && dx * dx + dy * dy > r2 * 2.25) d.held = false;
        if (!d.held && dx * dx + dy * dy <= r2) {
          picked.push(d);
          return false;
        }
      }
      if (d.age >= (d.lifeMs || this.cfg.lifetimeMs)) {
        expired.push(d);
        return false;
      }
      return true;
    });
    return { picked, expired };
  }
}
