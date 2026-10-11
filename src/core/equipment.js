// 장비 칸과 가방 규칙(화면과 무관). 상태: { equipped: { weapon, outfit, head, arms, feet }, bag: [id, ...] }
// 빈 칸은 빈 문자열. 옷은 벗을 수 없음(늘 하나는 입고 있음).

export const SLOTS = ['weapon', 'outfit', 'head', 'arms', 'feet'];
const CANNOT_REMOVE = new Set(['outfit']);

// 저장된 상태가 있으면 그것을(모르는 아이템은 빼고), 없으면 시작 상태를 복사
export function createEquipment(itemDefs, start, saved = null) {
  const src = saved && saved.equipped && Array.isArray(saved.bag) ? saved : start;
  const known = (id) => typeof id === 'string' && !!itemDefs[id];
  const equipped = {};
  for (const slot of SLOTS) {
    const id = src.equipped[slot];
    equipped[slot] = known(id) && itemDefs[id].slot === slot ? id : '';
  }
  if (!equipped.outfit) equipped.outfit = start.equipped.outfit;
  const bag = src.bag.filter(known);
  return { equipped, bag };
}

// 가방의 index번째 아이템을 낌. 그 칸에 끼던 것은 가방의 같은 자리로. 반환: 바뀐 칸 이름 또는 null
export function equipFromBag(state, itemDefs, index) {
  const id = state.bag[index];
  const def = id && itemDefs[id];
  if (!def || !SLOTS.includes(def.slot)) return null;
  const old = state.equipped[def.slot];
  state.equipped[def.slot] = id;
  if (old) state.bag[index] = old;
  else state.bag.splice(index, 1);
  return def.slot;
}

// 칸의 장비를 벗어 가방 끝에. 반환: 바뀐 칸 이름 또는 null(비었거나 벗을 수 없음)
export function unequip(state, slot) {
  const id = state.equipped[slot];
  if (!id || CANNOT_REMOVE.has(slot)) return null;
  state.equipped[slot] = '';
  state.bag.push(id);
  return slot;
}

export function canUnequip(slot) {
  return !CANNOT_REMOVE.has(slot);
}
