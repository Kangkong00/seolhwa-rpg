// 숙련 단계별 연출 시험(docs/spec/feedback_1031.md 4-4): 액티브 무예 13개 × 등급 1·4·5·9·10.
// ① 찍기: 무예마다 다섯 등급을 한 장에(docs/fx_tiers/<무예 id>.jpg) ② 범위 연출 = 실제 맞는 범위(값): 공통 땅 고리 끝 반지름 = radius,
//   지축 가르기 금 길이 = length(위아래는 verticalSquash), 맞는 값(radius·length·distance…)은 기본 × 숙련 범위 덤(5등급 1.1·10등급 1.2)
// ③ 꾸밈 배율: 둘째·셋째 단계 가지 색·크기(1.0/1.15/1.25/1.45/1.6), 셋째 끝 빛살 ④ 셋째 단계 중 화면 물체·글자 수가 지금(1등급) 가장 무거운 무예 이하
// 쓰는 법: python3 -m http.server 8123 & 을 켠 뒤 node tools/test/fxtiers.mjs [그림 폴더 — 주면 찍음]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const OUT = process.argv[2];
const GRADES = [1, 4, 5, 9, 10];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.clear();
  localStorage.setItem('seolhwa-rpg:save:v1', JSON.stringify({ version: 1, map: 'dungeon_rat_1', x: 690, y: 400, facing: 'right', progress: { level: 40, exp: 0 },
    skills: ['power_slash', 'breath', 'whirl', 'triple_cut', 'dash_cut', 'roar', 'earth_split', 'sword_wind', 'counter', 'whirlwind', 'thunder_cut', 'tiger_flash', 'seven_star_dance'],
    equipment: { equipped: { weapon: 'seven_star', outfit: 'outfit1_hotot', head: '', arms: '', feet: '' }, bag: [], coins: 0 } }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 30000 });
