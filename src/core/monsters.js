// 몬스터 생성·돌아다니기 규칙. 화면 코드를 참조하지 않음 (나중에 서버로 옮김).
// 평소: 쉬기 ↔ 4방향으로 조금 걷기 (먼저 덤비지 않음).
// 맞으면 반격: 주인공을 쫓아와(구역 밖도 가능) 가까우면 일정 간격으로 묾.
// 주인공이 멀어지거나(giveUpDistance) 한동안(giveUpMs) 서로 안 때리면 포기하고 구역으로 돌아감.
// 돌진(def.charge, 곳간 쥐왕): 반격 중 everyMs마다 windupMs 동안 웅크려 예고한 뒤 주인공 쪽으로 distance만큼 빠르게 돌진,
// 돌진 중 닿으면 damage + 밀려남(knockbackPx).
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

// 잠긴 출구(unlockOnKill — 쥐왕의 방 '마을로')는 우두머리 바로 앞에 있으므로 따지지 않음
function nearPortal(portals, minDist, x, y) {
  return portals.some((p) => {
    if (p.unlockOnKill) return false;
    const cx = Math.max(p.x, Math.min(x, p.x + p.w));
    const cy = Math.max(p.y, Math.min(y, p.y + p.h));
    return Math.hypot(x - cx, y - cy) < minDist;
  });
}

// 몸 반경(docs/spec/feedback_1020.md 2): 키의 약 20%, 최소 4px → 발밑 충돌 상자(가로 2r × 세로 r)
export function bodyBox(def) {
  const r = Math.max(4, def.height * 0.2);
  return { w: r * 2, h: Math.max(4, r) };
}

// 주인공이 갈 수 있는 곳과 이어진 칸인지(reach = grid.connectedFrom 결과, 없으면 따지지 않음)
export function inReach(map, reach, x, y) {
  if (!reach) return true;
  const { c, r } = map.grid.cellAt(x, y);
  return !!reach[r * map.grid.cols + c];
}

// 몬스터가 설 수 있는 자리: 몸 상자가 막히지 않고, 주인공이 갈 수 있는 곳과 이어진 칸
export function canStand(map, reach, def, x, y) {
  return isStandable(map.grid, x, y, def.footBox) && inReach(map, reach, x, y);
}

// 구역 안에서 설 수 있고 이동 지점과 먼 자리를 찾음. 10번 무작위로 골라 안 되면 구역 안에서 가운데와 가장 가까운 설 수 있는 칸. 못 찾으면 null
export function findSpawnPoint(map, zone, def, rng = Math.random, reach = null, tries = 10) {
  for (let i = 0; i < tries; i++) {
    const x = zone.x + rng() * zone.w;
    const y = zone.y + rng() * zone.h;
    if (!canStand(map, reach, def, x, y)) continue;
    if (nearPortal(map.portals, map.noSpawnNearPortal, x, y)) continue;
    return { x, y };
  }
  const cs = map.grid.cellSize;
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  let best = null;
  let bestD = Infinity;
  for (let y = zone.y + cs / 2; y < zone.y + zone.h; y += cs) {
    for (let x = zone.x + cs / 2; x < zone.x + zone.w; x += cs) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d >= bestD || !canStand(map, reach, def, x, y)) continue;
      if (nearPortal(map.portals, map.noSpawnNearPortal, x, y)) continue;
      best = { x, y };
      bestD = d;
    }
  }
  return best;
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
    superArmor: !!def.boss, // 우두머리: 맞아도 멈칫하지 않음(combat.hitMonster)
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
    // 돌진(def.charge가 있는 몬스터만): chargeState = null | 'windup' | 'dash'
    chargeTimer: def.charge ? def.charge.everyMs : 0,
    chargeState: null,
    chargeMs: 0,
    chargeLeft: 0,
    chargeVec: null,
    chargeHit: false,
    // 웅크렸다 물기(물뱀, def.biteWindupMs): 무는 동작 전 웅크리는 남은 시간
    biteWindup: 0,
    // 특기(def.moves — 우두머리·여우·멧돼지·곰 등, docs/spec/tier4_9.md 3): 기술마다 남은 시간,
    // move = 하는 중 { i, state: 'windup' | 'act', ms, hitsLeft }, moveCount = 쓴 횟수(그림·소리용), moveLast = 마지막에 쓴 기술 번호
    moveTimers: (def.moves || []).map((mv) => mv.firstMs ?? mv.everyMs * 0.5),
    move: null,
    moveCount: 0,
    moveLast: -1,
    // 맞은 횟수(너구리 순간이동·늑대 물러서기가 봄), 물러서는 남은 시간(늑대)
    hitCount: 0,
    hitSeen: 0,
    retreatMs: 0,
    blinkCount: 0,
    blinkFrom: null,
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

