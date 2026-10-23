// 휘두르기 손·칼 맞추기 시험(docs/spec/feedback_1023.md 5): 옷 6벌 × 세 방향(정면·옆면·뒷면)에서 한 번씩 휘두르며
// 매 프레임(8ms) ① 보이는 몸 그림(자세)과 칼 각도 θ가 swing.keys의 그 시간 구간 안인지(직전 뒤로 빼기 동안은 raise·thetaFrom)
// ② 맞힘(strikeHit)이 한 번만 나는지 ③ 칼의 쥐는 점이 지금 보이는 몸 그림의 주먹(attach[자세].grip)인지.
// 쓰는 법: python3 -m http.server 8123 & 을 켠 뒤 node tools/test/swingsync.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const OUTFITS = ['outfit1_hotot', 'outfit2_mumyeong', 'outfit3_dopo', 'outfit4_cheollik', 'outfit5_dujeonggap', 'outfit6_sinseon'];
const FACINGS = ['down', 'right', 'up'];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.clear();
  localStorage.setItem('seolhwa-rpg:save:v1', JSON.stringify({ version: 1, map: 'dungeon_rat_1', x: 0, y: 0, facing: 'down', progress: { level: 40, exp: 0 },
    equipment: { equipped: { weapon: 'cloud_long', outfit: 'outfit1_hotot', head: '', arms: '', feet: '' }, bag: [], coins: 0 } }));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8123/');
await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 30000 });
await page.waitForTimeout(1200);
const rows = [];
let bad = 0;
for (const outfit of OUTFITS) {
  await page.evaluate((outfit) => {
    const s = seolhwa.game.scene.getScene('map');
    s.equip.equipped.outfit = outfit;
    s.afterEquipChange('outfit');
  }, outfit);
  await page.waitForTimeout(2500); // 옷 그림 만들기
  for (const facing of FACINGS) {
    const r = await page.evaluate((facing) => {
      const s = seolhwa.game.scene.getScene('map');
      const pv = s.playerView;
      const sw = s.d.weapons.swing;
      s.scene.pause(); // 시험이 프레임을 직접 돌림
      s.spawner.monsters = [];
      s.facing = facing;
      s.attackCooldown = 0;
      s.swing = null;
      let hits = 0;
      const strike = s.strikeHit.bind(s);
      s.strikeHit = (w, m) => { hits++; return strike(w, m); };
      s.startSwing();
      const w = s.swing.weapon;
      const pre = (sw.lean && sw.lean.preMs) || 0;
      const set = facing === 'up' ? pv.frames.up : facing === 'down' ? pv.frames.down : pv.frames.side;
      const poseOfKey = Object.fromEntries(Object.entries(set).map(([k, v]) => [v, k]));
      const DIR = { down: 'front', up: 'back', left: 'side', right: 'side' };
      const ATT = { raise: 'raise', swing: 'swing', strike: 'strike' };
      const out = { frames: 0, badPose: [], badGrip: [], seen: {} };
      let t = 0;
      for (;;) {
        const st = s.updateSwing(8);
        t += 8;
        if (!st) break;
        pv.update(0, s.pos.x, s.pos.y, facing, false, st);
        out.frames++;
        const shown = poseOfKey[pv.sprite.texture.key];
        out.seen[shown] = (out.seen[shown] || 0) + 1;
        // ① 자세·θ가 지금 시간의 구간 안
        const p = (t - pre) / w.swingMs;
        let want;
        if (t < pre) want = { pose: 'raise', lo: sw.thetaFrom, hi: sw.thetaFrom };
        else {
          const pp = Math.min(1, p);
          const k = sw.keys.find((x) => pp < x.t1) || sw.keys[sw.keys.length - 1];
          want = { pose: k.pose, lo: Math.min(k.theta0, k.theta1), hi: Math.max(k.theta0, k.theta1) };
        }
        if (shown !== want.pose || st.theta < want.lo - 1e-6 || st.theta > want.hi + 1e-6) out.badPose.push(`t${t} ${shown}/${want.pose} θ${st.theta.toFixed(1)}`);
        // ③ 쥐는 점 = 보이는 몸 그림의 주먹
        const a = pv.weapon.attach[ATT[shown]] && pv.weapon.attach[ATT[shown]][DIR[facing]];
        if (a) {
          const g = pv.posePoint(a.grip[0], a.grip[1], pv.sprite.x, pv.sprite.y, facing === 'right');
          const d = Math.hypot(g.x - pv.weaponSprite.x, g.y - pv.weaponSprite.y);
          if (d > 0.01) out.badGrip.push(`t${t} ${shown} ${d.toFixed(2)}px`);
        } else out.badGrip.push(`t${t} ${shown} 쥐는 점 없음`);
        if (t > 5000) break;
      }
      out.hits = hits;
      s.strikeHit = strike;
      s.scene.resume();
      return out;
    }, facing);
    const ok = !r.badPose.length && !r.badGrip.length && r.hits === 1;
    if (!ok) bad++;
    rows.push(`| ${outfit} | ${facing} | ${r.frames} | ${Object.entries(r.seen).map(([k, v]) => `${k} ${v}`).join(' · ')} | ${r.badPose.length ? r.badPose.slice(0, 2).join(', ') : '0'} | ${r.hits} | ${r.badGrip.length ? r.badGrip.slice(0, 2).join(', ') : '0'} | ${ok ? '좋음' : '문제'} |`);
  }
}
console.log(`휘두르기 방식: ${await page.evaluate(() => seolhwa.game.scene.getScene('map').d.weapons.swing.timing)}`);
console.log('| 옷 | 방향 | 프레임 | 보인 자세(프레임 수) | 자세·θ 구간 밖 | 맞힘 | 쥐는 점 ≠ 주먹 | 결과 |');
console.log('|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
console.log(errors.length ? errors.join('\n') : '오류 없음');
console.log(bad || errors.length ? `문제 ${bad + errors.length}개` : '문제 없음');
await browser.close();
process.exitCode = bad || errors.length ? 1 : 0;
