// 맵 화면(마을·던전 공통): 통그림 맵 + 보이지 않는 격자 + 주인공 + 몬스터 + 카메라 따라가기.
// 맵 사이 이동은 맵 JSON의 portals: 발이 사각형에 들어가면 화면이 어두워졌다가 다음 맵에서 밝아짐.
import { Grid } from '../core/grid.js';
import { parseMap, serializeMap } from '../core/mapData.js';
import { dirFromVector, moveStep, nearestStandable } from '../core/movement.js';
import { MonsterSpawner } from '../core/monsters.js';
import { findTarget, hitMonster } from '../core/combat.js';
import { loadOutfitImages, buildOutfitFrames } from './characterFrames.js';
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
    this.attackCooldown = 0; // 다음 공격까지 남은 시간
    // 이동 지점 위에서 시작하면 한 번 밖으로 나가야 다시 작동 (도착하자마자 되돌아가지 않게)
    this.portalArmed = !this.portalAt(this.pos.x, this.pos.y);

    this.playerView = new PlayerView(this, cfg.player, this.d.outfits.canvas, cfg.shadow);
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
    Promise.all([this.setOutfit(this.d.outfitIndex), monsterReady]).then(() => {
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
    this.playerView.setFrames(buildOutfitFrames(this.textures, outfit, images, scale), scale);
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
    const view = new MonsterView(this, this.monsterDefs[m.type], this.d.monsters.canvas, tex, this.cfg.shadow);
    view.update(0, m);
    this.monsterViews.set(m.id, view);
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
    const dt = Math.min(delta, 50); // 앱 전환 직후 큰 delta로 순간이동하지 않게
    const p = this.cfg.player;
    // 공격: 쿨다운이 끝났고 버튼(스페이스)이 눌려 있으면 주먹
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.punchMs = Math.max(0, this.punchMs - dt);
    // 쿨다운 중에 톡 친 것은 버리지 않고 쿨다운이 끝나면 나감
    const wantAttack = this.attackCooldown <= 0 && this.attackButton.consume();
    if (wantAttack && this.attackCooldown <= 0 && !this.transitioning && !this.gridOn) this.punch();
    const punching = this.punchMs > 0;

    // 주먹 지르는 동안은 걷지 않음
    const v = this.transitioning || punching ? { x: 0, y: 0 } : this.d.input.getVector();
    this.dir = dirFromVector(v.x, v.y, this.cfg.joystick.deadZone, this.dir);

    this.moving = false;
    if (this.dir) {
      this.facing = this.dir;
      const res = moveStep(this.map.grid, this.pos, this.dir, (p.speed * dt) / 1000, p.footBox, p.cornerSlide);
      this.pos.x = res.x;
      this.pos.y = res.y;
      this.moving = res.moved;
    }
    this.checkPortal();
    for (const fx of this.portalFx) fx.update(this.pos.x, this.pos.y);

    this.playerView.update(dt, this.pos.x, this.pos.y, this.facing, this.moving, punching);
    // 지붕·나무 조각은 캐릭터 발이 그 조각의 가로 범위(hideX) 안에 있을 때만 앞뒤를 따짐.
    // 범위 밖(건물 옆)에서는 항상 캐릭터가 위에 그려져, 처마 끝에 몸이 잘리지 않음.
    for (const occ of this.occluders) {
      const inRange = this.pos.x >= occ.hideX[0] && this.pos.x <= occ.hideX[1];
      occ.image.setDepth(inRange ? occ.baseY : -0.5);
    }

    // 몬스터
    for (const m of this.spawner.update(dt)) this.addMonsterView(m);
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