// 돌진 한 프레임(c = def.charge 또는 특기 charge). 반환: 닿았으면 { type: 'bite', damage, dir, knockbackPx }
// c.untilWall이면 벽에 부딪힐 때까지 달리고, 부딪히면 wallStunMs 동안 멈칫(산저 — 때릴 기회)
function updateCharge(m, c, def, map, dtMs, target) {
  if (m.chargeState === 'windup') {
    m.chargeMs -= dtMs;
    if (m.chargeMs <= 0) {
      // 예고가 끝난 순간 주인공 쪽으로 방향을 정해 돌진
      const dx = target.x - m.x;
      const dy = target.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      m.chargeVec = { x: dx / d, y: dy / d };
      m.chargeState = 'dash';
      m.chargeLeft = c.distance;
      m.chargeHit = false;
    }
    return null;
  }
  // dash: 가로·세로를 나눠 벽을 피해 움직임
  const step = Math.min(m.chargeLeft, (c.speed * dtMs) / 1000);
  let moved = false;
  const sx = m.chargeVec.x * step;
  const sy = m.chargeVec.y * step;
  if (Math.abs(sx) > 0.01) {
    const r = moveStep(map.grid, m, sx < 0 ? 'left' : 'right', Math.abs(sx), def.footBox, 0);
    if (r.moved) { m.x = r.x; m.y = r.y; moved = true; }
  }
  if (Math.abs(sy) > 0.01) {
    const r = moveStep(map.grid, m, sy < 0 ? 'up' : 'down', Math.abs(sy), def.footBox, 0);
    if (r.moved) { m.x = r.x; m.y = r.y; moved = true; }
  }
  m.moving = moved;
  m.facing = Math.abs(m.chargeVec.x) > Math.abs(m.chargeVec.y) ? (m.chargeVec.x < 0 ? 'left' : 'right') : m.chargeVec.y < 0 ? 'up' : 'down';
  m.chargeLeft -= step;
  let ev = null;
  if (!m.chargeHit && Math.hypot(target.x - m.x, target.y - m.y) <= c.hitRadius) {
    m.chargeHit = true;
    m.calmMs = 0;
    ev = { type: 'bite', damage: c.damage, dir: m.facing, knockbackPx: c.knockbackPx };
  }
  if (!moved || m.chargeLeft <= 0) {
    m.chargeState = null;
    if (!moved && c.wallStunMs) {
      m.stunMs = c.wallStunMs;
      m.wallHits = (m.wallHits || 0) + 1;
    }
    if (c === def.charge) m.chargeTimer = c.everyMs;
    else m.move = null;
  }
  return ev;
}

// 성남(def.enrage): 체력이 below 아래면 공격 간격 intervalMul배(짧게)
export function isEnraged(m, def) {
  return !!(def.enrage && m.hp > 0 && m.hp < m.maxHp * def.enrage.below);
}

function attackInterval(m, def, ms) {
  return isEnraged(m, def) ? ms * def.enrage.intervalMul : ms;
}

const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// 몬스터 → 주인공 쪽 4방향(밀려나는 쪽)
function dirToward(m, target) {
  const dx = target.x - m.x;
  const dy = target.y - m.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}

// 범위 공격이 닿는지: shape 'front'면 바라보는 쪽 반원, 'full'이면 원 전체(반경 radius)
function inSweep(m, mv, target) {
  const dx = target.x - m.x;
  const dy = target.y - m.y;
  if (Math.hypot(dx, dy) > mv.radius) return false;
  if (mv.shape === 'full') return true;
  const [fx, fy] = VEC[m.facing];
  return dx * fx + dy * fy >= -6;
}

