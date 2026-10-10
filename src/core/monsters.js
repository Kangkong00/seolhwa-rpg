// 몬스터 생성·돌아다니기 규칙. 화면 코드를 참조하지 않음 (나중에 서버로 옮김).
// 평소: 쉬기 ↔ 4방향으로 조금 걷기 (먼저 덤비지 않음).
// 맞으면 반격: 주인공을 쫓아와(구역 밖도 가능) 가까우면 일정 간격으로 묾.
// 주인공이 멀어지거나(giveUpDistance) 한동안(giveUpMs) 서로 안 때리면 포기하고 구역으로 돌아감.
import { moveStep, isStandable } from './movement.js';

const DIR_NAMES = ['up', 'down', 'left', 'right'];
const KNOCK_SPEED = 160; // 맞아서 밀려나는 속도(초당 픽셀)

function towardZone(zone, x, y) {
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  if (Math.abs(cx - x) > Math.abs(cy - y)) return cx > x ? 'right' : 'left';
  return cy > y ? 'down' : 'up';
}

function randRange([min, max], rng) {
  return min + (max - min) * rng();
}

// roam: "map"이면 맵 전체(갈 수 있는 칸 전부)를 돌아다님, 아니면 구역 사각형 안에서만
function inZone(zone, x, y) {
  if (zone.roam === 'map') return true;
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
    hp: def.hp,
    maxHp: def.hp,
    // 맞았을 때: 밀려날 남은 거리·방향, 잠깐 멈춤
    knockLeft: 0,
    knockDir: null,
    stunMs: 0,
    // 반격
    aggro: false,
    calmMs: 0, // 서로 안 때린 시간
    biteCooldown: 0,
    biteMs: 0, // 무는 동작 남은 시간 (그림: 튀어나갔다 돌아옴)
    bitePending: false,
  };
}

// 주인공 쪽으로 4방향 중 하나 (가로·세로 중 더 먼 쪽 먼저)
function towardPoint(m, tx, ty) {
  const dx = tx - m.x;
  const dy = ty - m.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

function otherAxis(m, tx, ty, dir) {
  if (dir === 'left' || dir === 'right') return ty > m.y ? 'down' : 'up';
  return tx > m.x ? 'right' : 'left';
}

// 막히면 다른 축으로 비켜 감
function stepToward(m, def, map, tx, ty, dist) {
  const first = towardPoint(m, tx, ty);
  for (const dir of [first, otherAxis(m, tx, ty, first)]) {
    const res = moveStep(map.grid, m, dir, dist, def.footBox, 2);
    if (res.moved) {
      m.x = res.x;
      m.y = res.y;
      m.facing = dir;
      m.moving = true;
      return true;
    }
  }
  return false;
}

// 반격 중 한 프레임. 반환: 이번 프레임에 문 경우 { type: 'bite', damage } 아니면 null
function updateAggro(m, def, map, dtMs, target) {
  const dist = Math.hypot(target.x - m.x, target.y - m.y);
  m.calmMs += dtMs;
  if (!target.alive || dist > def.giveUpDistance || m.calmMs > def.giveUpMs) {
    m.aggro = false;
    m.state = 'rest';
    m.timer = 300;
    return null;
  }
  m.biteCooldown = Math.max(0, m.biteCooldown - dtMs);

  // 무는 중: 동작 절반에서 실제로 닿는지 판정
  if (m.biteMs > 0) {
    m.biteMs -= dtMs;
    if (m.bitePending && m.biteMs <= def.biteMs / 2) {
      m.bitePending = false;
      if (dist <= def.biteRange + 6) {
        m.calmMs = 0;
        return { type: 'bite', damage: def.biteDamage, dir: m.facing };
      }
    }
    return null;
  }

  if (dist <= def.biteRange) {
    m.facing = towardPoint(m, target.x, target.y);
    if (m.biteCooldown <= 0) {
      m.biteMs = def.biteMs;
      m.bitePending = true;
      m.biteCooldown = def.biteCooldownMs;
    }
    return null;
  }
  stepToward(m, def, map, target.x, target.y, (def.chaseSpeed * dtMs) / 1000);
  return null;
}

// 맞았을 때 반격 시작 (combat.js에서 부름)
export function provoke(m) {
  m.aggro = true;
  m.calmMs = 0;
}

// 한 프레임 진행. dtMs: 지난 프레임 이후 시간, target: 주인공 { x, y, alive }
// 반환: 무는 데 성공했으면 { type: 'bite', damage, dir }, 아니면 null
export function updateMonster(m, def, map, dtMs, target, rng = Math.random) {
  const zone = map.spawnZones[m.zoneIndex];
  m.moving = false;

  // 맞아서 밀려나는 중: 벽은 통과하지 않음, 구역 밖으로는 조금 밀려나도 됨
  if (m.knockLeft > 0) {
    const step = Math.min(m.knockLeft, (KNOCK_SPEED * dtMs) / 1000);
    const res = moveStep(map.grid, m, m.knockDir, step, def.footBox, 0);
    m.x = res.x;
    m.y = res.y;
    m.knockLeft = res.moved ? m.knockLeft - step : 0;
  }
  if (m.stunMs > 0) {
    m.stunMs -= dtMs;
    m.biteMs = 0;
    m.bitePending = false;
    return null;
  }
  if (m.aggro && target) return updateAggro(m, def, map, dtMs, target);

  // 구역 밖(밀려났거나 쫓아갔다 포기함)이면 구역 쪽으로 돌아감
  if (!inZone(zone, m.x, m.y)) {
    const cx = zone.x + zone.w / 2;
    const cy = zone.y + zone.h / 2;
    if (!stepToward(m, def, map, cx, cy, (def.speed * dtMs) / 1000)) {
      // 벽에 걸려 못 가면 잠깐 아무 쪽으로 걸어 봄
      m.state = 'walk';
      m.facing = DIR_NAMES[Math.floor(rng() * 4)];
      m.walkLeft = 16;
    } else {
      return null;
    }
  }

  if (m.state === 'rest') {
    m.timer -= dtMs;
    if (m.timer <= 0) {
      m.state = 'walk';
      m.facing = DIR_NAMES[Math.floor(rng() * 4)];
      m.walkLeft = randRange(def.walkDistance, rng);
    }
    return null;
  }

  // 걷기: 벽에 막히거나 구역 밖으로 나가려 하면 그 자리에서 쉬기로 돌아감
  const step = Math.min(m.walkLeft, (def.speed * dtMs) / 1000);
  const res = moveStep(map.grid, m, m.facing, step, def.footBox, 0);
  const wasInside = inZone(zone, m.x, m.y);
  if (!res.moved || (wasInside && !inZone(zone, res.x, res.y))) {
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
  return null;
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

  // target: 주인공 { x, y, alive }
  // 반환: { born: 새로 생긴 몬스터, bites: [{ monster, damage, dir }] }
  update(dtMs, target) {
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
    const bites = [];
    for (const m of this.monsters) {
      const ev = updateMonster(m, this.defs[m.type], this.map, dtMs, target, this.rng);
      if (ev) bites.push({ monster: m, ...ev });
    }
    return { born, bites };
  }
}
