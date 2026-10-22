// 능력치(임시, docs/spec/feedback_1015.md 6). 화면 코드를 참조하지 않음.
// 공격력 = 무기 damage(맨손은 attack.damage) + 레벨 보너스, 방어력 = 옷·머리·팔 방어력 합, 걸음 = 1 + 신발 등 speed 합.
import { damageBonus } from './progress.js';

// weaponDefs: data/weapons.json weapons를 id로, baseDamage: 맨손 데미지
export function weaponAttack(weaponId, weaponDefs, baseDamage, level, levelsCfg) {
  const w = weaponId && weaponDefs[weaponId];
  return (w ? w.damage : baseDamage) + damageBonus(level, levelsCfg);
}

// 휘두르기 빠르기 말: cooldownMs 470 이하 빠름, 520 이상 느림
export function swingSpeedLabel(w) {
  if (!w) return '보통';
  if (w.cooldownMs <= 470) return '빠름';
  if (w.cooldownMs >= 520) return '느림';
  return '보통';
}

// 배운 패시브 무예(docs/spec/feedback_1020.md 8)의 효과를 모두 더함. skills: data/skills.json skills, learned: 배운 id
export const PASSIVE_KEYS = ['maxHpMul', 'bladeAttackMul', 'bladeSwingCut', 'critChance', 'critDamage', 'regenRatio', 'speed', 'damageCut', 'momentumAttackMul', 'cooldownCut', 'bossDamageMul'];
export function passiveSum(skills, learned) {
  const p = Object.fromEntries(PASSIVE_KEYS.map((k) => [k, 0]));
  p.regenAfterMs = 0;
  p.regenEveryMs = 0;
  p.momentumMs = 0;
  for (const sk of skills) {
    if (sk.type !== 'passive' || !sk.passive || !learned.includes(sk.id)) continue;
    for (const [k, v] of Object.entries(sk.passive)) {
      if (k === 'regenAfterMs' || k === 'regenEveryMs' || k === 'momentumMs') p[k] = Math.max(p[k], v);
      else p[k] = (p[k] || 0) + v;
    }
  }
  return p;
}

// 낀 장비 전체 능력치. 팔찌(docs/spec/tier3_snake.md 4): maxHp 최대 체력 +, healMul 회복 배율 +, critChance 회심 확률 +,
// attack 공격력 +, cooldownCut 무예 기다리는 시간 −(최대 0.5)
// passive: passiveSum() 결과(없으면 패시브 없음), momentum: 기세가 켜져 있는지.
// attack은 패시브까지 넣은 값, passiveAttack은 그중 패시브로 오른 만큼("공격력 30 (+2 패시브)")
// extraMul: 술(공격력 ×, docs/spec/items_fix_1022.md) 등 그 밖의 공격력 배율
export function totalStats(equipped, itemDefs, weaponDefs, baseDamage, level, levelsCfg, passive = null, momentum = false, extraMul = 1) {
  const sum = { defense: 0, speed: 0, maxHp: 0, healMul: 0, critChance: 0, attack: 0, cooldownCut: 0 };
  for (const id of Object.values(equipped)) {
    const s = (id && itemDefs[id] && itemDefs[id].stats) || {};
    for (const k of Object.keys(sum)) sum[k] += s[k] || 0;
  }
  const p = passive || passiveSum([], []);
  const blade = !!(equipped.weapon && weaponDefs[equipped.weapon]);
  const attackMul = (1 + (blade ? p.bladeAttackMul : 0) + (momentum ? p.momentumAttackMul : 0)) * extraMul;
  const base = weaponAttack(equipped.weapon, weaponDefs, baseDamage, level, levelsCfg) + sum.attack;
  const attack = Math.round(base * attackMul);
  return {
    attack,
    attackBonus: sum.attack,
    attackMul,
    passiveAttack: Math.round(base * (attackMul / extraMul)) - base,
    extraAttack: attack - Math.round(base * (attackMul / extraMul)), // 술로 오른 만큼
    defense: sum.defense,
    speedMul: 1 + sum.speed + p.speed,
    passiveSpeed: p.speed,
    maxHp: sum.maxHp,
    maxHpMul: 1 + p.maxHpMul,
    healMul: 1 + sum.healMul,
    critChance: sum.critChance + p.critChance,
    critDamageAdd: p.critDamage,
    cooldownMul: 1 - Math.min(0.5, sum.cooldownCut + p.cooldownCut),
    swingMul: blade ? 1 - p.bladeSwingCut : 1,
    damageTakenMul: 1 - p.damageCut,
    bossDamageMul: 1 + p.bossDamageMul,
  };
}

// 맞았을 때 받는 데미지(docs/spec/feedback_1022.md 8): 데미지 × K / (K + 방어력), 최소 1. K = data/game.json defenseK
// (예전 '데미지 − 방어력'은 장비만 껴도 몬스터가 1밖에 못 줘서 바꿈). mul: 철갑 기운(받는 데미지 −10%)
export function damageTaken(damage, defense, mul = 1, k = 200) {
  return Math.max(1, Math.round(((damage * k) / (k + Math.max(0, defense))) * mul));
}

// 이 레벨에 낄 수 있는지
export function levelOk(def, level) {
  return !def || !def.level || level >= def.level;
}
