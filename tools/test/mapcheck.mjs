// 맵 검사(docs/spec/feedback_1022.md 2) — 맵을 바꿀 때마다 돌림. 브라우저 없이 node로.
// 맵마다 ① 시작·입구·도착 자리가 서로 이어졌는지(주인공 발 상자 기준)
//        ② 몬스터 구역이 50% 넘게 갈 수 있는 곳(시작과 이어진 곳)인지
//        ③ 갈 수 있는데 시작과 떨어진 섬(넓이 2,500px² 넘는)이 있는지
// 쓰는 법: node tools/test/mapcheck.mjs [맵 id ...] [--fix]   (없으면 data/maps 전부. --fix: 50% 이하 몬스터 구역을
//         가까운 곳에서 60% 넘는 자리로 옮기고(필요하면 줄여) 맵 파일에 씀)
import { readFileSync, readdirSync } from 'node:fs';
import { parseMap } from '../../src/core/mapData.js';
import { isStandable } from '../../src/core/movement.js';

const root = new URL('../../', import.meta.url);
const game = JSON.parse(readFileSync(new URL('data/game.json', root)));
const box = game.player.footBox;
const args = process.argv.slice(2).filter((a) => a !== '--fix');
const FIX = process.argv.includes('--fix');
const ids = args.length ? args : readdirSync(new URL('data/maps/', root)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const json = Object.fromEntries(readdirSync(new URL('data/maps/', root)).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), JSON.parse(readFileSync(new URL(`data/maps/${f}`, root)))]));
const STEP = 1; // 발 자리를 1px마다 봄(좁은 길을 놓치지 않게)
const ISLAND = 2500;

// 시작에서 갈 수 있는 발 자리(4px 격자 위)를 칠함
function flood(map, sx, sy) {
  const W = Math.ceil(map.width / STEP);
  const H = Math.ceil(map.height / STEP);
  const ok = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) ok[j * W + i] = isStandable(map.grid, i * STEP + 0.5, j * STEP + 0.5, box) ? 1 : 0;
  const comp = new Int32Array(W * H).fill(-1);
  const sizes = [];
  for (let k = 0; k < W * H; k++) {
    if (!ok[k] || comp[k] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    const st = [k];
    comp[k] = id;
    while (st.length) {
      const c = st.pop();
      n++;
      const i = c % W;
      const j = (c - i) / W;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const q = jj * W + ii;
        if (ok[q] && comp[q] < 0) { comp[q] = id; st.push(q); }
      }
    }
    sizes.push(n);
  }
  // 점(x,y)이 속한 덩어리: 그 점 둘레 8px 안에서 설 수 있는 가장 가까운 자리
  const at = (x, y) => {
    let best = -1;
    let bd = 1e9;
    for (let dj = -8; dj <= 8; dj++) for (let di = -8; di <= 8; di++) {
      const i = Math.floor(x / STEP) + di;
      const j = Math.floor(y / STEP) + dj;
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      const k = j * W + i;
      const d = di * di + dj * dj;
      if (ok[k] && d < bd) { bd = d; best = comp[k]; }
    }
    return best;
  };
  return { W, H, ok, comp, sizes, start: at(sx, sy), at };
}

