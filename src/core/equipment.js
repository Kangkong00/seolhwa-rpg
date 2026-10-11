// 장비 칸·가방·엽전 규칙(화면과 무관).
// 상태: { equipped: { weapon, outfit, head, arms, feet }, bag: [{ id, n }, ...], coins }
// 빈 칸은 빈 문자열. 옷은 벗을 수 없음(늘 하나는 입고 있음).
// 겹치는 물건(def.stack)은 가방 한 칸에 n개, 장비는 한 칸에 하나(n = 1).

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
  const state = { equipped, bag: [], coins: 0 };
  // 예전 저장은 가방이 id 목록이었음 → { id, n } 로
  for (const e of src.bag) {
    const id = typeof e === 'string' ? e : e && e.id;
    const n = typeof e === 'string' ? 1 : Math.floor(e.n || 1);
    if (known(id) && n > 0) addItem(state, itemDefs, id, n);
  }
  const coins = Number(src.coins ?? start.coins ?? 0);
  state.coins = Number.isFinite(coins) && coins > 0 ? Math.floor(coins) : 0;
  return state;
}

// 가방에 넣기: 겹치는 물건은 있던 칸에 더함, 아니면 n개를 한 칸씩
export function addItem(state, itemDefs, id, n = 1) {
  const def = itemDefs[id];
  if (!def || n <= 0) return;
  if (def.stack) {
    const e = state.bag.find((x) => x.id === id);
    if (e) e.n += n;
    else state.bag.push({ id, n });
    return;
  }
  for (let i = 0; i < n; i++) state.bag.push({ id, n: 1 });
}

export function countItem(state, id) {
  return state.bag.reduce((s, e) => s + (e.id === id ? e.n : 0), 0);
}

// 가방에서 n개 빼기(모자라면 아무것도 안 하고 false)
export function removeItem(state, id, n = 1) {
  if (countItem(state, id) < n) return false;
  let left = n;
  for (let i = state.bag.length - 1; i >= 0 && left > 0; i--) {
    const e = state.bag[i];
    if (e.id !== id) continue;
    const take = Math.min(e.n, left);
    e.n -= take;
    left -= take;
    if (e.n <= 0) state.bag.splice(i, 1);
  }
  return true;
}

// 가방의 index번째 장비를 낌. 그 칸에 끼던 것은 가방의 같은 자리로. 반환: 바뀐 칸 이름 또는 null(장비가 아님)
export function equipFromBag(state, itemDefs, index) {
  const e = state.bag[index];
  const def = e && itemDefs[e.id];
  if (!def || !SLOTS.includes(def.slot)) return null;
  const old = state.equipped[def.slot];
  state.equipped[def.slot] = e.id;
  if (old) state.bag[index] = { id: old, n: 1 };
  else state.bag.splice(index, 1);
  return def.slot;
}

// 칸의 장비를 벗어 가방 끝에. 반환: 바뀐 칸 이름 또는 null(비었거나 벗을 수 없음)
export function unequip(state, slot) {
  const id = state.equipped[slot];
  if (!id || CANNOT_REMOVE.has(slot)) return null;
  state.equipped[slot] = '';
  state.bag.push({ id, n: 1 });
  return slot;
}

export function canUnequip(slot) {
  return !CANNOT_REMOVE.has(slot);
}

// 가방의 index번째 먹을 것을 하나 먹음. 반환: 회복량 계산에 쓸 use 값 또는 null
export function useFromBag(state, itemDefs, index) {
  const e = state.bag[index];
  const def = e && itemDefs[e.id];
  if (!def || !def.use) return null;
  e.n -= 1;
  if (e.n <= 0) state.bag.splice(index, 1);
  return def.use;
}
