// 쓰는 물건 규칙(docs/spec/items_fix_1022.md): 기다림 묶음(cooldownGroup)·술 버프(drink)·영구 최대 체력(산삼). 화면 코드를 참조하지 않음.
// 상태 us = { groups: { 묶음: 남은 ms }, drink: { id, attackMul, left } | null }
// 화면 쪽은 읽기만(남은 초·술 아이콘), 시간은 tickUse로 흐름.

export function createUseState() {
  return { groups: {}, drink: null };
}

// 시간 흐름(dt ms)
export function tickUse(us, dt) {
  for (const g of Object.keys(us.groups)) {
    us.groups[g] -= dt;
    if (!(us.groups[g] > 0)) delete us.groups[g];
  }
  if (us.drink) {
    us.drink.left -= dt;
    if (!(us.drink.left > 0)) us.drink = null;
  }
}

// 묶음의 남은 기다림(ms)
export function groupLeft(us, group) {
  return (group && us.groups[group]) || 0;
}

// 지금 쓸 수 있는지. ctx: { level, hp, maxHp, sansamEaten }. 반환 { ok, reason }
export function canUse(us, def, ctx) {
  const u = def && def.use;
  if (!u) return { ok: false, reason: '쓸 수 없는 물건' };
  if (def.level && ctx.level < def.level) return { ok: false, reason: `레벨 ${def.level}부터` };
  const left = groupLeft(us, u.cooldownGroup);
  if (left > 0) return { ok: false, reason: `${Math.ceil(left / 1000)}초 뒤에 쓸 수 있습니다` };
  const heals = u.heal || u.healRatio || u.healFull;
  const grows = u.maxHpAdd && (ctx.sansamEaten || 0) < (u.maxHpAddLimit || Infinity);
  if (heals && !u.buff && !grows && ctx.hp >= ctx.maxHp) return { ok: false, reason: '체력이 가득합니다' };
  return { ok: true, reason: '' };
}

// 쓰기(canUse가 ok일 때). ctx: { maxHp, healMul, sansamEaten }.
// 반환 { heal(채울 양, 이미 healMul 곱함 — healFull이면 Infinity), maxHpAdd(이번에 늘릴 최대 체력), buff(새 술이면 그 상태) }
export function applyUse(us, def, ctx) {
  const u = def.use;
  const out = { heal: 0, maxHpAdd: 0, buff: null };
  if (u.healFull) out.heal = Infinity;
  else if (u.healRatio) out.heal = Math.max(1, Math.round(ctx.maxHp * u.healRatio * (ctx.healMul || 1)));
  else if (u.heal) out.heal = Math.max(1, Math.round(u.heal * (ctx.healMul || 1)));
  if (u.maxHpAdd && (ctx.sansamEaten || 0) < (u.maxHpAddLimit || Infinity)) out.maxHpAdd = u.maxHpAdd;
  // 술: 한 번에 하나만, 새 술을 마시면 새 술로(남은 시간도 새로)
  if (u.buff) {
    us.drink = { id: def.id, attackMul: u.buff.attackMul || 0, left: u.buff.ms };
    out.buff = us.drink;
  }
  if (u.cooldownGroup && u.cooldownMs) us.groups[u.cooldownGroup] = u.cooldownMs;
  return out;
}

// 술의 공격력 배율(평타·무예 모두에 곱함)
export function drinkMul(us) {
  return us && us.drink ? 1 + us.drink.attackMul : 1;
}

// 쓰러졌을 때: 술은 깨고(버프 끝), 기다림 묶음은 그대로
export function onDeath(us) {
  us.drink = null;
}
