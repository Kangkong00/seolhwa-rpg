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
export function loadGridEdit(mapId) {
  return read(GRID_KEY_PREFIX + mapId);
}

export function writeGridEdit(mapId, rows) {
  return write(GRID_KEY_PREFIX + mapId, rows);
}

export function clearGridEdit(mapId) {
  return write(GRID_KEY_PREFIX + mapId, null);
}
