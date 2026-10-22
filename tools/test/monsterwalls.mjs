// 벽 위 몬스터 시험(docs/spec/feedback_1022.md 3) — 브라우저 없이 규칙 코드(src/core)만으로.
// 맵마다 몬스터를 모두 띄워 60초(게임 시간) 돌리며 가짜 주인공이 돌아다니고, 2초마다 가까운 몬스터를 때려
// 밀어내기(평타·무예)·끌어당김(회오리 베기)·반격·우두머리 특기·순간이동·물러서기·무리까지 섞음.
// 몬스터 막힘 상자가 막힌 칸에 걸린 순간을 몬스터·움직임 종류와 함께 셈. 0건이어야 함.
// 쓰는 법: node tools/test/monsterwalls.mjs [맵 id ...] [--sec 60] [--seed 1]
import { readFileSync, readdirSync } from 'node:fs';
import { parseMap } from '../../src/core/mapData.js';
import { isStandable } from '../../src/core/movement.js';
import { MonsterSpawner } from '../../src/core/monsters.js';
import { hitMonster } from '../../src/core/combat.js';

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root)));
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? Number(argv[argv.indexOf(k) + 1]) : d);
const SEC = opt('--sec', 60);
let seed = opt('--seed', 1);
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const game = read('data/game.json');
const monstersJson = read('data/monsters.json');
const ids = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const maps = ids.length ? ids : readdirSync(new URL('data/maps/', root)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const DT = 16;
const DIRS = ['up', 'down', 'left', 'right'];
const box = game.player.footBox;

// 움직임 종류(한 프레임에 무엇을 하고 있었나)
function kindOf(m, def) {
  if (m.knockLeft > 0) return 'knock';
  if (m.move && m.move.state) return `move:${(def && def.moves && def.moves[m.move.i] && def.moves[m.move.i].kind) || '?'}:${m.move.state}`;
  if (m.blinkFrom) return 'blink';
  if (m.aggro) return 'chase';
  return m.state || 'idle';
}

const rows = [];
let total = 0;
for (const id of maps) {
  const json = read(`data/maps/${id}.json`);
  if (!json.spawnZones || !json.spawnZones.length) continue;
  const map = parseMap(json);
  // 맵을 바꿀 때마다 새 정의(footBox를 바꿔 넣으므로)
  const defs = Object.fromEntries(read('data/monsters.json').monsters.map((d) => [d.id, d]));
  const sp = new MonsterSpawner(map, defs, rng, monstersJson.bodyBox);
  const bad = new Map(); // "type kind" → 횟수
  const seen = new Map(); // 움직임 종류 → 프레임 수(시험이 정말 그 움직임을 지났는지)
  let moved = 0;
  const note = (m, kind) => {
    const k = `${m.type} ${kind}`;
    bad.set(k, (bad.get(k) || 0) + 1);
  };
  for (const m of sp.monsters) if (!isStandable(map.grid, m.x, m.y, defs[m.type].footBox)) note(m, 'spawn');
  const p = { x: map.spawn.x, y: map.spawn.y, alive: true };
  let goal = null;
  let hitT = 0;
  for (let t = 0; t < SEC * 1000; t += DT) {
    // 가짜 주인공: 2초마다 아무 몬스터 옆(설 수 있는 곳)으로 가서 둘레 80px 몬스터를 때림
    // 반은 밀어내기(평타·무예), 반은 끌어당김(회오리 베기)
    hitT += DT;
    if (hitT >= 2000) {
      hitT = 0;
      const ms = sp.monsters;
      goal = ms.length ? ms[Math.floor(rng() * ms.length)] : null;
      if (goal) {
        for (let r = 20; r < 120; r += 6) {
          const a = rng() * Math.PI * 2;
          const x = goal.x + Math.cos(a) * r;
          const y = goal.y + Math.sin(a) * r * 0.6;
          if (isStandable(map.grid, x, y, box)) { p.x = x; p.y = y; break; }
        }
      }
      const pull = rng() < 0.5;
      for (const m of sp.monsters) {
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d > 80) continue;
        m.hp = m.maxHp = 1e9;
        const away = Math.abs(m.x - p.x) > Math.abs(m.y - p.y) ? (m.x > p.x ? 'right' : 'left') : m.y > p.y ? 'down' : 'up';
        const toward = { left: 'right', right: 'left', up: 'down', down: 'up' }[away];
        hitMonster(m, pull ? toward : away, 1, pull ? 10 : 18 + rng() * 20, 300);
      }
    }
    const before = new Map(sp.monsters.map((m) => [m.id, kindOf(m, defs[m.type])]));
    const { born } = sp.update(DT, p);
    for (const m of born) if (!isStandable(map.grid, m.x, m.y, defs[m.type].footBox)) note(m, 'spawn');
    for (const m of sp.monsters) {
      m.hp = Math.max(m.hp, 1); // 쓰러지지 않게
      const k = kindOf(m, defs[m.type]).split(':').slice(0, 2).join(':');
      seen.set(k, (seen.get(k) || 0) + 1);
      if (m.moving) moved++;
      if (!isStandable(map.grid, m.x, m.y, defs[m.type].footBox)) note(m, `${before.get(m.id) || 'new'}→${kindOf(m, defs[m.type])}`);
    }
  }
  const n = [...bad.values()].reduce((a, b) => a + b, 0);
  total += n;
  const types = [...new Set(sp.monsters.map((m) => m.type))].map((t) => `${t} ${defs[t].footBox.w}×${defs[t].footBox.h}`).join(', ');
  rows.push(`| ${id} | ${sp.monsters.length} | ${types} | ${[...seen.keys()].sort().join(' ')} | ${n} | ${n ? [...bad.entries()].map(([k, v]) => `${k} ${v}`).join('; ') : '-'} |`);
}
console.log(`| 맵 | 몬스터 | 막힘 상자 | 지난 움직임 | 막힌 칸에 걸린 순간(${SEC}초) | 몬스터·움직임 |`);
console.log('|---|---|---|---|---|---|');
console.log(rows.join('\n'));
console.log(total ? `모두 ${total}건` : '0건');
process.exitCode = total ? 1 : 0;
