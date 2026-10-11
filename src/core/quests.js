// 의뢰(화면과 무관). 시간 제한 없음, 대화로만. 상태: { 의뢰 id: 'active' | 'done' }
import { addItem, countItem, removeItem } from './equipment.js';

// 지금 단계: 'offer'(아직 안 맡음) | 'progress'(맡았고 모자람) | 'ready'(드릴 수 있음) | 'done'
export function questStage(q, qs, inv) {
  const s = qs[q.id];
  if (s === 'done') return 'done';
  if (s !== 'active') return 'offer';
  const enough = Object.entries(q.need || {}).every(([id, n]) => countItem(inv, id) >= n);
  return enough ? 'ready' : 'progress';
}

export function acceptQuest(q, qs) {
  if (!qs[q.id]) qs[q.id] = 'active';
}

// 드리기: 필요한 것을 빼고 보상을 줌. 반환: 보상 { coins, items } 또는 null
export function turnInQuest(q, qs, inv, itemDefs) {
  if (questStage(q, qs, inv) !== 'ready') return null;
  for (const [id, n] of Object.entries(q.need || {})) removeItem(inv, id, n);
  const r = q.reward || {};
  inv.coins += r.coins || 0;
  for (const [id, n] of Object.entries(r.items || {})) addItem(inv, itemDefs, id, n);
  qs[q.id] = 'done';
  return r;
}
