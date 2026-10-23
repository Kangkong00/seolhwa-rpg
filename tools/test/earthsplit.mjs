// 지축 가르기 시험(docs/spec/feedback_1024.md 1): 네 방향마다 무예를 쓰고 게임 시간을 10배 느리게 해서
// ① 금(바닥 지그재그)이 발 앞에서 시작해 바라보는 쪽으로만 뻗는지 ② 솟는 빛 그림이 돌지 않고(각도 0) 금 위 자리에서 아래 → 위로 솟는지(제자리, 세로만 커짐)
// ③ 돌 조각이 위로만 가는지(내려오지 않음) ④ 칼 궤적을 그리지 않는지 ⑤ 금 앞 몬스터를 맞히는지.
// [그림 폴더]를 주면 0.05초 간격 16장을 한 장에 모아 earth_<방향>.jpg로 저장.
// 쓰는 법: python3 -m http.server 8123 & 을 켠 뒤 node tools/test/earthsplit.mjs [그림 폴더]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const OUT = process.argv[2];
const SL = 0.1;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.clear();
  localStorage.setItem('seolhwa-rpg:save:v1', JSON.stringify({ version: 1, map: 'dungeon_rat_1', x: 690, y: 400, facing: 'down', progress: { level: 30, exp: 0 },
    skills: ['earth_split'], skillSlots: ['earth_split'], equipment: { equipped: { weapon: 'wood_pine', outfit: 'outfit1_hotot', head: '', arms: '', feet: '' }, bag: [], coins: 0 } }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate((SL) => {
  const s = seolhwa.game.scene.getScene('map');
  s.spawner.update = () => ({ born: [], bites: [] });
  for (const m of [...s.spawner.monsters]) { s.monsterViews.get(m.id)?.destroy(); s.monsterViews.delete(m.id); }
  s.spawner.monsters = [];
  s.tweens.timeScale = SL;
  s.time.timeScale = SL;
  const u = s.update.bind(s);
  s.update = (t, d) => u(t, d * SL);
  s.d.admin.noCooldown = true;
  window.__s = s;
  // 새로 생긴 그림을 따라가며 자리·크기를 기록
  window.__track = () => {
    const out = { crack: null, bursts: [], rocks: [] };
    for (const o of s.children.list) {
      if (o.crackPts && !out.crack) out.crack = o.crackPts.map((p) => ({ x: p.x, y: p.y }));
      if (o.type === 'Image' && o.texture && o.texture.key === 'fx:fx_earth_crack') out.bursts.push({ id: o.__id ?? (o.__id = Math.random()), x: o.x, y: o.y, sy: o.scaleY, angle: o.angle, oy: o.originY });
      if (o.type === 'Rectangle' && o.depth > 0 && o.depth < 1e5 && o.width <= 6 && o.height <= 5) out.rocks.push({ id: o.__id ?? (o.__id = Math.random()), y: o.y });
    }
    return out;
  };
}, SL);
const rows = [];
let bad = 0;
const DIRV = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
for (const f of ['right', 'left', 'down', 'up']) {
  // 몬스터 하나를 금이 지나갈 자리(발에서 바라보는 쪽 50px)에
  const r0 = await page.evaluate(([f, dv]) => {
    const s = window.__s;
    s.pos.x = 690; s.pos.y = 400; s.facing = f; s.skillCast = null; s.cooldowns.left = {};
    for (const m of [...s.spawner.monsters]) { s.monsterViews.get(m.id)?.destroy(); s.monsterViews.delete(m.id); }
    s.spawner.monsters = [];
    const zi = 0;
    const m = s.spawner.spawn(zi);
    m.x = 690 + dv[0] * 50; m.y = 400 + dv[1] * 40; m.hp = m.maxHp = 1e9; m.state = 'rest'; m.timer = 1e9;
    s.addMonsterView(m);
    window.__mon = m;
    return { x: s.pos.x, y: s.pos.y };
  }, [f, DIRV[f]]);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__s.useSkill('earth_split'));
  const t0 = Date.now();
  const samples = [];
  const frames = [];
  for (let i = 0; i < 26; i++) {
    const w = t0 + i * 50 / SL - Date.now();
    if (w > 0) await page.waitForTimeout(w);
    samples.push(await page.evaluate(() => ({ ...window.__track(), trail: !!(window.__s.swing && window.__s.swing.trail && window.__s.swing.trail.pointAt), monHp: window.__mon.hp, maxHp: window.__mon.maxHp })));
    if (OUT && i < 16) frames.push(await page.screenshot({ clip: { x: 422 - 120, y: 195 - 130, width: 240, height: 230 } }));
  }
  const [dx, dy] = DIRV[f];
  const crack = samples.find((x) => x.crack)?.crack;
  const notes = [];
  if (!crack) notes.push('금 없음');
  else {
    const p0 = crack[0];
    const fx = r0.x + dx * 10;
    if (Math.hypot(p0.x - fx, p0.y - r0.y) > 8) notes.push(`시작 (${Math.round(p0.x)},${Math.round(p0.y)}) ≠ 발 앞`);
    // 금 점들이 바라보는 쪽으로만 나아감(뒤로 가거나 위에서 시작하지 않음)
    const prog = crack.map((p) => (p.x - p0.x) * dx + (p.y - p0.y) * dy);
    if (prog.some((v, i) => i && v < prog[i - 1])) notes.push('금이 뒤로 감');
  }
  // 솟는 빛: 각도 0, 자리 고정, 세로 크기만 커지거나 그대로
  const byId = {};
  for (const smp of samples) for (const b of smp.bursts) (byId[b.id] = byId[b.id] || []).push(b);
  const bursts = Object.values(byId);
  for (const seq of bursts) {
    if (seq.some((b) => Math.abs(b.angle) > 0.01)) notes.push('빛이 돌아감');
    if (seq.some((b) => b.y !== seq[0].y || b.x !== seq[0].x)) notes.push('빛이 움직임');
    if (seq.some((b, i) => i && b.sy < seq[i - 1].sy - 1e-6)) notes.push('빛이 줄어듦');
    const along = (seq[0].x - r0.x) * dx + (seq[0].y - r0.y) * dy;
    if (along < 0) notes.push('빛이 등 뒤');
  }
  const rocks = {};
  for (const smp of samples) for (const r of smp.rocks) (rocks[r.id] = rocks[r.id] || []).push(r.y);
  const fall = Object.values(rocks).filter((ys) => ys.some((y, i) => i && y > ys[i - 1] + 0.01)).length;
  if (fall) notes.push(`내려오는 돌 ${fall}개`);
  if (samples.some((x) => x.trail)) notes.push('칼 궤적 그림');
  const hit = samples[samples.length - 1].monHp < samples[samples.length - 1].maxHp;
  if (!hit) notes.push('몬스터 안 맞음');
  if (notes.length) bad++;
  rows.push(`| ${f} | ${crack ? `(${Math.round(crack[0].x - r0.x)},${Math.round(crack[0].y - r0.y)}) → (${Math.round(crack.at(-1).x - r0.x)},${Math.round(crack.at(-1).y - r0.y)})` : '-'} | ${bursts.length} | ${Object.keys(rocks).length}개, 내려옴 ${fall} | ${hit ? '맞음' : '안 맞음'} | ${notes.length ? [...new Set(notes)].join(', ') : '좋음'} |`);
  if (OUT) {
    // 16장을 8×2로 모아 한 장(브라우저 캔버스로)
    const sheet = await page.evaluate(async (list) => {
      const imgs = await Promise.all(list.map(async (b64) => { const im = new Image(); im.src = `data:image/png;base64,${b64}`; await im.decode(); return im; }));
      const w = imgs[0].width; const h = imgs[0].height;
      const c = document.createElement('canvas'); c.width = w * 8; c.height = h * 2;
      const g = c.getContext('2d');
      imgs.forEach((im, i) => { g.drawImage(im, (i % 8) * w, Math.floor(i / 8) * h, w, h); g.fillStyle = '#ff0'; g.font = 'bold 14px sans-serif'; g.fillText(`${i * 50}ms`, (i % 8) * w + 3, Math.floor(i / 8) * h + 12); });
      return c.toDataURL('image/jpeg', 0.8).split(',')[1];
    }, frames.map((b) => b.toString('base64')));
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${OUT}/earth_${f}.jpg`, Buffer.from(sheet, 'base64'));
  }
  await page.waitForTimeout(1500 / SL / 10);
}
console.log('| 방향 | 금 시작 → 끝(발 기준 px) | 솟는 빛 | 돌 조각 | 앞 몬스터 | 결과 |');
console.log('|---|---|---|---|---|---|');
console.log(rows.join('\n'));
console.log(errors.length ? errors.join('\n') : '오류 없음');
console.log(bad || errors.length ? `문제 ${bad + errors.length}개` : '문제 없음');
await browser.close();
process.exitCode = bad || errors.length ? 1 : 0;
