// 마을 화면: 통그림 맵 + 보이지 않는 격자 + 주인공 + 카메라 따라가기.
import { Grid } from '../core/grid.js';
import { parseMap, serializeMap } from '../core/mapData.js';
import { dirFromVector, moveStep, nearestStandable } from '../core/movement.js';
import { loadOutfitImages, buildOutfitFrames } from './characterFrames.js';
import { PlayerView } from './PlayerView.js';
import { createOccluders } from './occluders.js';
import { GridOverlay } from './gridOverlay.js';
import { Hud } from '../ui/hud.js';
import { EditorPanel, downloadText } from '../ui/editorPanel.js';
import { loadSave, writeSave, loadGridEdit, writeGridEdit, clearGridEdit } from '../save/localSave.js';

export class VillageScene extends Phaser.Scene {
  constructor() {
    super('village');
  }

  // data: { game, outfits, mapId, mapJson, input, joystick, getPixelRatio, onReady }
  init(data) {
    this.d = data;
  }

  preload() {
    this.mapKey = `map:${this.d.mapId}`;
    this.load.image(this.mapKey, this.d.mapJson.image);
  }

  create() {
    const { game: cfg, mapJson, mapId } = this.d;
    this.cfg = cfg;
    this.map = parseMap(mapJson);

    // 기기에 저장된 격자 편집 내용이 있으면 적용
    const edited = loadGridEdit(mapId);
    if (Array.isArray(edited) && edited.length === this.map.grid.rows && edited[0].length === this.map.grid.cols) {
      this.map.grid = Grid.fromRows(edited, this.map.cellSize);
    }

    // 맵 그림이 좌표계보다 크면(고해상도 그림) 좌표계 크기로 줄여 그림
    this.add.image(0, 0, this.mapKey).setOrigin(0, 0).setDisplaySize(this.map.width, this.map.height).setDepth(-1);
    this.occluders = createOccluders(this, this.mapKey, this.map.occluders, this.map.width);

    // 주인공 상태 (위치는 발끝 기준)
    const save = loadSave();
    const box = cfg.player.footBox;
    let start = this.map.spawn;
    if (save && save.map === mapId && Number.isFinite(save.x) && Number.isFinite(save.y)) start = { x: save.x, y: save.y };
    const safe = nearestStandable(this.map.grid, start.x, start.y, box) || this.map.spawn;
    this.pos = { x: safe.x, y: safe.y };
    this.facing = (save && save.facing) || 'down';
    this.dir = null;
    this.moving = false;

    this.playerView = new PlayerView(this, cfg.player, this.d.outfits.canvas, cfg.shadow);
    this.outfitIndex = Math.max(0, this.d.outfits.outfits.findIndex((o) => o.id === ((save && save.outfit) || cfg.startOutfit)));

    // 카메라
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.map.width, this.map.height);
    this.followTarget = { x: this.pos.x, y: this.pos.y };
    cam.startFollow(this.followTarget, false, 1, 1);

    // 격자 보기·편집
    this.overlay = new GridOverlay(this);
    this.gridOn = false;
    this.hud = new Hud({
      onOutfit: () => this.changeOutfit(1),
      onGrid: () => this.setGridMode(!this.gridOn),
    });
    this.editor = new EditorPanel({
      onExport: () => this.exportGrid(),
      onReset: () => this.resetGrid(),
      onClose: () => this.setGridMode(false),
    });

    // 확대 배율: data/game.json의 cameraZoom (1.0배 확정)
    this.applyZoom();
    this.scale.on('resize', () => this.applyZoom());
    this.setupPainting();
    this.input.keyboard.on('keydown', (e) => {
      if (e.code === 'KeyG') this.setGridMode(!this.gridOn);
      const n = Number(e.key);
      if (n >= 1 && n <= this.d.outfits.outfits.length) this.setOutfit(n - 1);
    });

    // 자동 저장: 주기적으로 + 앱이 가려질 때
    this.time.addEvent({ delay: cfg.autoSaveMs, loop: true, callback: () => this.save() });
    const saveNow = () => this.save();
    document.addEventListener('visibilitychange', () => document.hidden && saveNow());
    window.addEventListener('pagehide', saveNow);

    this.fpsTimer = 0;
    this.setOutfit(this.outfitIndex).then(() => this.d.onReady && this.d.onReady());
  }

  applyZoom() {
    this.cameras.main.setZoom(this.cfg.cameraZoom * this.d.getPixelRatio());
  }

  // 화면에 실제로 보일 크기에 맞춰 캐릭터 텍스처 축소 비율을 정함
  textureScale() {
    const px = this.cfg.player.height * this.cfg.cameraZoom * this.d.getPixelRatio();
    return Math.min(1, (px * 1.25) / this.d.outfits.canvas.standHeight);
  }

  async setOutfit(index) {
    const list = this.d.outfits.outfits;
    this.outfitIndex = ((index % list.length) + list.length) % list.length;
    const outfit = list[this.outfitIndex];
    this.hud.setOutfitLabel(outfit.name);
    const images = await loadOutfitImages(outfit);
    if (list[this.outfitIndex] !== outfit) return; // 그새 다른 옷을 고름
    const scale = this.textureScale();
    this.playerView.setFrames(buildOutfitFrames(this.textures, outfit, images, scale), scale);
    this.playerView.update(0, this.pos.x, this.pos.y, this.facing, false);
  }

  changeOutfit(step) {
    this.setOutfit(this.outfitIndex + step);
  }

  save() {
    writeSave({
      map: this.d.mapId,
      x: Math.round(this.pos.x),
      y: Math.round(this.pos.y),
      facing: this.facing,
      outfit: this.d.outfits.outfits[this.outfitIndex].id,
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
    if (on) this.overlay.draw(this.map.grid, this.map.occluders);
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
      if (changed) this.overlay.draw(this.map.grid, this.map.occluders);
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
    this.overlay.draw(this.map.grid, this.map.occluders);
  }

  // ---------- 매 프레임 ----------
  update(time, delta) {
    const dt = Math.min(delta, 50); // 앱 전환 직후 큰 delta로 순간이동하지 않게
    const p = this.cfg.player;
    const v = this.d.input.getVector();
    this.dir = dirFromVector(v.x, v.y, this.cfg.joystick.deadZone, this.dir);

    this.moving = false;
    if (this.dir) {
      this.facing = this.dir;
      const res = moveStep(this.map.grid, this.pos, this.dir, (p.speed * dt) / 1000, p.footBox, p.cornerSlide);
      this.pos.x = res.x;
      this.pos.y = res.y;
      this.moving = res.moved;
    }

    this.playerView.update(dt, this.pos.x, this.pos.y, this.facing, this.moving);
    // 지붕·나무 조각은 캐릭터 발이 그 조각의 가로 범위(hideX) 안에 있을 때만 앞뒤를 따짐.
    // 범위 밖(건물 옆)에서는 항상 캐릭터가 위에 그려져, 처마 끝에 몸이 잘리지 않음.
    for (const occ of this.occluders) {
      const inRange = this.pos.x >= occ.hideX[0] && this.pos.x <= occ.hideX[1];
      occ.image.setDepth(inRange ? occ.baseY : -0.5);
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