// 특기 실행(예고가 끝난 순간). kind별:
//  sweep  — 범위 공격(꼬리 휘두르기·내려찍기·충격파·발톱 연타 hits번)
//  charge — 돌진(updateCharge로 넘김)
//  summon — 같은 편 부르기(울부짖음: monster를 count마리, 함께 있는 수 max까지)
//  clones — 분신(체력 1, 맞으면 연기로 사라짐, 보상 없음)
//  shoot  — 여우불 날리기(count개를 부채꼴 spreadDeg로, speed·life·radius·damage)
//  roar   — 포효(반경 안이면 rootMs 동안 못 움직임 + damage)
// 반환: { ev: 주인공에게 닿은 일(없으면 null), spawn: [{ type, clone }], shots: [...] }
function actMove(m, def, mv, target) {
  const out = { ev: null, spawn: [], shots: [] };
  if (mv.kind === 'sweep') {
    if (inSweep(m, mv, target)) {
      m.calmMs = 0;
      out.ev = { type: 'bite', damage: mv.damage, dir: dirToward(m, target), knockbackPx: mv.knockbackPx || 0 };
    }
  } else if (mv.kind === 'summon') {
    for (let i = 0; i < mv.count; i++) out.spawn.push({ type: mv.monster, clone: false });
  } else if (mv.kind === 'clones') {
    for (let i = 0; i < mv.count; i++) out.spawn.push({ type: m.type, clone: true });
  } else if (mv.kind === 'shoot') {
    const base = Math.atan2(target.y - m.y, target.x - m.x);
    const spread = ((mv.spreadDeg || 0) * Math.PI) / 180;
    for (let i = 0; i < mv.count; i++) {
      const a = mv.count > 1 ? base - spread / 2 + (spread * i) / (mv.count - 1) : base;
      out.shots.push({ x: m.x, y: m.y - def.height * 0.4, vx: Math.cos(a) * mv.speed, vy: Math.sin(a) * mv.speed, life: mv.life, radius: mv.radius, damage: mv.damage, color: mv.color, owner: m.id });
    }
  } else if (mv.kind === 'roar') {
    if (Math.hypot(target.x - m.x, target.y - m.y) <= mv.radius) {
      m.calmMs = 0;
      out.ev = { type: 'bite', damage: mv.damage || 0, dir: dirToward(m, target), knockbackPx: 0, rootMs: mv.rootMs };
    }
  }
  return out;
}

// 특기 한 프레임(하는 중). 반환: actMove 꼴 또는 null
function updateMove(m, def, map, dtMs, target) {
  const mv = def.moves[m.move.i];
  if (m.move.state === 'charge') {
    const ev = updateCharge(m, mv, def, map, dtMs, target);
    return ev ? { ev, spawn: [], shots: [] } : null;
  }
  m.move.ms -= dtMs;
  if (m.move.ms > 0) return null;
  if (m.move.state === 'windup') {
    m.moveCount += 1;
    m.moveLast = m.move.i;
    if (mv.kind === 'charge') {
      // 돌진은 예고를 move가 했으므로 바로 달림
      m.move.state = 'charge';
      m.chargeState = 'windup';
      m.chargeMs = 0;
      return null;
    }
    m.move.state = 'act';
    m.move.hitsLeft = (mv.hits || 1) - 1;
    const out = actMove(m, def, mv, target);
    if (m.move.hitsLeft <= 0) m.move = null;
    else m.move.ms = mv.gapMs || 200;
    return out;
  }
  // 연타(발톱 3연타): gapMs마다 한 번 더
  m.moveCount += 1;
  m.move.hitsLeft -= 1;
  const out = actMove(m, def, mv, target);
  if (m.move.hitsLeft <= 0) m.move = null;
  else m.move.ms = mv.gapMs || 200;
  return out;
}

