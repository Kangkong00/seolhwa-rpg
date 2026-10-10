// 맵 화면(마을·던전 공통): 통그림 맵 + 보이지 않는 격자 + 주인공 + 몬스터 + 카메라 따라가기.
// 맵 사이 이동은 맵 JSON의 portals: 발이 사각형에 들어가면 화면이 어두워졌다가 다음 맵에서 밝아짐.
import { Grid } from '../core/grid.js';
import { parseMap, serializeMap } from '../core/mapData.js';
import { dirFromVector, moveStep, nearestStandable } from '../core/movement.js';
import { MonsterSpawner } from '../core/monsters.js';
import { findTarget, hitMonster, hitPlayer } from '../core/combat.js';
import { loadOutfitImages, buildOutfitFrames, loadImage, downscale } from './characterFrames.js';
import { InkTrail, inkSplash } from './weaponFx.js';
import { swingTheta } from './weaponPose.js';
import { PlayerView } from './PlayerView.js';
import { MonsterView, loadMonsterTextures } from './MonsterView.js';
import { createOccluders } from './occluders.js';
import { PortalFx } from './portalFx.js';
import { showDamage } from './damageText.js';
import { AttackButton } from '../ui/attackButton.js';
import { GridOverlay } from './gridOverlay.js';
import { Hud } from '../ui/hud.js';
import { EditorPanel, downloadText } from '../ui/editorPanel.js';
import { loadSave, writeSave, loadGridEdit, writeGridEdit, clearGridEdit } from '../save/localSave.js';

export class MapScene extends Phaser.Scene {
  constructor() {
    super('map');
  }

  // data: { game, outfits, monsters, mapId, mapJson, arrive?, fetchMap, input, joystick, getPixelRatio, onReady }
  // 맵을 옮길 때마다 같은 data에 mapId·mapJson·arrive만 바꿔 장면을 다시 시작함
  init(data) {
    this.d = data;
    this.d.scene = this;
  }

  preload() {
    this.mapKey = `map:${this.d.mapId}`;
    if (!this.textures.exists(this.mapKey)) this.load.image(this.mapKey, this.d.mapJson.image);
  }