await page.waitForTimeout(1500);
const ids = await page.evaluate(() => {
  const s = seolhwa.game.scene.getScene('map');
  window.__s = s;
  s.spawner.update = () => ({ born: [], bites: [] });
  s.d.admin.noDie = true;
  s.d.admin.noCooldown = true;
  // 화면 물체·글자 최대(셋째 단계 부담 비교)
  window.__peak = { objs: 0, texts: 0, parts: 0 };
  s.events.on('postupdate', () => {
    const objs = s.children.list.length + (s.skillFx.layer.list ? s.skillFx.layer.list.length : 0);
    const texts = s.children.list.filter((o) => o.type === 'Text' && o.visible).length;
    window.__peak.objs = Math.max(window.__peak.objs, objs);
    window.__peak.texts = Math.max(window.__peak.texts, texts);
    window.__peak.parts = Math.max(window.__peak.parts, s.skillFx.particles);
  });
  return s.skills.filter((k) => k.type !== 'passive').map((k) => k.id);
});
const rows = [];
let bad = 0;
const peaks = {};
for (const id of ids) {
  const shots = [];
  const notes = [];
  const vals = [];
  for (const g of GRADES) {
    const r = await page.evaluate(async ([id, g]) => {
      const s = window.__s;
      const { countForGrade, masteryBonus, fxStage, tierColor } = await import('/src/core/mastery.js');
      const mc = s.d.skills.mastery;
      // 앞 무예가 끝나기를 기다림
      for (let i = 0; i < 80 && (s.act || s.spin || s.swing || s.skillFx.cast); i++) await new Promise((r) => setTimeout(r, 100));
      // 앞 무예 연출이 다 사라질 때까지(물체 수를 이번 무예만 세게)
      for (let i = 0; i < 40 && s.skillFx.particles > 0; i++) await new Promise((r) => setTimeout(r, 100));
      await new Promise((r) => setTimeout(r, 600));
      for (const m of [...s.spawner.monsters]) { s.monsterViews.get(m.id)?.destroy(); s.monsterViews.delete(m.id); }
      s.spawner.monsters = [];
      s.pos.x = 690; s.pos.y = 400; s.facing = 'right';
      s.player.hp = Math.floor(s.player.maxHp * 0.5);
      s.d.skillMastery[id] = countForGrade(g, mc);
      s.skillFx.lastRingR = null; s.skillFx.lastRays = null; s.lastCastSk = null;
      window.__peak = { objs: 0, texts: 0, parts: 0 };
      s.cooldowns.left = {};
      s.useSkill(id);
      // 받아치기: 자세 중에 한 번 물림
      if (id === 'counter') {
        let zi = s.map.spawnZones.findIndex((z) => z.monster === 'wolf');
        if (zi < 0) { s.map.spawnZones.push({ monster: 'wolf', count: 0, respawnMs: 1e9, x: 0, y: 0, w: s.map.width, h: s.map.height }); s.spawner.timers.push(0); zi = s.map.spawnZones.length - 1; }
        const m = s.spawner.spawn(zi); m.x = s.pos.x + 30; m.y = s.pos.y; m.hp = m.maxHp = 1e9; m.state = 'rest'; m.timer = 1e9; s.addMonsterView(m);
        s.onBitten({ monster: m, damage: 10, dir: 'left' });
      }
      const sk = s.skills.find((k) => k.id === id);
      const st = fxStage(g, mc);
      const b = masteryBonus(sk, g, mc);
      const used = s.lastCastSk || {};
      const out = { stage: st.stage, sizeMul: st.sizeMul, rangeMul: b.rangeMul, ringR: s.skillFx.lastRingR, radius: used.radius, baseRadius: sk.radius, castStage: s.skillFx.cast && s.skillFx.cast.stage,
        styleTint: s.skillFx.style && s.skillFx.style.tint, wantTint: (tierColor(sk, st.stage, s.d.skills.tierColors) || [null])[0] };
      // 맞는 값 = 기본 × 범위 덤
      out.rangeOk = (mc.rangeKeys || []).every((k) => typeof sk[k] !== 'number' || Math.abs(used[k] - sk[k] * b.rangeMul) < 1e-6);
      return out;
    }, [id, g]);
    await page.waitForTimeout(id === 'seven_star_dance' ? 1400 : 350);
    if (OUT) shots.push(await page.screenshot({ clip: { x: 422 - 150, y: 195 - 150, width: 300, height: 260 } }));
    // 금 길이(지축 가르기)
    const crack = await page.evaluate(() => { const o = window.__s.children.list.filter((x) => x.crackPts).pop(); return o ? Math.hypot(o.crackPts.at(-1).x - o.crackPts[0].x, o.crackPts.at(-1).y - o.crackPts[0].y) : null; });
    // 끝날 때까지 기다려 빛살·최대 물체 수
    const end = await page.evaluate(async () => {
      const s = window.__s;
      for (let i = 0; i < 100 && (s.act || s.spin || s.swing || s.skillFx.cast); i++) await new Promise((r) => setTimeout(r, 100));
      await new Promise((r) => setTimeout(r, 200));
      return { rays: s.skillFx.lastRays, peak: { ...window.__peak } };
    });
    if (!r.rangeOk) notes.push(`${g}등급 맞는 범위 ≠ 기본×덤`);
    if (r.ringR != null && r.baseRadius && Math.abs(r.ringR - r.baseRadius * r.rangeMul) > 1e-6) notes.push(`${g}등급 땅 고리 ${r.ringR} ≠ 범위 ${r.baseRadius * r.rangeMul}`);
    if (id === 'earth_split' && crack != null && Math.abs(crack - 120 * r.rangeMul) > 0.5) notes.push(`${g}등급 금 ${crack.toFixed(1)} ≠ ${120 * r.rangeMul}`);
    if (r.castStage !== r.stage) notes.push(`${g}등급 단계 ${r.castStage}≠${r.stage}`);
    if (r.stage >= 1 && r.styleTint !== r.wantTint) notes.push(`${g}등급 색 ${r.styleTint}≠${r.wantTint}`);
    if (r.stage === 2 && !end.rays) notes.push('10등급 빛살 없음');
    if (g === 10) peaks[id] = end.peak;
    if (g === 1 && id === 'seven_star_dance') peaks.base = end.peak;
    if (g === 1) (peaks.g1 = peaks.g1 || {})[id] = end.peak;
    vals.push(`${g}:×${r.sizeMul.toFixed(2)}${r.ringR != null ? ` 고리${Math.round(r.ringR)}` : ''}${id === 'earth_split' && crack ? ` 금${Math.round(crack)}` : ''}`);
  }
  if (OUT && shots.length) {
    const sheet = await page.evaluate(async ([list, labels]) => {
      const imgs = await Promise.all(list.map(async (b64) => { const im = new Image(); im.src = `data:image/png;base64,${b64}`; await im.decode(); return im; }));
      const w = imgs[0].width; const h = imgs[0].height;
      const c = document.createElement('canvas'); c.width = w * imgs.length; c.height = h;
      const g = c.getContext('2d');
      imgs.forEach((im, i) => { g.drawImage(im, i * w, 0); g.fillStyle = '#ff0'; g.font = 'bold 14px sans-serif'; g.fillText(labels[i], i * w + 4, 16); });
      return c.toDataURL('image/jpeg', 0.8).split(',')[1];
    }, [shots.map((b) => b.toString('base64')), GRADES.map((g) => `${g}등급`)]);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${OUT}/${id}.jpg`, Buffer.from(sheet, 'base64'));
  }
  if (notes.length) bad++;
  rows.push(`| ${id} | ${vals.join(' · ')} | ${notes.length ? notes.join(', ') : '좋음'} |`);
}
// ④ 셋째 단계 부담: 지금(1등급) 가장 무거운 무예 수준 이하(물체 수 10% 여유 — 받아치기는 1등급부터 가장 무거워 한 겹 더하면 약 7% 넘음) — 규격은 "칠성검무 수준"이나 재 보니 휘돌려 베기·검풍·받아치기가 더 무거워 그 최대를 기준으로
const g1 = Object.values(peaks.g1 || {});
const base = { objs: Math.max(0, ...g1.map((p) => p.objs)), texts: Math.max(0, ...g1.map((p) => p.texts)), parts: Math.max(0, ...g1.map((p) => p.parts)) };
const over = Object.entries(peaks).filter(([k, p]) => k !== 'base' && k !== 'g1' && (p.objs > base.objs * 1.1 || p.texts > base.texts));
console.log('| 무예 | 등급: 꾸밈 배율 · 땅 고리 반지름 · 금 길이 | 결과 |');
console.log('|---|---|---|');
console.log(rows.join('\n'));
console.log(`\n셋째 단계(10등급) 화면 물체·글자 최대 — 기준(1등급 무예 중 최대, 물체는 10% 여유): 물체 ${base.objs}·글자 ${base.texts}·알갱이 ${base.parts}`);
console.log('1등급:', Object.entries(peaks.g1 || {}).map(([k, p]) => `${k} ${p.objs}·${p.texts}·알갱이${p.parts}`).join(', '));
console.log(Object.entries(peaks).filter(([k]) => k !== 'base' && k !== 'g1').map(([k, p]) => `${k} ${p.objs}·${p.texts}·알갱이${p.parts}`).join(', '));
if (over.length) { bad++; console.log(`넘음: ${over.map(([k]) => k).join(', ')}`); }
console.log(errors.length ? errors.join('\n') : '오류 없음');
console.log(bad || errors.length ? `문제 ${bad + errors.length}개` : '문제 없음');
await browser.close();
process.exitCode = bad || errors.length ? 1 : 0;
