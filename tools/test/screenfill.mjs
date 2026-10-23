// 화면 꽉 채우기 시험(docs/spec/feedback_1024.md 2): 아이폰 가로 844×390, 안전 영역(좌우 47·아래 21) 흉내.
// 경우마다 ① 게임 그림(캔버스)이 화면 끝까지인지 ② 화면 가장자리에 검은 띠(바탕색 #1d1a14 줄)가 있는지
// ③ 단추·체력바가 안전 영역 안인지. 경우: 사파리(주소창이 화면을 조금 덮어 visualViewport가 작음)·사파리(주소창 들어감)·홈 화면 앱(standalone).
// 쓰는 법: python3 -m http.server 8123 & 을 켠 뒤 node tools/test/screenfill.mjs [그림 저장 폴더]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const OUT = process.argv[2];
const SAFE = { top: 0, left: 47, right: 47, bottom: 21 };
const CASES = [
  { name: '사파리(주소창 나옴)', vvH: 342, standalone: false },
  { name: '사파리(주소창 들어감)', vvH: 0, standalone: false },
  { name: '홈 화면 앱(standalone)', vvH: 0, standalone: true },
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const rows = [];
let bad = 0;
for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(([c]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      localStorage.setItem('seolhwa-rpg:save:v1', JSON.stringify({ version: 1, map: 'village', x: 690, y: 500, facing: 'down', progress: { level: 5, exp: 0 },
        equipment: { equipped: { weapon: 'wood_pine', outfit: 'outfit1_hotot', head: '', arms: '', feet: '' }, bag: [], coins: 0 } }));
    }
    // 사파리 주소창 흉내: visualViewport(보이는 부분)가 화면보다 작게 보고됨 — 예전 코드는 이 크기로 캔버스를 만들었음
    if (c.vvH && window.visualViewport) {
      const vv = window.visualViewport;
      Object.defineProperty(vv, 'height', { get: () => c.vvH });
    }
    if (c.standalone) Object.defineProperty(navigator, 'standalone', { get: () => true });
  }, [c]);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  let safeOk = true;
  try {
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: SAFE.top, left: SAFE.left, right: SAFE.right, bottom: SAFE.bottom } });
  } catch { safeOk = false; }
  if (c.standalone) await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8123/');
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('hide'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const cv = document.querySelector('#game canvas').getBoundingClientRect();
    const box = (sel) => { const e = document.querySelector(sel); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: innerWidth - b.right, b: innerHeight - b.bottom }; };
    return { cv: { x: cv.x, y: cv.y, w: cv.width, h: cv.height }, W: innerWidth, H: innerHeight, hud: box('#hud'), status: box('#status'), attack: box('#btn-attack'), skills: box('#skill-buttons'), joy: box('#joystick-base') };
  });
  // 가장자리 검은 띠: 맨 끝 줄(위·아래·왼쪽·오른쪽 3px)에서 바탕색과 거의 같은 점이 90% 넘으면 띠
  const shot = await page.screenshot({ path: OUT ? `${OUT}/fill_${CASES.indexOf(c)}.png` : undefined });
  const band = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    const dark = (x, y) => { const i = (y * img.width + x) * 4; return Math.abs(d[i] - 0x1d) < 6 && Math.abs(d[i + 1] - 0x1a) < 6 && Math.abs(d[i + 2] - 0x14) < 6; };
    const side = (pts) => pts.filter(([x, y]) => dark(x, y)).length / pts.length;
    const W = img.width; const H = img.height; const k = 6;
    const line = (f, n) => Array.from({ length: n }, (_, i) => f(i));
    return {
      top: side(line((i) => [i, k / 2 | 0], W)), bottom: side(line((i) => [i, H - 1 - (k / 2 | 0)], W)),
      left: side(line((i) => [k / 2 | 0, i], H)), right: side(line((i) => [W - 1 - (k / 2 | 0), i], H)),
    };
  }, shot.toString('base64'));
  const full = Math.abs(r.cv.x) < 0.5 && Math.abs(r.cv.y) < 0.5 && Math.abs(r.cv.w - r.W) < 1 && Math.abs(r.cv.h - r.H) < 1;
  const bands = Object.entries(band).filter(([, v]) => v > 0.9).map(([k]) => k);
  const inSafe = [['hud', r.hud, ['r', SAFE.right]], ['status', r.status, ['l', SAFE.left]], ['attack', r.attack, ['r', SAFE.right], ['b', SAFE.bottom]], ['skills', r.skills, ['r', SAFE.right], ['b', SAFE.bottom]]]
    .filter(([, b]) => b).flatMap(([n, b, ...cs]) => cs.filter(([k, v]) => b[k] < v - 0.5).map(([k]) => `${n}.${k}=${Math.round(b[k])}`));
  const ok = full && !bands.length && (!safeOk || !inSafe.length) && !errors.length;
  if (!ok) bad++;
  rows.push(`| ${c.name} | ${Math.round(r.cv.w)}×${Math.round(r.cv.h)} @(${Math.round(r.cv.x)},${Math.round(r.cv.y)}) / 화면 ${r.W}×${r.H} | ${bands.length ? bands.join('·') : '없음'} | ${safeOk ? (inSafe.length ? inSafe.join(', ') : '모두 안') : '흉내 못 함'} | ${errors.length ? errors[0] : '0'} | ${ok ? '좋음' : '문제'} |`);
  await ctx.close();
}
console.log('| 경우 | 캔버스 / 화면 | 가장자리 검은 띠 | 단추·체력바 안전 영역 | 오류 | 결과 |');
console.log('|---|---|---|---|---|---|');
console.log(rows.join('\n'));
console.log(bad ? `문제 ${bad}개` : '문제 없음');
await browser.close();
process.exitCode = bad ? 1 : 0;
