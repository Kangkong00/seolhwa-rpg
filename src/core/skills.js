// 무예 배우기와 기다리는 시간(화면과 무관). 무예 정의 = data/skills.json
import { countItem, removeItem } from './equipment.js';

// 배울 수 있는지. 반환: { ok, reasons: [모자란 것 설명], needSkills: [앞 무예 id] }
// opts.tree: 무예 트리 규칙(requiresSkill — 앞 무예를 모두 배워야 함, data/game.json skillTreeRequires), opts.names: id → 이름
export function canLearn(skill, progress, inv, learned, itemDefs, opts = {}) {
  const reasons = [];
  if (learned.includes(skill.id)) return { ok: false, reasons: ['이미 배운 무예'], needSkills: [] };
  const req = skill.requires || {};
  if (req.level && progress.level < req.level) reasons.push(`레벨 ${req.level} 필요`);
  const needSkills = opts.tree ? missingSkills(skill, learned) : [];
  if (needSkills.length) reasons.push(`앞 무예 필요(${needSkills.map((id) => (opts.names && opts.names[id]) || id).join('·')})`);
  const cost = skill.cost || {};
  if (cost.coins && inv.coins < cost.coins) reasons.push('엽전 모자람');
  for (const [id, n] of Object.entries(cost.items || {})) {
    const have = countItem(inv, id);
    if (have < n) reasons.push(`${itemDefs[id] ? itemDefs[id].name : id} ${have}/${n}`);
  }
  return { ok: reasons.length === 0, reasons, needSkills };
}

// 아직 안 배운 앞 무예(requiresSkill)
export function missingSkills(skill, learned) {
  return (skill.requiresSkill || []).filter((id) => !learned.includes(id));
}

// 배우기: 엽전과 재료를 내고 배운 목록에 넣음
export function learnSkill(skill, progress, inv, learned, itemDefs, opts = {}) {
  const c = canLearn(skill, progress, inv, learned, itemDefs, opts);
  if (!c.ok) return c;
  const cost = skill.cost || {};
  inv.coins -= cost.coins || 0;
  for (const [id, n] of Object.entries(cost.items || {})) removeItem(inv, id, n);
  learned.push(skill.id);
  return { ok: true, reasons: [] };
}

// 값을 받지 않고 배운 목록에 넣음(보상·시험용). 반환: 새로 배웠는지
export function grantSkill(skill, learned) {
  if (learned.includes(skill.id)) return false;
  learned.push(skill.id);
  return true;
}

// ---------- 무예 칸(docs/spec/skills_impact.md 2): 화면 단추 SLOT_COUNT칸, 칸마다 무예 id 또는 null ----------
// 칸 수는 data/game.json skillSlots(docs/spec/feedback_1021.md 1) — 시작할 때 setSlotCount로 넣음
export let SLOT_COUNT = 8;
export function setSlotCount(n) {
  if (Number.isInteger(n) && n > 0) SLOT_COUNT = n;
}

// 저장된 칸을 정리(배운 무예만, 겹치지 않게). 저장된 칸이 없으면 배운 순서대로 앞에서부터 채움
export function normalizeSlots(saved, learned, n = SLOT_COUNT) {
  const slots = Array(n).fill(null);
  if (Array.isArray(saved)) {
    saved.slice(0, n).forEach((id, i) => {
      if (id && learned.includes(id) && !slots.includes(id)) slots[i] = id;
    });
  } else {
    learned.slice(0, n).forEach((id, i) => { slots[i] = id; });
  }
  return slots;
}

// i번 칸에 넣음. 다른 칸에 이미 있으면 두 칸을 맞바꿈
export function placeInSlot(slots, i, id) {
  const from = slots.indexOf(id);
  if (from >= 0) slots[from] = slots[i];
  slots[i] = id;
  return slots;
}

export function clearSlot(slots, i) {
  slots[i] = null;
  return slots;
}

// 아직 칸에 없으면 첫 빈칸에 넣음. 반환: 들어간 칸 번호(빈칸이 없으면 -1)
export function autoSlot(slots, id) {
  const at = slots.indexOf(id);
  if (at >= 0) return at;
  const free = slots.indexOf(null);
  if (free >= 0) slots[free] = id;
  return free;
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