// 반격 중 한 프레임. 반환: { ev, spawn, shots } 또는 null
function updateAggro(m, def, map, dtMs, target) {
  const dist = Math.hypot(target.x - m.x, target.y - m.y);
  m.calmMs += dtMs;
  if (!target.alive || dist > def.giveUpDistance || m.calmMs > def.giveUpMs) {
    if (m.clone) m.hp = 0; // 분신은 포기하면 사라짐
    m.aggro = false;
    m.state = 'rest';
    m.timer = 300;
    m.chargeState = null;
    m.move = null;
    m.biteWindup = 0;
    m.retreatMs = 0;
    return null;
  }
  m.biteCooldown = Math.max(0, m.biteCooldown - dtMs);
  // 물러서기(늑대): 맞으면 retreatMs 동안 주인공 반대쪽으로 물러섰다가 다시 달려듦
  if (m.retreatMs > 0) {
    m.retreatMs -= dtMs;
    const away = { x: m.x * 2 - target.x, y: m.y * 2 - target.y };
    stepToward(m, def, map, away.x, away.y, ((def.retreatOnHit.speed || def.chaseSpeed) * dtMs) / 1000);
    m.facing = towardPoint(m, target.x, target.y);
    return null;
  }
  // 돌진: 무는 중이 아닐 때 everyMs마다, 주인공이 range 안이면 웅크려 예고 → 돌진
  if (def.charge) {
    if (m.chargeState) {
      const ev = updateCharge(m, def.charge, def, map, dtMs, target);
      return ev ? { ev, spawn: [], shots: [] } : null;
    }
    m.chargeTimer -= dtMs;
    if (m.chargeTimer <= 0 && m.biteMs <= 0 && dist <= def.charge.range) {
      m.chargeState = 'windup';
      m.chargeMs = def.charge.windupMs;
      m.facing = towardPoint(m, target.x, target.y);
      return null;
    }
  }

  // 특기: 하는 중이면 계속, 아니면 준비된 것(가까운 range 안) 하나를 골라 예고
  if (def.moves) {
    if (m.move) return updateMove(m, def, map, dtMs, target);
    def.moves.forEach((mv, i) => { m.moveTimers[i] -= dtMs; });
    if (m.biteMs <= 0 && m.biteWindup <= 0) {
      const i = def.moves.findIndex((mv, k) => m.moveTimers[k] <= 0 && dist <= mv.range && (!mv.minRange || dist >= mv.minRange));
      if (i >= 0) {
        const mv = def.moves[i];
        m.moveTimers[i] = attackInterval(m, def, mv.everyMs);
        m.move = { i, state: 'windup', ms: mv.windupMs, hitsLeft: 0 };
        m.facing = towardPoint(m, target.x, target.y);
        return null;
      }
    }
  }

  // 웅크리는 중(물뱀): 끝나면 앞으로 튀어 묾
  if (m.biteWindup > 0) {
    m.biteWindup -= dtMs;
    if (m.biteWindup <= 0) {
      m.biteMs = def.biteMs;
      m.bitePending = true;
    }
    return null;
  }

  // 무는 중: 동작 절반에서 실제로 닿는지 판정
  if (m.biteMs > 0) {
    m.biteMs -= dtMs;
    if (m.bitePending && m.biteMs <= def.biteMs / 2) {
      m.bitePending = false;
      if (dist <= def.biteRange + 6) {
        m.calmMs = 0;
        return { ev: { type: 'bite', damage: m.clone ? Math.ceil(def.biteDamage / 2) : def.biteDamage, dir: m.facing }, spawn: [], shots: [] };
      }
    }
    return null;
  }

  if (dist <= def.biteRange) {
    m.facing = towardPoint(m, target.x, target.y);
    if (m.biteCooldown <= 0) {
      m.biteCooldown = attackInterval(m, def, def.biteCooldownMs);
      if (def.biteWindupMs) {
        m.biteWindup = def.biteWindupMs;
      } else {
        m.biteMs = def.biteMs;
        m.bitePending = true;
      }
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

// 맞은 뒤 한 번(맞은 횟수가 늘었을 때): 너구리 순간이동(blinkOnHit), 늑대 물러서기(retreatOnHit)
function reactToHit(m, def, map, rng, reach) {
  if (m.hitCount === m.hitSeen) return;
  m.hitSeen = m.hitCount;
  if (m.hp <= 0) return;
  if (def.retreatOnHit) m.retreatMs = def.retreatOnHit.ms;
  const b = def.blinkOnHit;
  if (b && rng() < (b.chance ?? 1)) {
    // 바라보는 쪽과 직각으로 distance만큼(양쪽 중 설 수 있는 곳)
    const side = m.facing === 'left' || m.facing === 'right' ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
    if (rng() < 0.5) side.reverse();
    for (const [sx, sy] of side) {
      const x = m.x + sx * b.distance;
      const y = m.y + sy * b.distance;
      if (canStand(map, reach, def, x, y)) {
        m.blinkFrom = { x: m.x, y: m.y };
        m.x = x;
        m.y = y;
        m.knockLeft = 0;
        m.blinkCount += 1;
        break;
      }
    }
  }
}

// 한 프레임 진행. dtMs: 지난 프레임 이후 시간, target: 주인공 { x, y, alive }
// 반환: 무엇이 일어났는지 { ev: 주인공에게 닿은 일, spawn, shots } 또는 null
export function updateMonster(m, def, map, dtMs, target, rng = Math.random, reach = null) {
  const zone = map.spawnZones[m.zoneIndex];
  m.moving = false;
  reactToHit(m, def, map, rng, reach);

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
    m.biteWindup = 0;
    if (m.chargeState === 'windup') m.chargeState = null;
    // 예고 중이던 특기는 끊김(조금 뒤 다시)
    if (m.move && m.move.state === 'windup') {
      m.moveTimers[m.move.i] = def.moves[m.move.i].everyMs * 0.4;
      m.move = null;
    }
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
  const res = moveStep(map.grid, m, m.facing, step, def.footBox, 2); // 모서리는 조금 비켜 지나감
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

// 날아가는 것(여우불) 한 프레임: 움직이고, 벽·수명이면 사라지고, 주인공에 닿으면 데미지.
// 반환: 닿은 일 [{ damage, dir }]
function updateShots(shots, map, dtMs, target) {
  const hits = [];
  for (const s of shots) {
    s.x += (s.vx * dtMs) / 1000;
    s.y += (s.vy * dtMs) / 1000;
    s.life -= dtMs;
    if (s.life <= 0 || map.grid.isPointBlocked(s.x, s.y + 20)) s.dead = true;
    else if (target.alive && Math.hypot(target.x - s.x, target.y - 20 - s.y) <= s.radius + 8) {
      s.dead = true;
      hits.push({ damage: s.damage, dir: Math.abs(s.vx) > Math.abs(s.vy) ? (s.vx < 0 ? 'left' : 'right') : s.vy < 0 ? 'up' : 'down', knockbackPx: 6, shot: true });
    }
  }
  return hits;
}

let nextShotId = 1;

// 구역별 마릿수 관리: 처음엔 가득 채우고, 줄어들면 respawnMs 뒤에 한 마리씩 다시 생김.
// 부른 것(summoned)·분신(clone)은 구역 마릿수에 세지 않음
export class MonsterSpawner {
  constructor(map, defs, rng = Math.random) {
    this.map = map;
    this.defs = defs;
    this.rng = rng;
    // 몸 반경으로 막힘 검사(데이터의 footBox 대신, 한 번만)
    for (const d of Object.values(defs)) {
      if (d._bodyBox) continue;
      d.footBox = bodyBox(d);
      d._bodyBox = true;
    }
    // 주인공이 갈 수 있는 곳(시작 자리와 이어진 칸): 몬스터는 여기에서만 생기고 순간이동함
    this.reach = map.grid.connectedFrom(map.spawn.x, map.spawn.y - 2);
    if (!this.reach.some((v) => v)) this.reach = null; // 시작 자리가 막힌 칸이면 따지지 않음
    this.monsters = [];
    this.shots = []; // 날아가는 여우불 { id, x, y, vx, vy, life, radius, damage, color }
    this.timers = map.spawnZones.map(() => 0);
    map.spawnZones.forEach((zone, i) => {
      for (let n = 0; n < zone.count; n++) this.spawn(i);
    });
  }

  spawn(zoneIndex) {
    const zone = this.map.spawnZones[zoneIndex];
    const def = this.defs[zone.monster];
    if (!def) return null;
    const p = findSpawnPoint(this.map, zone, def, this.rng, this.reach);
    if (!p) return null;
    const m = createMonster(def, zoneIndex, p, this.rng);
    this.monsters.push(m);
    return m;
  }

  // 구역에 세는 마릿수(부른 것·분신 빼고)
  zoneCount(i) {
    return this.monsters.filter((m) => m.zoneIndex === i && !m.extra).length;
  }

  // 우두머리 둘레에 부른 것·분신을 세움(설 수 있는 곳, 바로 반격 상태)
  spawnNear(owner, type, clone) {
    const def = this.defs[type];
    if (!def) return null;
    const limitOf = (o) => this.monsters.filter((m) => m.ownerId === o.id).length;
    const ownerDef = this.defs[owner.type];
    const mv = (ownerDef.moves || []).find((x) => (clone ? x.kind === 'clones' : x.kind === 'summon'));
    if (mv && mv.max && limitOf(owner) >= mv.max) return null;
    for (let k = 0; k < 12; k++) {
      const a = this.rng() * Math.PI * 2;
      const r = 28 + this.rng() * 30;
      const x = owner.x + Math.cos(a) * r;
      const y = owner.y + Math.sin(a) * r * 0.6;
      if (!canStand(this.map, this.reach, def, x, y)) continue;
      const m = createMonster(def, owner.zoneIndex, { x, y }, this.rng);
      m.extra = true;
      m.ownerId = owner.id;
      if (clone) {
        m.clone = true;
        m.hp = 1;
        m.maxHp = 1;
        m.moves = null;
        m.moveTimers = m.moveTimers.map(() => Infinity); // 분신은 특기를 쓰지 않음
      }
      provoke(m);
      this.monsters.push(m);
      return m;
    }
    return null;
  }

  remove(m) {
    this.monsters = this.monsters.filter((x) => x !== m);
  }

  // 구역마다 모자란 만큼 바로 채움(type을 주면 그 몬스터 구역만). 반환: 새로 생긴 몬스터
  fill(type = null) {
    const born = [];
    this.map.spawnZones.forEach((zone, i) => {
      if (type && zone.monster !== type) return;
      let alive = this.zoneCount(i);
      for (; alive < zone.count; alive++) {
        const m = this.spawn(i);
        if (m) born.push(m);
      }
      this.timers[i] = 0;
    });
    return born;
  }

  // 모두 지우고 처음처럼 다시 채움. 반환: { removed, born }
  reset() {
    const removed = this.monsters;
    this.monsters = [];
    this.shots = [];
    return { removed, born: this.fill() };
  }

  // target: 주인공 { x, y, alive }
  // 반환: { born: 새로 생긴 몬스터, bites: [{ monster, damage, dir, knockbackPx, rootMs }], gone: 사라진 분신 }
  update(dtMs, target) {
    const born = [];
    this.map.spawnZones.forEach((zone, i) => {
      if (this.zoneCount(i) >= zone.count) {
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
    for (const m of [...this.monsters]) {
      const def = this.defs[m.type];
      const out = updateMonster(m, def, this.map, dtMs, target, this.rng, this.reach);
      if (!out) continue;
      if (out.ev) bites.push({ monster: m, ...out.ev });
      for (const sp of out.spawn || []) {
        const b = this.spawnNear(m, sp.type, sp.clone);
        if (b) born.push(b);
      }
      for (const sh of out.shots || []) this.shots.push({ id: nextShotId++, ...sh });
    }
    // 무리(들개): 하나가 덤비면 pack.radius 안 같은 종류도 함께 덤빔
    for (const m of this.monsters) {
      const pack = this.defs[m.type].pack;
      if (!pack || !m.aggro) continue;
      for (const o of this.monsters) {
        if (o !== m && !o.aggro && o.type === m.type && Math.hypot(o.x - m.x, o.y - m.y) <= pack.radius) provoke(o);
      }
    }
    for (const h of updateShots(this.shots, this.map, dtMs, target)) bites.push({ monster: null, ...h });
    this.shots = this.shots.filter((s) => !s.dead);
    // 포기한 분신은 사라짐
    const gone = this.monsters.filter((m) => m.clone && m.hp <= 0);
    if (gone.length) this.monsters = this.monsters.filter((m) => !gone.includes(m));
    return { born, bites, gone };
  }
}
