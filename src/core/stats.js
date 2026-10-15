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

// 낀 장비 전체 능력치
export function totalStats(equipped, itemDefs, weaponDefs, baseDamage, level, levelsCfg) {
  let defense = 0;
  let speed = 0;
  for (const id of Object.values(equipped)) {
    const s = (id && itemDefs[id] && itemDefs[id].stats) || {};
    defense += s.defense || 0;
    speed += s.speed || 0;
  }
  return { attack: weaponAttack(equipped.weapon, weaponDefs, baseDamage, level, levelsCfg), defense, speedMul: 1 + speed };
}

// 맞았을 때 받는 데미지: 데미지 − 방어력(최소 1)
export function damageTaken(damage, defense) {
  return Math.max(1, damage - defense);
}

// 이 레벨에 낄 수 있는지
export function levelOk(def, level) {
  return !def || !def.level || level >= def.level;
}