const rows = [];
const fixes = []; // --fix: 고칠 몬스터 구역
let problems = 0;
for (const id of ids) {
  const j = json[id];
  if (!j) continue;
  const map = parseMap(j);
  const f = flood(map, map.spawn.x, map.spawn.y);
  const notes = [];
  if (f.start < 0) notes.push('시작 자리에 설 수 없음');
  // 입구(docs/spec/feedback_1023.md 3): 입구 사각형 "안"(게임 portalAt과 같이 경계 포함)에 시작과 이어진 발 자리가 있는지 — 둘레는 세지 않음
  const inside = (p, x, y) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
  const spots = {};
  for (const p of map.portals) {
    let n = 0;
    for (let y = Math.ceil(p.y); y <= p.y + p.h; y += STEP) for (let x = Math.ceil(p.x); x <= p.x + p.w; x += STEP) {
      const i = Math.floor(x / STEP);
      const jj = Math.floor(y / STEP);
      if (i < 0 || jj < 0 || i >= f.W || jj >= f.H) continue;
      const k = jj * f.W + i;
      if (f.ok[k] && f.comp[k] === f.start && f.start >= 0) n++;
    }
    spots[p.label || p.id] = n;
    if (!n) notes.push(`입구 ${p.label || p.id} 안에 설 자리 없음`);
  }
  // 도착(다른 맵에서 이 맵으로 오는 arrive): 시작과 이어졌는지(게임은 가장 가까운 설 자리로 옮기므로 둘레 8px 허용),
  // 그리고 이 맵의 다른 입구 사각형 안이 아닌지(도착하자마자 다른 입구 위)
  for (const [oid, o] of Object.entries(json)) {
    for (const p of o.portals || []) {
      if (p.to !== id || !p.arrive) continue;
      if (f.at(p.arrive.x, p.arrive.y) !== f.start) notes.push(`도착(${oid}에서 ${p.arrive.x},${p.arrive.y}) 안 이어짐`);
      const on = map.portals.find((q) => inside(q, p.arrive.x, p.arrive.y));
      if (on) notes.push(`도착(${oid}에서 ${p.arrive.x},${p.arrive.y})이 입구 ${on.label || on.id} 안`);
    }
  }
  // 몬스터 구역: 시작과 이어진 발 자리 비율(합 표로 빠르게)
  const sum = new Int32Array((f.W + 1) * (f.H + 1));
  for (let jj = 0; jj < f.H; jj++) for (let i = 0; i < f.W; i++) {
    const k = jj * f.W + i;
    const v = f.ok[k] && f.comp[k] === f.start ? 1 : 0;
    sum[(jj + 1) * (f.W + 1) + i + 1] = v + sum[jj * (f.W + 1) + i + 1] + sum[(jj + 1) * (f.W + 1) + i] - sum[jj * (f.W + 1) + i];
  }
  const pctOf = (x, y, w, h) => {
    const x0 = Math.max(0, Math.min(f.W, Math.round(x)));
    const y0 = Math.max(0, Math.min(f.H, Math.round(y)));
    const x1 = Math.max(0, Math.min(f.W, Math.round(x + w)));
    const y1 = Math.max(0, Math.min(f.H, Math.round(y + h)));
    const W1 = f.W + 1;
    const good = sum[y1 * W1 + x1] - sum[y0 * W1 + x1] - sum[y1 * W1 + x0] + sum[y0 * W1 + x0];
    return w * h ? Math.round((good / (w * h)) * 100) : 0;
  };
  map.spawnZones.forEach((z, zi) => {
    const pct = pctOf(z.x, z.y, z.w, z.h);
    if (pct > 50) return;
    // --fix: 같은 크기부터 작게(×0.8씩) 줄여 가며, 원래 자리에서 가장 가까운 곳 중 갈 수 있는 곳이 60% 넘는 사각형
    let fix = null;
    for (let s = 1; s >= 0.4 && !fix; s -= 0.2) {
      const w = Math.round(z.w * s);
      const h = Math.round(z.h * s);
      let best = null;
      for (let dy = -200; dy <= 200; dy += 10) for (let dx = -240; dx <= 240; dx += 10) {
        const x = Math.round(z.x + (z.w - w) / 2 + dx);
        const y = Math.round(z.y + (z.h - h) / 2 + dy);
        if (x < 0 || y < 0 || x + w > map.width || y + h > map.height) continue;
        const p = pctOf(x, y, w, h);
        if (p < 60) continue;
        // 다른 구역(이미 고친 것 포함)과 30% 넘게 겹치면 안 됨
        const over = map.spawnZones.some((o, oi) => {
          if (oi === zi) return false;
          const q = fixes.find((x) => x.map === id && x.index === oi) || o;
          const ix = Math.max(0, Math.min(x + w, q.x + q.w) - Math.max(x, q.x));
          const iy = Math.max(0, Math.min(y + h, q.y + q.h) - Math.max(y, q.y));
          return ix * iy > 0.3 * w * h;
        });
        if (over) continue;
        const d = dx * dx + dy * dy;
        if (!best || d < best.d) best = { x, y, w, h, p, d };
      }
      fix = best;
    }
    notes.push(`구역 ${z.name || z.monster} ${pct}%${fix ? ` → (${fix.x},${fix.y},${fix.w}×${fix.h}) ${fix.p}%` : ' → 고칠 곳 못 찾음'}`);
    if (fix) fixes.push({ map: id, index: zi, x: fix.x, y: fix.y, w: fix.w, h: fix.h });
  });
  // 섬: 시작과 떨어진 덩어리 중 넓이 ISLAND px² 넘는 것
  const islands = f.sizes.map((n, i) => ({ i, area: n * STEP * STEP })).filter((c) => c.i !== f.start && c.area > ISLAND);
  for (const c of islands) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let k = 0; k < f.comp.length; k++) if (f.comp[k] === c.i) { sx += (k % f.W) * STEP; sy += Math.floor(k / f.W) * STEP; n++; }
    notes.push(`섬 ${c.area}px² (가운데 ${Math.round(sx / n)},${Math.round(sy / n)})`);
  }
  const reach = f.start >= 0 ? f.sizes[f.start] * STEP * STEP : 0;
  if (notes.length) problems++;
  rows.push(`| ${id} | ${Object.entries(spots).map(([k, v]) => `${k} ${v.toLocaleString('en-US')}`).join(', ') || '-'} | ${map.spawnZones.length} | ${reach.toLocaleString('en-US')} | ${notes.length ? notes.join('; ') : '좋음'} |`);
}
console.log('| 맵 | 입구(안에 설 자리 수) | 몬스터 구역 | 시작에서 갈 수 있는 넓이(px²) | 결과 |');
console.log('|---|---|---|---|---|');
console.log(rows.join('\n'));
console.log(problems ? `문제 있는 맵 ${problems}개` : '모든 맵 좋음');
// --fix: 몬스터 구역을 고친 값으로 맵 파일에 씀(그 줄의 x·y·w·h만 바꿈, 파일 모양은 그대로)
if (FIX && fixes.length) {
  const { writeFileSync } = await import('node:fs');
  for (const mid of new Set(fixes.map((x) => x.map))) {
    const url = new URL(`data/maps/${mid}.json`, root);
    const lines = readFileSync(url, 'utf8').split('\n');
    let zi = -1;
    let inZones = false;
    for (let li = 0; li < lines.length; li++) {
      if (lines[li].includes('"spawnZones"')) { inZones = true; continue; }
      if (!inZones) continue;
      if (/^\s*\]/.test(lines[li])) break;
      if (!lines[li].includes('"monster"')) continue;
      zi++;
      const fx = fixes.find((x) => x.map === mid && x.index === zi);
      if (!fx) continue;
      for (const k of ['x', 'y', 'w', 'h']) lines[li] = lines[li].replace(new RegExp(`"${k}": ?-?\\d+`), `"${k}": ${fx[k]}`);
    }
    writeFileSync(url, lines.join('\n'));
    JSON.parse(readFileSync(url, 'utf8'));
  }
  console.log(`몬스터 구역 ${fixes.length}개를 고쳤습니다(--fix). 다시 돌려 확인하세요.`);
}
process.exitCode = problems ? 1 : 0;
