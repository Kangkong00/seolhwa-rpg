// 무예 배우기와 기다리는 시간(화면과 무관). 무예 정의 = data/skills.json
import { countItem, removeItem } from './equipment.js';

// 배울 수 있는지. 반환: { ok, reasons: [모자란 것 설명] }
export function canLearn(skill, progress, inv, learned, itemDefs) {
  const reasons = [];
  if (learned.includes(skill.id)) return { ok: false, reasons: ['이미 배운 무예'] };
  const req = skill.requires || {};
  if (req.level && progress.level < req.level) reasons.push(`레벨 ${req.level} 필요`);
  const cost = skill.cost || {};
  if (cost.coins && inv.coins < cost.coins) reasons.push('엽전 모자람');
  for (const [id, n] of Object.entries(cost.items || {})) {
    const have = countItem(inv, id);
    if (have < n) reasons.push(`${itemDefs[id] ? itemDefs[id].name : id} ${have}/${n}`);
  }
  return { ok: reasons.length === 0, reasons };
}

// 배우기: 엽전과 재료를 내고 배운 목록에 넣음
export function learnSkill(skill, progress, inv, learned, itemDefs) {
  const c = canLearn(skill, progress, inv, learned, itemDefs);
  if (!c.ok) return c;
  const cost = skill.cost || {};
  inv.coins -= cost.coins || 0;
  for (const [id, n] of Object.entries(cost.items || {})) removeItem(inv, id, n);
  learned.push(skill.id);
  return { ok: true, reasons: [] };
}

// 기다리는 시간: { 무예 id: 남은 ms }
export class Cooldowns {
  constructor() {
    this.left = {};
  }

  start(id, ms) {
    this.left[id] = ms;
  }

  remaining(id) {
    return this.left[id] || 0;
  }

  ready(id) {
    return this.remaining(id) <= 0;
  }

  update(dt) {
    for (const id of Object.keys(this.left)) {
      this.left[id] -= dt;
      if (this.left[id] <= 0) delete this.left[id];
    }
  }
}
