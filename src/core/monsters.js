// 몬스터 생성·돌아다니기 규칙. 화면 코드를 참조하지 않음 (나중에 서버로 옮김).
// 지금은 쉬기 ↔ 4방향으로 조금 걷기만 함. 공격·쫓아오기는 단계 3 뒤에서.
import { moveStep, isStandable } from './movement.js';

const DIR_NAMES = ['up', 'down', 'left', 'right'];

function randRange([min, max], rng) {
  return min + (max - min) * rng();
}

function inZone(zone, x, y) {
  return x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h;
}

function nearPortal(portals, minDist, x, y) {
  return portals.some((p) => {
    const cx = Math.max(p.x, Math.min(x, p.x + p.w));
    const cy = Math.max(p.y, Math.min(y, p.y + p.h));
    return Math.hypot(x - cx, y - cy) < minDist;
  });
}

// 구역 안에서 설 수 있고 이동 지점과 먼 자리를 찾음. 못 찾으면 null
export function findSpawnPoint(map, zone, def, rng = Math.random, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const x = zone.x + rng() * zone.w;
    const y = zone.y + rng() * zone.h;
    if (!isStandable(map.grid, x, y, def.footBox)) continue;
    if (nearPortal(map.portals, map.noSpawnNearPortal, x, y)) continue;
    return { x, y };
  }
  return null;
}

let nextId = 1;

export function createMonster(def, zoneIndex, point, rng = Math.random) {
  return {
    id: nextId++,
    type: def.id,
    zoneIndex,
    x: point.x,
    y: point.y,
    facing: DIR_NAMES[Math.floor(rng() * 4)],
    state: 'rest',
    timer: randRange(def.restMs, rng),
    walkLeft: 0,
    moving: false,
  };
}

// 한 프레임 진행. dtMs: 지난 프레임 이후 시간
export function updateMonster(m, def, map, dtMs, rng = Math.random) {
  const zone = map.spawnZones[m.zoneIndex];
  m.moving = false;

  if (m.state === 'rest') {
    m.timer -= dtMs;
    if (m.timer <= 0) {
      m.state = 'walk';
      m.facing = DIR_NAMES[Math.floor(rng() * 4)];
      m.walkLeft = randRange(def.walkDistance, rng);
    }
    return;
  }

  // 걷기: 벽에 막히거나 구역 밖으로 나가려 하면 그 자리에서 쉬기로 돌아감
  const step = Math.min(m.walkLeft, (def.speed * dtMs) / 1000);
  const res = moveStep(map.grid, m, m.facing, step, def.footBox, 0);
  if (!res.moved || !inZone(zone, res.x, res.y)) {
    m.walkLeft = 0;
  } else {
    m.x = res.x;
    m.y = res.y;
    m.walkLeft -= step;
    m.moving = true;
  }
  if (m.walkLeft <= 0) {
    m.state = 'rest';
    m.timer = randRange(def.restMs, rng);
  }
}

// 구역별 마릿수 관리: 처음엔 가득 채우고, 줄어들면 respawnMs 뒤에 한 마리씩 다시 생김
export class MonsterSpawner {
  constructor(map, defs, rng = Math.random) {
    this.map = map;
    this.defs = defs;
    this.rng = rng;
    this.monsters = [];
    this.timers = map.spawnZones.map(() => 0);
    map.spawnZones.forEach((zone, i) => {
      for (let n = 0; n < zone.count; n++) this.spawn(i);
    });
  }

  spawn(zoneIndex) {
    const zone = this.map.spawnZones[zoneIndex];
    const def = this.defs[zone.monster];
    if (!def) return null;
    const p = findSpawnPoint(this.map, zone, def, this.rng);
    if (!p) return null;
    const m = createMonster(def, zoneIndex, p, this.rng);
    this.monsters.push(m);
    return m;
  }

  remove(m) {
    this.monsters = this.monsters.filter((x) => x !== m);
  }

  // 반환: 이번 프레임에 새로 생긴 몬스터 목록
  update(dtMs) {
    const born = [];
    this.map.spawnZones.forEach((zone, i) => {
      const alive = this.monsters.filter((m) => m.zoneIndex === i).length;
      if (alive >= zone.count) {
        this.timers[i] = 0;
        return;
      }
      this.timers[i] += dtMs;
      if (this.timers[i] >= zone.respawnMs) {
        this.timers[i] = 0;
        const m = this.spawn(i);
        if (m) born.push(m);
      }
    });
    for (const m of this.monsters) updateMonster(m, this.defs[m.type], this.map, dtMs, this.rng);
    return born;
  }
}
