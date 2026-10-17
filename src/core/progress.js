// 경험치·레벨(화면과 무관). 상태: { level, exp } — exp는 지금 레벨에서 모은 경험치.
// cfg = data/economy.json levels: { expToNext: [1→2, 2→3, …], hpPerLevel }

export function createProgress(saved) {
  const level = saved && Number.isFinite(saved.level) && saved.level >= 1 ? Math.floor(saved.level) : 1;
  const exp = saved && Number.isFinite(saved.exp) && saved.exp >= 0 ? Math.floor(saved.exp) : 0;
  return { level, exp };
}

// 다음 레벨까지 필요한 경험치(더 오를 수 없으면 null)
export function expToNext(p, cfg) {
  const need = cfg.expToNext[p.level - 1];
  return Number.isFinite(need) ? need : null;
}

// 최고 레벨(레벨 표 길이 + 1)
export function maxLevel(cfg) {
  return cfg.expToNext.length + 1;
}

// 레벨을 바로 정함(1 ~ 최고 레벨, 경험치는 0부터). 반환: 정해진 레벨
export function setLevel(p, level, cfg) {
  p.level = Math.max(1, Math.min(maxLevel(cfg), Math.floor(level)));
  p.exp = 0;
  return p.level;
}

export function maxHpFor(level, baseHp, cfg) {
  return baseHp + (level - 1) * cfg.hpPerLevel;
}

// 경험치를 더하고, 오른 레벨 수를 돌려줌. 최고 레벨이면 경험치는 막대를 채운 채 멈춤
export function addExp(p, amount, cfg) {
  let gained = 0;
  p.exp += amount;
  for (;;) {
    const need = expToNext(p, cfg);
    if (need === null) {
      p.exp = Math.min(p.exp, cfg.expToNext[cfg.expToNext.length - 1] || 0);
      break;
    }
    if (p.exp < need) break;
    p.exp -= need;
    p.level += 1;
    gained += 1;
  }
  return gained;
}

// 레벨마다 데미지 +damagePerLevel(소수는 쌓아 두고 정수 부분만): 레벨 1은 0
export function damageBonus(level, cfg) {
  return Math.floor((level - 1) * (cfg.damagePerLevel || 0) + 1e-9);
}
