// 무예 kind별 동작(docs/spec/skills_impact.md 2·3). 값은 data/skills.json, 그림은 skillFx.js.
// 나중에 직업이 늘어도 같은 틀(연속·돌진·주변·직선·날아감·자세·여러 대상·궁극)을 그대로 씀.
// 모두 (scene, sk) → 썼으면 true(기다리는 시간 시작), 못 쓰면 false.
// 오래 걸리는 무예는 scene.setAct({ dur, lockMove, update(dt, t), onEnd, guard })로 '하는 중' 상태를 둠
// (맞는 순간 멈춤 동안은 같이 멈춤). update는 그릴 자세({ theta, lean } · 'punch' · null)를 돌려줌.
import { moveStep } from '../core/movement.js';
import {
  breathRings, afterimage, windStreak, shoutRings, exclaim, groundCrack, CrescentShot,
  GuardShield, lightning, StarMap, bigBurst,
} from './skillFx.js';
import { hitStar, slashMark } from './impactFx.js';
import { artCrescent, artEarthCrack, artWindCrescent, artLightning, artShockRing, artDashStreak, artTiger, artStarBurst, ArtShield, artHeal } from './skillArt.js';

const A = (scene) => scene.d.game.fxImages.art; // 그림 크기(data/game.json fxImages.art)

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const REVERSE = { up: 'down', down: 'up', left: 'right', right: 'left' };

// 칼을 앞으로 뻗은 내려치기 자세(맨손이면 주먹)
const strikePose = (scene) => (scene.canSwing ? { theta: 105, lean: 0 } : 'punch');
// 무기 궤적 색을 쓰는 무예(검풍 등)
const skillColor = (scene, sk) => (sk.colorFromWeapon && scene.canSwing ? scene.weaponDef.trailColor : sk.color);

// 점 p가 선분 a→b에서 얼마나 떨어졌는지(옆 거리)와 선분 위 위치(0~len)
function along(a, b, p) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = Math.hypot(vx, vy) || 1;
  const t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len;
  const side = Math.abs((p.x - a.x) * vy - (p.y - a.y) * vx) / len;
  return { t, side, len };
}

// 삼연참 한 번의 배율(i번째, 0부터). 다음 휘두르기는 MapScene.updateSwing이 이것으로 이어감
export function chainMods(sk, i) {
  const last = i === sk.hits - 1;
  return {
    damageMul: last && sk.lastDamageMul ? sk.lastDamageMul : sk.damageMul, // 삼연참 마지막 한 번은 lastDamageMul
    knockbackMul: last ? sk.lastKnockbackMul : 0.5,
    starScale: last ? sk.lastStarScale : 1,
    hitStopMul: last ? 1.5 : 0.6,
    shakeMul: last ? 1.6 : 1,
    swingMsMul: sk.swingMsMul,
    trailHoldMs: sk.trailHoldMs,
    trailOffset: (i - 1) * sk.trailOffsetPx,
    chain: { sk, index: i },
  };
}