  create() {
    const { game: cfg, mapId } = this.d;
    this.cfg = cfg;
    this.map = this.loadMap();
    this.transitioning = false;

    // 맵 그림이 좌표계보다 크면(고해상도 그림) 좌표계 크기로 줄여 그림
    this.add.image(0, 0, this.mapKey).setOrigin(0, 0).setDisplaySize(this.map.width, this.map.height).setDepth(-1);
    this.occluders = createOccluders(this, this.mapKey, this.map.occluders, this.map.width, this.map.height);
    // 던전 입구 표시: 빛나는 테두리 + 가까이 가면 이름표
    this.portalFx = this.map.portals.map((p) => new PortalFx(this, p, cfg.portalFx, this.d.getPixelRatio()));

    // 주인공 상태 (위치는 발끝 기준). 맵 이동으로 왔으면 도착 지점, 아니면 저장 위치, 없으면 맵의 시작 위치
    const save = loadSave();
    const box = cfg.player.footBox;
    let start = this.map.spawn;
    let facing = 'down';
    if (this.d.arrive) {
      start = this.d.arrive;
      facing = this.d.arrive.facing || facing;
    } else if (save && save.map === mapId && Number.isFinite(save.x) && Number.isFinite(save.y)) {
      start = { x: save.x, y: save.y };
      facing = save.facing || facing;
    }
    const safe = nearestStandable(this.map.grid, start.x, start.y, box) || this.map.spawn;
    this.pos = { x: safe.x, y: safe.y };
    this.facing = facing;
    this.dir = null;
    this.moving = false;
    this.punchMs = 0; // 남은 주먹 자세 시간
    this.swing = null; // 무기 휘두르는 중: { weapon, t, hitDone, trail }
    this.hitStopMs = 0; // 맞는 순간 아주 짧게 멈춤
    this.knock = { dir: null, left: 0 }; // 물려서 밀려나는 중
    this.dead = false;
    // 주인공 체력: 맵을 옮겨도 이어짐. 처음이거나 쓰러졌다 다시 시작하면 가득
    if (!this.d.player || this.d.player.hp <= 0) this.d.player = { hp: cfg.player.maxHp, maxHp: cfg.player.maxHp };
    this.player = this.d.player;
    this.attackCooldown = 0; // 다음 공격까지 남은 시간
    // 이동 지점 위에서 시작하면 한 번 밖으로 나가야 다시 작동 (도착하자마자 되돌아가지 않게)
    this.portalArmed = !this.portalAt(this.pos.x, this.pos.y);

    this.playerView = new PlayerView(this, cfg.player, this.d.outfits.canvas, cfg.shadow, cfg.hpBar);
    this.playerView.setHp(this.player.hp / this.player.maxHp);
    // 시험용 무기: 저장된 것, 없으면 swingFx.startWeapon
    if (this.d.weaponId === undefined) {
      this.d.weaponId = save && save.weapon !== undefined ? save.weapon : cfg.swingFx.startWeapon || '';
    }
    if (this.d.outfitIndex === undefined) {
      const id = (save && save.outfit) || cfg.startOutfit;
      this.d.outfitIndex = Math.max(0, this.d.outfits.outfits.findIndex((o) => o.id === id));
    }

    // 카메라 (1.0배 고정)
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.map.width, this.map.height);
    this.followTarget = { x: this.pos.x, y: this.pos.y - cfg.player.height * 0.45 };
    cam.startFollow(this.followTarget, false, 1, 1);
    this.applyZoom();
    const onResize = () => this.applyZoom();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));

    // 시험용 버튼·격자 편집 도구는 처음 한 번만 만들고, 지금 장면으로 연결
    if (!this.d.hud) {
      this.d.hud = new Hud({
        onOutfit: () => this.d.scene.changeOutfit(1),
        onWeapon: () => this.d.scene.changeWeapon(),
        onGrid: () => this.d.scene.setGridMode(!this.d.scene.gridOn),
      });
      this.d.editor = new EditorPanel({
        onExport: () => this.d.scene.exportGrid(),
        onReset: () => this.d.scene.resetGrid(),
        onClose: () => this.d.scene.setGridMode(false),
      });
      this.d.attackButton = new AttackButton(document.getElementById('btn-attack'));
      // 자동 저장: 앱이 가려질 때
      const saveNow = () => this.d.scene.save();
      document.addEventListener('visibilitychange', () => document.hidden && saveNow());
      window.addEventListener('pagehide', saveNow);
    }
    this.hud = this.d.hud;
    this.editor = this.d.editor;
    this.attackButton = this.d.attackButton;
    this.overlay = new GridOverlay(this);
    this.setGridMode(false);
    this.setupPainting();
    this.input.keyboard.on('keydown', (e) => {
      if (e.code === 'KeyG') this.setGridMode(!this.gridOn);
      const n = Number(e.key);
      if (n >= 1 && n <= this.d.outfits.outfits.length) this.setOutfit(n - 1);
    });

    // 몬스터
    this.monsterDefs = Object.fromEntries(this.d.monsters.monsters.map((m) => [m.id, m]));
    this.spawner = new MonsterSpawner(this.map, this.monsterDefs);
    this.monsterViews = new Map();
    const monsterReady = this.prepareMonsterTextures().then(() => {
      for (const m of this.spawner.monsters) this.addMonsterView(m);
    });

    // 자동 저장: 주기적으로
    this.time.addEvent({ delay: cfg.autoSaveMs, loop: true, callback: () => this.save() });

    this.fpsTimer = 0;
    cam.fadeIn(this.cfg.mapFadeMs);
    Promise.all([this.setOutfit(this.d.outfitIndex), monsterReady]).then(async () => {
      await this.setWeapon(this.d.weaponId);
      this.save();
      if (this.d.onReady) this.d.onReady();
    });
  }

  applyZoom() {
    this.cameras.main.setZoom(this.cfg.cameraZoom * this.d.getPixelRatio());
  }

  // 화면에 실제로 보일 크기에 맞춰 그림 텍스처 축소 비율을 정함
  pixelScale() {
    return this.cfg.cameraZoom * this.d.getPixelRatio();
  }

  textureScale() {
    const px = this.cfg.player.height * this.pixelScale();
    return Math.min(1, (px * 1.25) / this.d.outfits.canvas.standHeight);
  }

  async setOutfit(index) {
    const list = this.d.outfits.outfits;
    this.d.outfitIndex = ((index % list.length) + list.length) % list.length;
    const outfit = list[this.d.outfitIndex];
    this.hud.setOutfitLabel(outfit.name);
    const images = await loadOutfitImages(outfit);
    if (list[this.d.outfitIndex] !== outfit || !this.sys.isActive()) return; // 그새 다른 옷을 고르거나 맵을 옮김
    const scale = this.textureScale();
    this.frames = buildOutfitFrames(this.textures, outfit, images, scale);
    this.playerView.setFrames(this.frames, scale);
    if (this.weaponDef) this.applyWeapon();
    this.playerView.update(0, this.pos.x, this.pos.y, this.facing, false);
  }

  changeOutfit(step) {
    this.setOutfit(this.d.outfitIndex + step);
  }

  save() {
    if (!this.pos) return;
    writeSave({
      map: this.d.mapId,
      x: Math.round(this.pos.x),
      y: Math.round(this.pos.y),
      facing: this.facing,
      outfit: this.d.outfits.outfits[this.d.outfitIndex].id,
      weapon: this.d.weaponId || '',
    });
  }

  // 맵 파일 + 이 기기에 저장된 격자 편집
  loadMap() {
    const map = parseMap(this.d.mapJson);
    const edited = loadGridEdit(this.d.mapId);
    if (Array.isArray(edited) && edited.length === map.grid.rows && edited[0].length === map.grid.cols) {
      map.grid = Grid.fromRows(edited, map.cellSize);
    }
    return map;
  }

  // ---------- 몬스터 ----------
  async prepareMonsterTextures() {
    const types = new Set(this.map.spawnZones.map((z) => z.monster));
    this.monsterTextures = {};
    for (const t of types) {
      const def = this.monsterDefs[t];
      if (def) this.monsterTextures[t] = await loadMonsterTextures(this, def, this.d.monsters.canvas, this.pixelScale());
    }
  }

  addMonsterView(m) {
    const tex = this.monsterTextures && this.monsterTextures[m.type];
    if (!tex || !this.sys.isActive()) return;
    const view = new MonsterView(this, this.monsterDefs[m.type], this.d.monsters.canvas, tex, this.cfg.shadow, this.cfg.hpBar);
    view.update(0, m);
    this.monsterViews.set(m.id, view);
  }

  // ---------- 무기 (시험용 바꾸기 버튼: 맨손 → 소나무 → 참나무 → 박달나무) ----------
  async setWeapon(id) {
    const list = this.d.weapons.weapons;
    const def = list.find((w) => w.id === id) || null;
    this.d.weaponId = def ? def.id : '';
    this.weaponDef = def;
    this.hud.setWeaponLabel(def ? def.name.replace(' 목검', '') : '맨손');
    if (def) {
      const key = `weapon:${def.id}`;
      const scale = this.textureScale();
      if (!this.textures.exists(key)) {
        const img = await loadImage(def.image);
        if (!img || !this.sys.isActive()) return;
        if (!this.textures.exists(key)) this.textures.addCanvas(key, downscale(img, scale));
      }
      this.weaponTexScale = scale;
    }
    this.applyWeapon();
  }

  // 지금 옷에 무기 붙이는 값과 휘두르기 자세가 있으면 무기를 손에, 없으면 주먹으로
  applyWeapon() {
    const def = this.weaponDef;
    const outfit = this.d.outfits.outfits[this.d.outfitIndex];
    const attach = def && this.d.weapons.attach[outfit.id];
    if (def && attach && this.frames && this.frames.canSwing) {
      this.playerView.setWeapon({
        def,
        key: `weapon:${def.id}`,
        canvas: this.d.weapons.canvas,
        attach,
        swing: this.d.weapons.swing,
        textureScale: this.weaponTexScale,
      });
      this.canSwing = true;
    } else {
      this.playerView.setWeapon(null);
      this.canSwing = false;
    }
  }

  changeWeapon() {
    const ids = ['', ...this.d.weapons.weapons.map((w) => w.id)];
    const i = ids.indexOf(this.d.weaponId || '');
    this.setWeapon(ids[(i + 1) % ids.length]);
  }

  // 무기 휘두르기 시작 (칼이 앞을 지나는 순간 맞힘 판정)
  startSwing() {
    const w = this.weaponDef;
    this.swing = { weapon: w, t: 0, hitDone: false, trail: null };
    this.attackCooldown = w.cooldownMs;
    const res = moveStep(this.map.grid, this.pos, this.facing, w.stepPx, this.cfg.player.footBox, 0);
    this.pos.x = res.x;
    this.pos.y = res.y;
  }

  // 휘두르는 중 한 프레임. 칼 방향 theta를 thetaFrom → thetaTo로 돌림(처음엔 느리고 끝으로 빠르게).
  // 몸 그림은 PlayerView가 theta로 고름(bodySwitchTheta까지 raise, 그 뒤 strike).
  // 반환: 그릴 자세 { theta } 또는 null(끝남)
  updateSwing(dt) {
    const s = this.swing;
    const w = s.weapon;
    const sw = this.d.weapons.swing;
    s.t += dt;
    if (s.t >= w.swingMs + sw.recoverMs) {
      if (s.trail) s.trail.fadeOut();
      this.swing = null;
      return null;
    }
    const theta = swingTheta(sw, s.t / w.swingMs);
    // 칼이 앞을 지나는 순간(hitTheta) 맞힘 판정
    if (!s.hitDone && theta >= sw.hitTheta) {
      s.hitDone = true;
      this.strikeHit(w);
    }
    // 먹선: 칼끝이 화면에서 실제로 지나간 자리(theta마다 그때 보이는 몸 그림의 주먹 기준)를 따라 그림
    if (!s.trail) s.trail = new InkTrail(this, w.trailColor, this.cfg.swingFx, this.pos.y + 0.005);
    const facing = this.facing;
    const x = this.pos.x;
    const y = this.pos.y;
    const pv = this.playerView;
    const lat = pv.swingLat(facing);
    const span = sw.thetaTo - sw.thetaFrom;
    const geometryAt = (k) => {
      const th = sw.thetaFrom + span * k;
      return pv.weaponGeometry(facing, pv.swingPose(th), th, lat, x, y);
    };
    s.trail.draw(geometryAt, (theta - sw.thetaFrom) / span);
    if (s.t >= w.swingMs) s.trail.fadeOut();
    return { theta };
  }

  // 내려치는 순간: 앞의 몬스터 1마리 맞힘 + 히트스톱·먹 튐·화면 흔들림
  strikeHit(w) {
    const fx = this.cfg.hitFx;
    const sfx = this.cfg.swingFx;
    const target = findTarget(this.pos, this.facing, this.spawner.monsters, w.reach, w.width);
    if (!target) return;
    const result = hitMonster(target, this.facing, w.damage, w.knockbackPx, w.stunMs);
    const def = this.monsterDefs[target.type];
    const view = this.monsterViews.get(target.id);
    showDamage(this, target.x, target.y - def.height - 2, result.damage, fx, this.d.getPixelRatio());
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing];
    inkSplash(this, target.x, target.y - def.height * 0.45, w.trailColor, sfx, d[0], d[1]);
    this.hitStopMs = sfx.hitStopMs;
    this.cameras.main.shake(sfx.shakeMs, sfx.shakeIntensity);
    if (result.killed) {
      this.spawner.remove(target);
      this.monsterViews.delete(target.id);
      if (view) view.die(fx.deathMs, fx.flashMs);
    } else if (view) {
      view.flash(fx.flashMs);
    }
  }

  // ---------- 주먹 지르기 ----------
  // 바라보는 쪽으로 조금 내딛고, 바로 앞 몬스터 1마리를 맞힘
  punch() {
    const a = this.cfg.attack;
    const fx = this.cfg.hitFx;
    this.punchMs = a.punchMs;
    this.attackCooldown = a.cooldownMs;
    const p = this.cfg.player;
    const res = moveStep(this.map.grid, this.pos, this.facing, a.stepPx, p.footBox, 0);
    this.pos.x = res.x;
    this.pos.y = res.y;

    const target = findTarget(this.pos, this.facing, this.spawner.monsters, a.reach, a.width);
    if (!target) return;
    const result = hitMonster(target, this.facing, a.damage, a.knockbackPx, a.stunMs);
    const def = this.monsterDefs[target.type];
    const view = this.monsterViews.get(target.id);
    showDamage(this, target.x, target.y - def.height - 2, result.damage, fx, this.d.getPixelRatio());
    if (result.killed) {
      // 규칙에서 바로 빼서 다시 생기는 시간이 흐르기 시작하고, 그림은 쓰러지는 연출 뒤 사라짐
      this.spawner.remove(target);
      this.monsterViews.delete(target.id);
      if (view) view.die(fx.deathMs, fx.flashMs);
    } else if (view) {
      view.flash(fx.flashMs);
    }
  }

  // ---------- 주인공이 물림 ----------
  onBitten(bite) {
    if (this.dead || this.transitioning) return;
    const ph = this.cfg.playerHit;
    const result = hitPlayer(this.player, bite.damage);
    this.playerView.setHp(this.player.hp / this.player.maxHp);
    this.playerView.flash(ph.flashColor, ph.flashMs);
    showDamage(this, this.pos.x, this.pos.y - this.cfg.player.height - 8, result.damage, { ...this.cfg.hitFx, damageColor: '#ffb0a0' }, this.d.getPixelRatio());
    this.knock = { dir: bite.dir, left: ph.knockbackPx };
    if (result.killed) this.die();
  }

  // 쓰러짐: 화면이 어두워진 뒤 마을 시작 위치에서 체력 가득 차서 다시 시작 (임시)
  die() {
    this.dead = true;
    this.transitioning = true;
    const cam = this.cameras.main;
    cam.fadeOut(this.cfg.playerHit.deathFadeMs, 40, 0, 0);
    const start = this.cfg.startMap;
    const next = this.d.fetchMap(start);
    cam.once('camerafadeoutcomplete', async () => {
      const mapJson = await next;
      this.d.player = { hp: this.cfg.player.maxHp, maxHp: this.cfg.player.maxHp };
      this.scene.restart({ ...this.d, mapId: start, mapJson, arrive: { ...mapJson.spawn, facing: 'down' } });
    });
  }

  // ---------- 맵 이동 ----------
  portalAt(x, y) {
    return this.map.portals.find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) || null;
  }

  checkPortal() {
    const p = this.portalAt(this.pos.x, this.pos.y);
    if (!p) {
      this.portalArmed = true;
      return;
    }
    if (!this.portalArmed || this.transitioning) return;
    this.transitioning = true;
    this.save();
    const cam = this.cameras.main;
    const next = this.d.fetchMap(p.to);
    cam.fadeOut(this.cfg.mapFadeMs, 0, 0, 0);
    cam.once('camerafadeoutcomplete', async () => {
      try {
        const mapJson = await next;
        this.scene.restart({ ...this.d, mapId: p.to, mapJson, arrive: p.arrive });
      } catch (err) {
        console.error(err);
        this.transitioning = false;
        cam.fadeIn(this.cfg.mapFadeMs);
      }
    });
  }

  // ---------- 격자 편집 ----------
  setGridMode(on) {
    this.gridOn = on;
    this.hud.setGridOn(on);
    this.editor.setVisible(on);
    this.overlay.setVisible(on);
    // 편집 중에는 화면 왼쪽도 칠할 수 있게 조이스틱을 끔 (PC는 방향키로 이동)
    this.d.joystick.setEnabled(!on);
    if (this.d.attackButton) this.d.attackButton.setVisible(!on);
    if (on) this.overlay.draw(this.map.grid, this.map);
  }

  setupPainting() {
    let paintValue = null;
    let lastCell = null;
    const paint = (pointer) => {
      const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const { c, r } = this.map.grid.cellAt(p.x, p.y);
      if (lastCell && lastCell.c === c && lastCell.r === r) return;
      lastCell = { c, r };
      if (paintValue === null) paintValue = !this.map.grid.isCellBlocked(c, r);
      const half = Math.floor(this.editor.brushSize / 2);
      let changed = false;
      for (let dr = -half; dr <= half; dr++) {
        for (let dc = -half; dc <= half; dc++) {
          changed = this.map.grid.setCell(c + dc, r + dr, paintValue) || changed;
        }
      }
      if (changed) this.overlay.draw(this.map.grid, this.map);
    };
    this.input.on('pointerdown', (pointer) => {
      if (!this.gridOn) return;
      paintValue = null;
      lastCell = null;
      paint(pointer);
    });
    this.input.on('pointermove', (pointer) => {
      if (this.gridOn && pointer.isDown && paintValue !== null) paint(pointer);
    });
    this.input.on('pointerup', () => {
      if (paintValue !== null) writeGridEdit(this.d.mapId, this.map.grid.toRows());
      paintValue = null;
    });
  }

  exportGrid() {
    downloadText(`${this.d.mapId}.json`, serializeMap(this.d.mapJson, this.map.grid));
  }

  resetGrid() {
    clearGridEdit(this.d.mapId);
    this.map.grid = parseMap(this.d.mapJson).grid;
    this.overlay.draw(this.map.grid, this.map);
  }

  // ---------- 매 프레임 ----------
  update(time, delta) {
    // 히트스톱: 맞는 순간 아주 짧게 모든 움직임을 멈춤 (연출 트윈은 계속)
    if (this.hitStopMs > 0) {
      this.hitStopMs -= delta;
      return;
    }
    const dt = Math.min(delta, 50); // 앱 전환 직후 큰 delta로 순간이동하지 않게
    const p = this.cfg.player;
    // 공격: 쿨다운이 끝났고 버튼(스페이스)이 눌려 있으면 주먹
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.punchMs = Math.max(0, this.punchMs - dt);
    // 쿨다운 중에 톡 친 것은 버리지 않고 쿨다운이 끝나면 나감
    const wantAttack = this.attackCooldown <= 0 && this.attackButton.consume();
    if (wantAttack && !this.swing && !this.transitioning && !this.gridOn && !this.dead) {
      if (this.canSwing) this.startSwing();
      else this.punch();
    }
    const swingPose = this.swing ? this.updateSwing(dt) : null;
    const punching = this.punchMs > 0 || !!swingPose;

    // 주먹 지르는 동안은 걷지 않음
    const v = this.transitioning || punching ? { x: 0, y: 0 } : this.d.input.getVector();
    this.dir = dirFromVector(v.x, v.y, this.cfg.joystick.deadZone, this.dir);

    this.moving = false;
    // 물려서 밀려나는 중 (벽은 통과 안 함)
    if (this.knock.left > 0) {
      const step = Math.min(this.knock.left, (160 * dt) / 1000);
      const res = moveStep(this.map.grid, this.pos, this.knock.dir, step, p.footBox, 0);
      this.pos.x = res.x;
      this.pos.y = res.y;
      this.knock.left = res.moved ? this.knock.left - step : 0;
    }
    if (this.dir && !this.dead) {
      this.facing = this.dir;
      const res = moveStep(this.map.grid, this.pos, this.dir, (p.speed * dt) / 1000, p.footBox, p.cornerSlide);
      this.pos.x = res.x;
      this.pos.y = res.y;
      this.moving = res.moved;
    }
    this.checkPortal();
    for (const fx of this.portalFx) fx.update(this.pos.x, this.pos.y);

    this.playerView.update(dt, this.pos.x, this.pos.y, this.facing, this.moving, swingPose || (this.punchMs > 0 ? 'punch' : null));
    // 지붕·나무 조각은 캐릭터 발이 그 조각의 가로 범위(hideX) 안에 있을 때만 앞뒤를 따짐.
    // 범위 밖(건물 옆)에서는 항상 캐릭터가 위에 그려져, 처마 끝에 몸이 잘리지 않음.
    for (const occ of this.occluders) {
      const inRange = this.pos.x >= occ.hideX[0] && this.pos.x <= occ.hideX[1];
      occ.image.setDepth(inRange ? occ.baseY : -0.5);
    }

    // 몬스터
    const target = { x: this.pos.x, y: this.pos.y, alive: !this.dead && !this.transitioning };
    const { born, bites } = this.spawner.update(dt, target);
    for (const m of born) this.addMonsterView(m);
    for (const b of bites) this.onBitten(b);
    for (const m of this.spawner.monsters) {
      const view = this.monsterViews.get(m.id);
      if (view) view.update(dt, m);
    }

    // 카메라는 발이 아니라 몸 가운데를 따라감 (걷기 들썩임은 따라가지 않음)
    this.followTarget.x = this.pos.x;
    this.followTarget.y = this.pos.y - p.height * 0.45;

    if (this.gridOn) {
      this.fpsTimer += delta;
      if (this.fpsTimer > 500) {
        this.fpsTimer = 0;
        this.hud.setFps(this.game.loop.actualFps);
      }
    }
  }
}
