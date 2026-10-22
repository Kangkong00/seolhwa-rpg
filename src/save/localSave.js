// 기기 안 자동 저장 (localStorage). 아이폰이 저장소를 비울 수 있으므로
// 나중에 "저장 파일 내보내기·불러오기"를 이 파일에 추가함.

const SAVE_KEY = 'seolhwa-rpg:save:v1';
const GRID_KEY_PREFIX = 'seolhwa-rpg:grid-edit:';

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  const s = read(SAVE_KEY);
  if (!s || s.version !== 1) return null;
  return s;
}

export function writeSave(state) {
  return write(SAVE_KEY, { version: 1, savedAt: Date.now(), ...state });
}

// 격자 편집 중인 내용 (파일로 내보내기 전까지 이 기기에만 보관)
// 저장 모양: { base: 바탕이 된 저장소 격자의 해시(mapData.gridHash), rows }. 옛 모양(줄 배열만)도 그대로 돌려줌
// — 쓸지 말지는 MapScene.loadMap이 정함(docs/spec/feedback_1023.md 1)
export function loadGridEdit(mapId) {
  return read(GRID_KEY_PREFIX + mapId);
}

export function writeGridEdit(mapId, rows, base) {
  return write(GRID_KEY_PREFIX + mapId, { base, rows });
}

// 이 기기에 격자 편집이 남은 맵 id 목록
export function listGridEdits() {
  const out = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(GRID_KEY_PREFIX)) out.push(k.slice(GRID_KEY_PREFIX.length));
    }
  } catch {
    // 저장소를 못 읽는 기기: 없음
  }
  return out.sort();
}

export function clearAllGridEdits() {
  const ids = listGridEdits();
  for (const id of ids) write(GRID_KEY_PREFIX + id, null);
  return ids.length;
}

export function clearGridEdit(mapId) {
  return write(GRID_KEY_PREFIX + mapId, null);
}

// 저장 지우기(새로 시작)
export function clearSave() {
  return write(SAVE_KEY, null);
}