export const SKILL_KINDS = {
  // 힘껏 베기(feedback_1015.md 1)
  powerSlash(scene, sk) {
    scene.attackWithAssist(sk);
    return true;
  },

  // 숨 고르기
  heal(scene, sk) {
    if (scene.player.hp >= scene.player.maxHp) {
      scene.toast.show('체력이 가득합니다');
      return false;
    }
    breathRings(scene, () => scene.pos, sk);
    artHeal(scene, () => scene.pos, A(scene).heal); // 그림: 치유 기운
    scene.playerView.setGlow(sk.glowColor, 0.5, sk.glowMs);
    scene.healPlayer(Math.max(1, Math.ceil(scene.player.maxHp * sk.healRatio)), false, true);
    // 이어서 hotMs 동안 hotRatio만큼 조금씩 더(MapScene.updateRecovery)
    if (sk.hotRatio && sk.hotMs) scene.hot = { left: sk.hotMs, perMs: (scene.player.maxHp * sk.hotRatio) / sk.hotMs, acc: 0 };
    scene.sfx.play('heal');
    return true;
  },

  // 휘돌려 베기·회오리 베기(지속형, MapScene.startSpin/updateSpin)
  spin(scene, sk) {
    scene.startSpin(sk);
    return true;
  },

  // 연속: 삼연참 — 빠르게 hits번 휘두름(다음 휘두르기는 MapScene.updateSwing 끝에서 이어감)
  chain(scene, sk) {
    if (scene.canSwing) {
      scene.attackWithAssist(chainMods(sk, 0));
      return true;
    }
    // 맨손: 주먹을 빠르게 hits번
    const gap = 150;
    const done = new Set();
    scene.setAct({
      dur: gap * sk.hits + 60,
      lockMove: true,
      update: (dt, t) => {
        const i = Math.floor(t / gap);
        if (i < sk.hits && !done.has(i)) {
          done.add(i);
          scene.punch(chainMods(sk, i));
        }
        return 'punch';
      },
    });
    return true;
  },

  // 돌진: 질풍참·백호일섬 — distance를 dashMs에 미끄러지며 길 위 몬스터를 벰(벽에서 멈춤).
  // delayMs가 있으면 지나간 뒤 그만큼 늦게 한꺼번에 터짐
  dash(scene, sk) {
    const facing = scene.facing;
    const start = { x: scene.pos.x, y: scene.pos.y };
    const grid = scene.map.grid;
    const box = scene.cfg.player.footBox;
    const speed = sk.distance / sk.dashMs;
    const base = scene.skillBase() * sk.damageMul;
    const hitIds = new Set();
    const pending = [];
    const hits = [];
    let moved = 0;
    let stopped = false;
    let ghostT = 0;
    let burst = false;
    const color = skillColor(scene, sk) || sk.windColor;
    scene.sfx.play('swing');
    if (sk.tiger) artTiger(scene, start.x, start.y, facing, A(scene).tiger, sk.distance); // 그림: 흰 호랑이
    const hitAlong = () => {
      for (const m of scene.spawner.monsters) {
        if (m.hp <= 0 || hitIds.has(m.id)) continue;
        const a = along(start, scene.pos, m);
        if (a.t < -8 || a.t > a.len + 12 || a.side > sk.width / 2) continue;
        hitIds.add(m.id);
        if (sk.delayMs) pending.push(m);
        else hits.push(scene.impactHit(m, facing, base, { kind: 'skill', knockbackPx: sk.knockbackPx, quiet: true }));
      }
    };
    scene.setAct({
      dur: sk.dashMs + (sk.delayMs || 0) + 160,
      lockMove: true,
      update: (dt, t) => {
        if (!stopped) {
          const step = Math.min(sk.distance - moved, speed * dt);
          const res = moveStep(grid, scene.pos, facing, step, box, 0);
          scene.pos.x = res.x;
          scene.pos.y = res.y;
          moved += step;
          ghostT -= dt;
          if (ghostT <= 0) {
            ghostT = sk.dashMs / sk.ghosts;
            afterimage(scene, scene.playerView, sk.ghostColor, sk.tiger ? 0.75 : 0.55, sk.tiger ? 420 : 300);
          }
          hitAlong();
          if (!res.moved || moved >= sk.distance - 0.01) {
            stopped = true;
            windStreak(scene, start.x, start.y, scene.pos.x, scene.pos.y, color, sk.windMs, { width: sk.tiger ? 14 : 9, tiger: !!sk.tiger });
            artDashStreak(scene, start, scene.pos, sk.tiger ? A(scene).tigerThick : A(scene).dashThick, sk.tiger ? 450 : 300); // 그림: 빛줄기
            scene.multiHitFeedback(hits, 1, 1.5);
          }
        }
        if (sk.delayMs && stopped && !burst && t >= sk.dashMs + sk.delayMs) {
          burst = true;
          const late = pending.filter((m) => scene.spawner.monsters.includes(m) && m.hp > 0)
            .map((m) => scene.impactHit(m, facing, base, { kind: 'skill', knockbackPx: sk.knockbackPx, starScale: 1.6, quiet: true }));
          windStreak(scene, start.x, start.y, scene.pos.x, scene.pos.y, '#ffffff', 260, { width: 6 });
          scene.multiHitFeedback(late, 1.6, 2.5);
          if (!late.length) scene.cameras.main.shake(scene.cfg.swingFx.shakeMs, scene.cfg.swingFx.shakeIntensity);
        }
        return strikePose(scene);
      },
    });
    return true;
  },

  // 주변: 호통 — 반경 안 몬스터를 멈칫하게 하고 약하게 때림
  shout(scene, sk) {
    const [dx] = DIR[scene.facing];
    shoutRings(scene, scene.pos.x + dx * 6, scene.pos.y - 40, sk);
    artShockRing(scene, scene.pos.x, scene.pos.y, sk.radius * A(scene).shockMul); // 그림: 충격파 고리
    scene.sfx.play('shout');
    scene.cameras.main.shake(scene.cfg.swingFx.shakeMs * 2, scene.cfg.swingFx.shakeIntensity * sk.shakeMul);
    const pr = scene.d.getPixelRatio();
    const hits = scene.monstersInCircle(scene.pos.x, scene.pos.y, sk.radius).map((m) => {
      const def = scene.monsterDefs[m.type];
      exclaim(scene, m.x, m.y - def.height - 18, sk.markText, sk.markColor, sk.stunMs, pr);
      return scene.impactHit(m, scene.dirTo(m), scene.skillBase() * sk.damageMul, { kind: 'skill', knockbackPx: 0, stunMs: sk.stunMs, quiet: true });
    });
    if (hits.length) scene.multiHitFeedback(hits, 0.6, 1);
    scene.setAct({ dur: 300, lockMove: true, update: () => null });
    return true;
  },

  // 앞 직선: 지축 가르기 — 칼을 내리찍는 순간 땅이 갈라지며 금이 지나가는 자리의 몬스터를 벰
  line(scene, sk) {
    scene.attackWithAssist({
      damageMul: sk.damageMul,
      hitStopMul: 1.2,
      onStrike: () => {
        const facing = scene.facing;
        const [dx, dy] = DIR[facing];
        const start = { x: scene.pos.x + dx * 10, y: scene.pos.y + dy * 6 };
        const end = { x: start.x + dx * sk.length, y: start.y + dy * sk.length };
        const base = scene.skillBase() * sk.damageMul;
        const hitIds = new Set();
        scene.cameras.main.shake(scene.cfg.swingFx.shakeMs * 1.5, scene.cfg.swingFx.shakeIntensity * 2);
        scene.sfx.play('punchHit');
        artEarthCrack(scene, start.x, start.y, facing, sk.length * A(scene).earthLength); // 그림: 땅 갈라짐
        groundCrack(scene, start.x, start.y, dx, dy, sk, (dist) => {
          const hits = [];
          for (const m of scene.spawner.monsters) {
            if (m.hp <= 0 || hitIds.has(m.id)) continue;
            const a = along(start, end, m);
            if (a.t < -6 || a.t > dist + 6 || a.side > sk.width / 2) continue;
            hitIds.add(m.id);
            hits.push(scene.impactHit(m, facing, base, { kind: 'skill', knockbackPx: sk.knockbackPx, quiet: true }));
          }
          scene.multiHitFeedback(hits, 0.7, 1.4);
        });
      },
    });
    return true;
  },

  // 날아감: 검풍 — 휘두르는 순간 반달 검기가 앞으로 날아가며 닿는 몬스터를 모두 벰(꿰뚫음, 벽에서 사라짐)
  projectile(scene, sk) {
    scene.attackWithAssist({
      damageMul: sk.damageMul,
      onStrike: () => {
        const facing = scene.facing;
        const [dx, dy] = DIR[facing];
        const p0 = { x: scene.pos.x + dx * 12, y: scene.pos.y + dy * 4 };
        const shot = new CrescentShot(scene, dx, dy, sk.size, skillColor(scene, sk));
        const art = artWindCrescent(scene, p0.x, p0.y - 16, facing, sk.size * A(scene).windSize); // 그림: 반달 검기
        const artScale = art ? art.scaleX : 1;
        const artEnd = () => { if (art) art.destroy(); };
        const base = scene.skillBase() * sk.damageMul;
        const hitIds = new Set();
        const o = { d: 0 };
        scene.tweens.add({
          targets: o,
          d: sk.distance,
          duration: (sk.distance / sk.speed) * 1000,
          onUpdate: (tw) => {
            const x = p0.x + dx * o.d;
            const y = p0.y + dy * o.d;
            if (scene.map.grid.isPointBlocked(x, y)) {
              tw.stop();
              shot.destroy();
              artEnd();
              return;
            }
            const fade = o.d > sk.distance * 0.8 ? (sk.distance - o.d) / (sk.distance * 0.2) : 1;
            shot.draw(x, y, fade);
            if (art) art.setPosition(x, y - 16).setScale(artScale * (1 + (0.3 * o.d) / sk.distance)).setAlpha(0.95 * fade);
            const hits = [];
            for (const m of scene.monstersInCircle(x, y, sk.radius)) {
              if (hitIds.has(m.id)) continue;
              hitIds.add(m.id);
              hits.push(scene.impactHit(m, facing, base, { kind: 'skill', knockbackPx: sk.knockbackPx, color: skillColor(scene, sk), quiet: true }));
            }
            scene.multiHitFeedback(hits, 0.6, 1);
          },
          onComplete: () => { shot.destroy(); artEnd(); },
        });
      },
    });
    return true;
  },

  // 자세: 받아치기 — guardMs 동안 막는 자세. 그 사이 물리면 MapScene.onBitten이 counter()를 부름
  stance(scene, sk) {
    const shield = new GuardShield(scene, sk.shieldColor);
    const art = new ArtShield(scene, A(scene).shield); // 그림: 금빛 막
    scene.sfx.play('swing');
    scene.setAct({
      dur: sk.guardMs,
      lockMove: true,
      guard: {
        sk,
        // 물렸을 때: 데미지 0, 문 몬스터에게 바로 반격(반드시 회심)
        counter: (monster) => {
          shield.destroy();
          art.flash();
          scene.act = null;
          if (!monster || !scene.spawner.monsters.includes(monster)) return;
          const dir = scene.dirTo(monster);
          scene.facing = dir;
          scene.startSwing({ onStrike: () => {} });
          const def = scene.monsterDefs[monster.type];
          hitStar(scene, monster.x, monster.y - def.height * 0.45, 70, sk.shieldColor, 260);
          scene.impactHit(monster, dir, scene.skillBase() * sk.counterMul, { kind: 'skill', knockbackPx: sk.knockbackPx, forceCrit: true, starScale: 1.5 });
        },
      },
      update: (dt, t) => {
        shield.draw(scene.pos.x, scene.pos.y, scene.facing, t);
        art.update(scene.pos, scene.facing);
        return null;
      },
      onEnd: () => { shield.destroy(); art.destroy(); },
    });
    return true;
  },

  // 여러 대상: 뇌전참 — 반경 안 가까운 maxTargets마리에 차례로 번개
  multi(scene, sk) {
    const targets = scene.monstersInCircle(scene.pos.x, scene.pos.y, sk.radius).slice(0, sk.maxTargets);
    const done = new Set();
    const base = scene.skillBase() * sk.damageMul;
    scene.setAct({
      dur: Math.max(1, targets.length) * sk.gapMs + 300,
      lockMove: true,
      update: (dt, t) => {
        targets.forEach((m, i) => {
          if (done.has(i) || t < i * sk.gapMs) return;
          done.add(i);
          lightning(scene, m.x, m.y, sk);
          artLightning(scene, m.x, m.y, A(scene).lightning); // 그림: 번개(아래 끝 = 몬스터 발)
          scene.sfx.play('thunder');
          scene.cameras.main.flash(70, 200, 220, 255);
          if (scene.spawner.monsters.includes(m) && m.hp > 0) {
            const r = scene.impactHit(m, scene.dirTo(m), base, { kind: 'skill', knockbackPx: sk.knockbackPx, color: sk.boltColor, quiet: true });
            scene.multiHitFeedback([r], 0.8, 1.6);
          }
        });
        if (!targets.length && !done.has(-1)) {
          done.add(-1);
          lightning(scene, scene.pos.x + DIR[scene.facing][0] * 40, scene.pos.y + DIR[scene.facing][1] * 30, sk);
          scene.sfx.play('thunder');
        }
        // 칼을 하늘로 치켜든 자세
        return scene.canSwing ? { theta: -35, lean: 0 } : 'punch';
      },
    });
    return true;
  },

  // 궁극: 칠성검무 — 북두칠성 자리 7곳을 차례로 베고, 마지막에 가운데 큰 폭발
  ultimate(scene, sk) {
    const c = { x: scene.pos.x, y: scene.pos.y };
    // 북두칠성(국자 손잡이 → 머리, 땅에 누운 모양으로 세로 0.6배)
    const shape = [[-1.0, -0.3], [-0.62, -0.42], [-0.28, -0.3], [0.02, -0.1], [0.08, 0.32], [0.6, 0.38], [0.66, -0.02]];
    const pts = shape.map(([x, y]) => ({ x: c.x + x * sk.size, y: c.y + y * sk.size * 0.6 }));
    const map = new StarMap(scene, pts, sk.color);
    const step = sk.durationMs / 8;
    const base = scene.skillBase();
    const done = new Set();
    const color = skillColor(scene, sk);
    scene.setAct({
      dur: sk.durationMs + 300,
      lockMove: true,
      update: (dt, t) => {
        map.update(dt);
        pts.forEach((p, i) => {
          if (done.has(i) || t < (i + 0.5) * step) return;
          done.add(i);
          map.light(i);
          scene.skillFx.skyStar(i); // 하늘의 북두칠성도 켜지고 터짐
          scene.facing = scene.dirTo(p, c);
          scene.sfx.play('swing');
          slashMark(scene, p.x, p.y - 14, scene.facing, 46, 4, color, 260);
          hitStar(scene, p.x, p.y - 14, 34, sk.color, 180);
          artCrescent(scene, p.x, p.y - 14, scene.facing, A(scene).starCrescent, { flip: i % 2 === 1 }); // 그림: 별마다 초승달·별빛
          artStarBurst(scene, p.x, p.y - 14, A(scene).starBurst, 0.5, 1.2, 320);
          const hits = scene.monstersInCircle(p.x, p.y, sk.starRadius)
            .map((m) => scene.impactHit(m, scene.dirTo(m, p), base * sk.damageMul, { kind: 'skill', knockbackPx: sk.knockbackPx, color, quiet: true }));
          scene.multiHitFeedback(hits, 0.6, 1.2);
        });
        if (!done.has('final') && t >= 7.6 * step) {
          done.add('final');
          bigBurst(scene, c.x, c.y, sk.finalRadius * 1.2, sk.color, 520);
          scene.skillFx.ultimateFinal(); // 화면 흰 섬광 + 느린 화면
          artStarBurst(scene, c.x, c.y - 14, A(scene).finalBurst, 0.5, 2.2, 500); // 그림: 큰 별빛 폭발
          scene.sfx.play('thunder');
          scene.cameras.main.flash(120, 255, 230, 160);
          const hits = scene.monstersInCircle(c.x, c.y, sk.finalRadius)
            .map((m) => scene.impactHit(m, scene.dirTo(m, c), base * sk.finalDamageMul, { kind: 'skill', knockbackPx: sk.knockbackPx * 2, starScale: 2, color, quiet: true }));
          scene.multiHitFeedback(hits, 2, 3);
          if (!hits.length) scene.cameras.main.shake(200, scene.cfg.swingFx.shakeIntensity * 3);
        }
        // 별마다 칼을 치켜들었다 내려침
        const k = (t % step) / step;
        return scene.canSwing ? { theta: -40 + 165 * Math.min(1, k * 1.6), lean: 0 } : 'punch';
      },
      onEnd: () => map.destroy(),
    });
    return true;
  },
};

// 회오리 베기 끌어당김: 둘레 몬스터를 주인공 쪽으로 pullPx만큼 밀어 줌(벽은 몬스터 움직임 규칙이 막음)
export function pullMonsters(scene, sk) {
  for (const m of scene.monstersInCircle(scene.pos.x, scene.pos.y, sk.pullRadius)) {
    if (Math.hypot(m.x - scene.pos.x, m.y - scene.pos.y) < 18) continue;
    m.knockDir = REVERSE[scene.dirTo(m)];
    m.knockLeft = Math.max(m.knockLeft || 0, sk.pullPx);
  }
}
