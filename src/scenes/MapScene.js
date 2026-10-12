// 맵 화면(마을·던전 공통): 통그림 맵 + 보이지 않는 격자 + 주인공 + 몬스터 + 카메라 따라가기.
// 맵 사이 이동은 맵 JSON의 portals: 발이 사각형에 들어가면 화면이 어두워졌다가 다음 맵에서 밝아짐.
import { Grid } from '../core/grid.js';
import { parseMap, serializeMap } from '../core/mapData.js';
import { dirFromVector, moveStep, nearestStandable } from '../core/movement.js';
import { MonsterSpawner } from '../core/monsters.js';
import { findTarget, hitMonster, hitPlayer, aimAssist } from '../core/combat.js';
import { loadOutfitImages, buildOutfitFrames, loadImage, downscale, loadHeadImages, wearHead, removeOutfitFrames } from './characterFrames.js';
import { createEquipment, equipFromBag, unequip, canUnequip, useFromBag, addItem } from '../core/equipment.js';
import { createProgress, addExp, expToNext, maxHpFor } from '../core/progress.js';
import { rollDrops, GroundDrops } from '../core/loot.js';
import { Cooldowns } from '../core/skills.js';
import { formatCoins } from '../core/money.js';
import { EquipmentPanel } from '../ui/equipmentPanel.js';
import { StatusPanel } from '../ui/statusPanel.js';
import { SkillButtons } from '../ui/skillButtons.js';
import { NpcPanel } from '../ui/npcPanel.js';
import { Toast } from '../ui/toast.js';
import { NpcView, loadNpcTextures } from './NpcView.js';
import { NpcMenu } from './npcMenu.js';
import { DropView } from './dropView.js';
import { josa } from '../ui/josa.js';
import { floatText, levelUpFx, edgeGlow, breathFx, SpinTrail } from './progressFx.js';
import { SwingTrail, inkSplash } from './weaponFx.js';
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
    this.assistSlide = null; // 맞히기 도움으로 다가가는 중 { dir, left, speed }
    this.hpFill = null; // 레벨업 체력바 차오름
    this.dead = false;
    // 레벨·경험치, 배운 무예, 의뢰: 저장된 것(맵을 옮겨도 이어짐)
    const eco = this.d.economy;
    if (!this.d.progress) this.d.progress = createProgress(save && save.progress);
    if (!this.d.learned) this.d.learned = Array.isArray(save && save.skills) ? save.skills.filter((id) => this.d.skills.skills.some((s) => s.id === id)) : [];
    if (!this.d.quests) this.d.quests = save && save.quests && typeof save.quests === 'object' ? { ...save.quests } : {};
    if (!this.d.cooldowns) this.d.cooldowns = new Cooldowns();
    this.progress = this.d.progress;
    this.learned = this.d.learned;
    this.quests = this.d.quests;
    this.cooldowns = this.d.cooldowns;
    this.skills = this.d.skills.skills;
    this.questDefs = Object.fromEntries(this.d.questsData.quests.map((q) => [q.id, q]));
    // 주인공 체력: 맵을 옮겨도 이어짐. 처음이거나 쓰러졌다 다시 시작하면 가득. 최대 체력은 레벨에 따라
    const maxHp = maxHpFor(this.progress.level, cfg.player.maxHp, eco.levels);
    if (!this.d.player || this.d.player.hp <= 0) this.d.player = { hp: maxHp, maxHp };
    this.player = this.d.player;
    this.player.maxHp = maxHp;
    this.player.hp = Math.min(this.player.hp, maxHp);
    this.attackCooldown = 0; // 다음 공격까지 남은 시간
    // 이동 지점 위에서 시작하면 한 번 밖으로 나가야 다시 작동 (도착하자마자 되돌아가지 않게)
    this.portalArmed = !this.portalAt(this.pos.x, this.pos.y);

    this.playerView = new PlayerView(this, cfg.player, this.d.outfits.canvas, cfg.shadow, cfg.hpBar);
    this.playerView.setHp(this.player.hp / this.player.maxHp);
    // 장비·가방: 저장된 것, 없으면 data/items.json의 start (맵을 옮겨도 이어짐)
    this.itemDefs = Object.fromEntries(this.d.items.items.map((it) => [it.id, it]));
    if (!this.d.equip) this.d.equip = createEquipment(this.itemDefs, this.d.items.start, save && save.equipment);
    this.equip = this.d.equip;

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
        onBag: () => this.d.scene.setBagOpen(!this.d.equipPanel.open),
        onSound: () => {
          this.d.sfx.setMuted(!this.d.sfx.muted);
          this.d.hud.setSoundOn(!this.d.sfx.muted);
        },
        onGrid: () => this.d.scene.setGridMode(!this.d.scene.gridOn),
      });
      this.d.editor = new EditorPanel({
        onExport: () => this.d.scene.exportGrid(),
        onReset: () => this.d.scene.resetGrid(),
        onClose: () => this.d.scene.setGridMode(false),
      });
      this.d.attackButton = new AttackButton(document.getElementById('btn-attack'));
      this.d.equipPanel = new EquipmentPanel({
        slots: this.d.items.slots,
        itemDefs: this.itemDefs,
        canUnequip,
        onEquip: (i) => this.d.scene.equipItem(i),
        onUnequip: (slot) => this.d.scene.unequipSlot(slot),
        onClose: () => this.d.scene.setBagOpen(false),
      });
      this.d.status = new StatusPanel(document.getElementById('status'));
      this.d.toast = new Toast(document.getElementById('toast'));
      this.d.npcPanel = new NpcPanel(document.getElementById('npc-panel'));
      this.d.skillButtons = new SkillButtons(document.getElementById('skill-buttons'), this.d.skills.skills, (id) => this.d.scene.useSkill(id));
      // 조이스틱 자리(왼쪽)에 선 사람을 눌러도 창이 뜨게
      this.d.joystick.tapHandler = (cx, cy) => this.d.scene.tapNpcAtClient(cx, cy);
      this.d.hud.setSoundOn(!this.d.sfx.muted);
      // 자동 저장: 앱이 가려질 때
      const saveNow = () => this.d.scene.save();
      document.addEventListener('visibilitychange', () => document.hidden && saveNow());
      window.addEventListener('pagehide', saveNow);
    }
    this.hud = this.d.hud;
    this.editor = this.d.editor;
    this.attackButton = this.d.attackButton;
    this.equipPanel = this.d.equipPanel;
    this.statusPanel = this.d.status;
    this.toast = this.d.toast;
    this.npcPanel = this.d.npcPanel;
    this.skillButtons = this.d.skillButtons;
    this.npcMenu = new NpcMenu(this);
    if (this.npcPanel.open) this.setNpcOpen(false); // 맵을 옮기면 창은 닫음
    // 효과음 (Phaser 장면에 이미 'sound'가 있어 sfx 이름으로 둠)
    this.sfx = this.d.sfx;
    this.overlay = new GridOverlay(this);
    this.setGridMode(false);
    this.setupPainting();
    this.input.keyboard.on('keydown', (e) => {
      if (e.code === 'KeyG') this.setGridMode(!this.gridOn);
      if (e.code === 'KeyI' || e.code === 'KeyB') this.setBagOpen(!this.equipPanel.open);
    });

    // 몬스터
    this.monsterDefs = Object.fromEntries(this.d.monsters.monsters.map((m) => [m.id, m]));
    this.spawner = new MonsterSpawner(this.map, this.monsterDefs);
    this.monsterViews = new Map();
    const monsterReady = this.prepareMonsterTextures().then(() => {
      for (const m of this.spawner.monsters) this.addMonsterView(m);
    });

    // 바닥에 떨어진 전리품·엽전 (맵을 옮기면 사라짐)
    this.ground = new GroundDrops(this.d.economy.groundDrops);
    this.dropViews = new Map();
    this.prepareIconTextures();
    // 마을 사람(NPC): 이 맵에 선 사람만
    this.npcViews = [];
    this.prepareNpcs();
    this.input.on('pointerdown', (pointer) => {
      if (this.gridOn) return;
      const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.tapNpcAt(p.x, p.y);
    });
    this.spin = null; // 휘돌려 베기 중
    this.refreshSkills();
    this.refreshStatus();

    // 자동 저장: 주기적으로
    this.time.addEvent({ delay: cfg.autoSaveMs, loop: true, callback: () => this.save() });

    this.fpsTimer = 0;
    cam.fadeIn(this.cfg.mapFadeMs);
    if (this.equipPanel.open) this.setBagOpen(true); // 열린 채로 맵을 옮겼으면 그대로
    Promise.all([this.refreshLook(), monsterReady]).then(() => {
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

  // 외곽선(게임 화면 기준 widthPx)을 텍스처 픽셀로: 텍스처 배율 × 그림 기준 키 ÷ 화면 키
  outlineFor(texScale, displayHeight, standHeight) {
    const o = this.cfg.outline;
    if (!o || !(o.widthPx > 0)) return null;
    return { width: (o.widthPx * texScale * standHeight) / displayHeight, color: o.color, alpha: o.alpha };
  }

  textureScale() {
    const px = this.cfg.player.height * this.pixelScale();
    return Math.min(1, (px * 1.25) / this.d.outfits.canvas.standHeight);
  }

  // 낀 장비대로 겉모습을 다시 만듦: 옷 그림 + 머리 장비(상투를 지우고 얹어 몸 그림에 합침) + 무기
  async refreshLook() {
    const token = (this.lookToken = (this.lookToken || 0) + 1);
    const eq = this.equip.equipped;
    const outfit = this.d.outfits.outfits.find((o) => o.id === eq.outfit) || this.d.outfits.outfits[0];
    const headDef = this.itemDefs[eq.head];
    let images = await loadOutfitImages(outfit);
    if (headDef && headDef.head) {
      const head = await loadHeadImages(headDef, outfit, images);
      images = wearHead(images, head, this.d.headAnchors, outfit.id);
    }
    if (token !== this.lookToken || !this.sys.isActive()) return; // 그새 다른 장비를 끼거나 맵을 옮김
    const scale = this.textureScale();
    const old = this.frames;
    const outline = this.outlineFor(scale, this.cfg.player.height, this.d.outfits.canvas.standHeight);
    this.frames = buildOutfitFrames(this.textures, outfit, images, scale, outline, `${outfit.id}@${token}`);
    this.playerView.setFrames(this.frames, scale);
    // 새 그림으로 바로 바꾼 뒤 옛 그림을 지움 (그리는 중인 그림을 지우지 않게)
    this.applyWeapon();
    this.playerView.update(0, this.pos.x, this.pos.y, this.facing, false);
    removeOutfitFrames(this.textures, old);
    await this.setWeapon(eq.weapon);
    if (token !== this.lookToken || !this.sys.isActive()) return;
    this.playerView.update(0, this.pos.x, this.pos.y, this.facing, false);
  }

  // ---------- 장비창·가방 ----------
  setBagOpen(on) {
    if (on && this.gridOn) this.setGridMode(false);
    if (on && this.npcPanel.open) this.setNpcOpen(false);
    this.equipPanel.setVisible(on);
    this.hud.setBagOn(on);
    if (on) this.renderBag();
    // 장비창이 열려 있는 동안은 움직이거나 공격하지 않음
    this.setControlsVisible(!on);
  }

  renderBag(message = '') {
    this.equipPanel.render(this.equip, message, this.coinsText(this.equip.coins));
  }

  // 조이스틱·공격·무예 버튼 보이기(창이 열려 있으면 숨김)
  setControlsVisible(v) {
    this.d.joystick.setEnabled(v);
    this.attackButton.setVisible(v);
    this.skillButtons.setVisible(v);
  }

  equipItem(bagIndex) {
    if (this.swing || this.spin) return; // 휘두르는 중에는 바꾸지 않음
    const e = this.equip.bag[bagIndex];
    const def = e && this.itemDefs[e.id];
    if (!def) return;
    if (def.use) return this.eatItem(bagIndex, def);
    if (!def.slot) {
      this.renderBag(`${def.name}: 가게에 팔거나 무예 재료로 씁니다 (×${e.n})`);
      return;
    }
    const slot = equipFromBag(this.equip, this.itemDefs, bagIndex);
    if (slot) this.afterEquipChange(slot);
  }

  // 먹을 것(주먹밥·탕약): 체력 회복
  eatItem(bagIndex, def) {
    if (this.player.hp >= this.player.maxHp) {
      this.renderBag('체력이 가득합니다');
      return;
    }
    const use = useFromBag(this.equip, this.itemDefs, bagIndex);
    const before = this.player.hp;
    this.healPlayer(use.healFull ? this.player.maxHp : use.heal);
    this.sfx.play('heal');
    this.renderBag(`${josa(def.name, '을', '를')} 먹었습니다 (체력 +${this.player.hp - before})`);
    this.save();
  }

  healPlayer(amount) {
    const before = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
    this.playerView.setHp(this.player.hp / this.player.maxHp);
    const got = this.player.hp - before;
    if (got > 0) floatText(this, this.pos.x, this.pos.y - this.cfg.player.height - 6, `+${got}`, { color: '#9dff9d', stroke: '#123512' }, this.d.getPixelRatio());
    this.refreshStatus();
  }

  // ---------- 엽전·레벨·무예 표시 ----------
  coinsText(v) {
    return formatCoins(v, this.d.economy.money);
  }

  // 레벨업 직후에는 체력바가 예전 체력에서 가득으로 차오름(hpFill)
  shownHp() {
    const f = this.hpFill;
    if (!f) return this.player.hp;
    const k = Math.min(1, f.t / f.ms);
    const e = 1 - (1 - k) * (1 - k);
    return Math.round(f.from + (this.player.hp - f.from) * e);
  }

  refreshStatus() {
    this.statusPanel.set({
      level: this.progress.level,
      hp: this.shownHp(),
      maxHp: this.player.maxHp,
      exp: this.progress.exp,
      need: expToNext(this.progress, this.d.economy.levels),
      coinsText: this.coinsText(this.equip.coins),
    });
  }

  refreshSkills() {
    this.skillButtons.update(this.learned, (id) => this.cooldowns.remaining(id));
  }

  // ---------- 사람(NPC) ----------
  async prepareNpcs() {
    const list = this.d.npcs.npcs.filter((n) => n.map === this.d.mapId);
    if (!list.length) return;
    const scale = this.textureScale();
    const outline = this.outlineFor(scale, this.cfg.player.height, this.d.outfits.canvas.standHeight);
    for (const npc of list) {
      const outfit = this.d.outfits.outfits.find((o) => o.id === npc.outfit) || this.d.outfits.outfits[0];
      const keys = await loadNpcTextures(this, outfit, scale, outline);
      if (!this.sys.isActive()) return;
      this.npcViews.push(new NpcView(this, npc, keys, {
        canvasSpec: this.d.outfits.canvas,
        height: this.cfg.player.height,
        texScale: scale,
        shadowCfg: this.cfg.shadow,
        pixelRatio: this.d.getPixelRatio(),
      }));
    }
  }

  // 맵 좌표로 사람을 눌렀는지 보고, 눌렀으면 창을 엶
  tapNpcAt(wx, wy) {
    if (this.gridOn || this.transitioning || this.dead) return false;
    const v = this.npcViews.find((n) => n.hit(wx, wy, this.d.npcs.tapRadius));
    if (!v) return false;
    this.openNpc(v.npc);
    return true;
  }

  // 화면(DOM) 좌표 → 맵 좌표 (조이스틱 자리에서 누른 경우)
  tapNpcAtClient(cx, cy) {
    const canvas = this.game.canvas;
    const r = canvas.getBoundingClientRect();
    const gx = ((cx - r.left) * canvas.width) / r.width;
    const gy = ((cy - r.top) * canvas.height) / r.height;
    const p = this.cameras.main.getWorldPoint(gx, gy);
    return this.tapNpcAt(p.x, p.y);
  }

  openNpc(npc) {
    if (this.equipPanel.open) this.setBagOpen(false);
    this.npcPanel.setVisible(true);
    this.setControlsVisible(false);
    this.npcMenu.open(npc);
  }

  setNpcOpen(on) {
    this.npcPanel.setVisible(on);
    this.setControlsVisible(!on && !this.gridOn);
  }

  unequipSlot(slot) {
    if (this.swing || this.spin) return;
    const id = this.equip.equipped[slot];
    if (id && !canUnequip(slot)) {
      this.renderBag('옷은 벗을 수 없습니다. 가방의 다른 옷을 누르면 갈아입습니다');
      return;
    }
    if (unequip(this.equip, slot)) this.afterEquipChange(slot);
  }

  afterEquipChange(slot) {
    this.renderBag();
    if (slot === 'weapon') this.setWeapon(this.equip.equipped.weapon);
    else if (slot === 'outfit' || slot === 'head') this.refreshLook();
    // 토시·신발은 화면에 안 보임(능력치만, 아직 0)
    this.save();
  }

  save() {
    if (!this.pos) return;
    writeSave({
      map: this.d.mapId,
      x: Math.round(this.pos.x),
      y: Math.round(this.pos.y),
      facing: this.facing,
      equipment: { equipped: { ...this.equip.equipped }, bag: this.equip.bag.map((e) => ({ ...e })), coins: this.equip.coins },
      progress: { ...this.progress },
      skills: [...this.learned],
      quests: { ...this.quests },
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
      if (def) this.monsterTextures[t] = await loadMonsterTextures(this, def, this.d.monsters.canvas, this.pixelScale(), (sc) => this.outlineFor(sc, def.height, this.d.monsters.canvas.standHeight));
    }
  }

  addMonsterView(m) {
    const tex = this.monsterTextures && this.monsterTextures[m.type];
    if (!tex || !this.sys.isActive()) return;
    const view = new MonsterView(this, this.monsterDefs[m.type], this.d.monsters.canvas, tex, this.cfg.shadow, this.cfg.hpBar);
    view.update(0, m);
    this.monsterViews.set(m.id, view);
  }

  // ---------- 무기 (장비창의 무기 칸, 빈 칸이면 맨손) ----------
  async setWeapon(id) {
    const list = this.d.weapons.weapons;
    const def = list.find((w) => w.id === id) || null;
    this.weaponDef = def;
    if (def) {
      const key = `weapon:${def.id}`;
      const scale = this.textureScale();
      if (!this.textures.exists(key)) {
        const img = await loadImage(def.image);
        if (!img || !this.sys.isActive()) return;
        if (!this.textures.exists(key)) {
          this.textures.addCanvas(key, downscale(img, scale, this.outlineFor(scale, this.cfg.player.height, this.d.outfits.canvas.standHeight)));
        }
      }
      this.weaponTexScale = scale;
    }
    this.applyWeapon();
  }

  // 지금 옷에 무기 붙이는 값과 휘두르기 자세가 있으면 무기를 손에, 없으면 주먹으로
  applyWeapon() {
    const def = this.weaponDef;
    const attach = def && this.d.weapons.attach[this.equip.equipped.outfit];
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

  // 무기 휘두르기 시작 (칼이 앞을 지나는 순간 맞힘 판정)
  // mods: 힘껏 베기 등 무예 배율 { damageMul, knockbackMul, hitStopMul, trailWidthMul, shakeMul } (없으면 보통 휘두르기)
  startSwing(mods = null) {
    const w = this.weaponDef;
    this.sfx.play('swing');
    this.swing = { weapon: w, t: 0, hitDone: false, trail: null, mods };
    this.attackCooldown = w.cooldownMs;
    const res = moveStep(this.map.grid, this.pos, this.facing, w.stepPx, this.cfg.player.footBox, 0);
    this.pos.x = res.x;
    this.pos.y = res.y;
  }

  // 몸 전체 움직임(640 기준): 직전 preMs 동안 뒤로 backPx → 진행 stepFrom~stepTo 동안 앞으로 step → 끝나면 제자리
  swingLean(t, w) {
    const sw = this.d.weapons.swing;
    const L = sw.lean;
    if (!L) return 0;
    const side = this.facing === 'left' || this.facing === 'right';
    const step = side ? L.stepSide : L.stepFrontBack;
    const smooth = (v) => v * v * (3 - 2 * v);
    if (t < L.preMs) return -L.backPx * smooth(t / L.preMs);
    const p = (t - L.preMs) / w.swingMs;
    if (p < L.stepFrom) return -L.backPx * (1 - smooth(p / L.stepFrom));
    if (p < L.stepTo) return step * smooth((p - L.stepFrom) / (L.stepTo - L.stepFrom));
    if (p <= 1) return step;
    return step * (1 - smooth(Math.min(1, (t - L.preMs - w.swingMs) / sw.recoverMs)));
  }

  // 휘두르는 중 한 프레임. 직전 lean.preMs 동안은 몸만 뒤로 빼고(칼은 치켜든 채),
  // 그 뒤 칼 방향 theta를 thetaFrom → thetaTo로 돌림(처음엔 느리고 끝으로 빠르게).
  // 몸 그림은 PlayerView가 theta로 고름(raise → swing → strike).
  // 반환: 그릴 자세 { theta, lean } 또는 null(끝남)
  updateSwing(dt) {
    const s = this.swing;
    const w = s.weapon;
    const sw = this.d.weapons.swing;
    const pre = (sw.lean && sw.lean.preMs) || 0;
    s.t += dt;
    if (s.t >= pre + w.swingMs + sw.recoverMs) {
      if (s.trail) s.trail.fadeOut();
      this.swing = null;
      return null;
    }
    const lean = this.swingLean(s.t, w);
    if (s.t < pre) return { theta: sw.thetaFrom, lean };
    const theta = swingTheta(sw, (s.t - pre) / w.swingMs);
    // 칼이 앞을 지나는 순간(hitTheta) 맞힘 판정
    if (!s.hitDone && theta >= sw.hitTheta) {
      s.hitDone = true;
      this.strikeHit(w, s.mods);
    }
    // 궤적: 방향마다 정해 둔 모양을 휘두르는 진행만큼 그림 (data/weapons.json trail)
    if (!s.trail) s.trail = this.makeTrail(w, s.mods);
    s.trail.draw((theta - sw.thetaFrom) / (sw.thetaTo - sw.thetaFrom));
    if (s.t >= pre + w.swingMs) s.trail.fadeOut();
    return { theta, lean };
  }

  makeTrail(w, mods = null) {
    const tr = this.d.weapons.trail;
    const facing = this.facing;
    const base = tr[facing === 'up' ? 'back' : facing === 'down' ? 'front' : 'side'];
    // 힘껏 베기: 궤적을 굵게
    const shape = mods && mods.trailWidthMul ? { ...base, thickness: base.thickness * mods.trailWidthMul } : base;
    const x = this.pos.x;
    const y = this.pos.y;
    const pv = this.playerView;
    return new SwingTrail(this, {
      shape,
      cfg: tr,
      k: w.tipFromGrip / tr.refTip,
      color: w.trailColor,
      toMap: (px, py) => pv.posePoint(px, py, x, y, facing === 'right'),
      res: this.pixelScale(),
      // 칼(몸 앞 +0.01)·손 덮개(+0.02) 아래, 몸 위. 뒷면은 몸 뒤
      depth: y + (shape.behind ? -0.03 : 0.005),
      fx: this.cfg.swingFx,
    });
  }

  // 내려치는 순간: 앞의 몬스터 1마리 맞힘 + 히트스톱·먹 튐·화면 흔들림
  strikeHit(w, mods = null) {
    const fx = this.cfg.hitFx;
    const sfx = this.cfg.swingFx;
    const m = mods || {};
    const target = findTarget(this.pos, this.facing, this.spawner.monsters, w.reach, w.width);
    if (!target) return;
    const result = hitMonster(target, this.facing, w.damage * (m.damageMul || 1), w.knockbackPx * (m.knockbackMul || 1), w.stunMs);
    const def = this.monsterDefs[target.type];
    showDamage(this, target.x, target.y - def.height - 2, result.damage, fx, this.d.getPixelRatio());
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing];
    inkSplash(this, target.x, target.y - def.height * 0.45, sfx.splashColor || '#1b1712', sfx, d[0], d[1]);
    this.hitStopMs = sfx.hitStopMs * (m.hitStopMul || 1);
    this.cameras.main.shake(sfx.shakeMs, sfx.shakeIntensity * (m.shakeMul || 1));
    this.sfx.play('woodHit');
    this.afterHit(target, result);
  }

  // 맞힌 뒤: 소리, 번쩍 또는 쓰러짐(경험치·전리품)
  afterHit(target, result) {
    const fx = this.cfg.hitFx;
    const view = this.monsterViews.get(target.id);
    this.playMonsterSound(target, result.killed);
    if (result.killed) {
      // 규칙에서 바로 빼서 다시 생기는 시간이 흐르기 시작하고, 그림은 쓰러지는 연출 뒤 사라짐
      this.spawner.remove(target);
      this.monsterViews.delete(target.id);
      if (view) view.die(fx.deathMs, fx.flashMs);
      this.onMonsterKilled(target);
    } else if (view) {
      view.flash(fx.flashMs);
    }
  }

  // ---------- 주먹 지르기 ----------
  // 바라보는 쪽으로 조금 내딛고, 바로 앞 몬스터 1마리를 맞힘 (mods: 힘껏 베기 배율)
  punch(mods = null) {
    const a = this.cfg.attack;
    const fx = this.cfg.hitFx;
    const m = mods || {};
    this.punchMs = a.punchMs;
    this.attackCooldown = a.cooldownMs;
    const p = this.cfg.player;
    const res = moveStep(this.map.grid, this.pos, this.facing, a.stepPx, p.footBox, 0);
    this.pos.x = res.x;
    this.pos.y = res.y;

    const target = findTarget(this.pos, this.facing, this.spawner.monsters, a.reach, a.width);
    if (!target) return;
    const result = hitMonster(target, this.facing, a.damage * (m.damageMul || 1), a.knockbackPx * (m.knockbackMul || 1), a.stunMs);
    const def = this.monsterDefs[target.type];
    this.sfx.play('punchHit');
    showDamage(this, target.x, target.y - def.height - 2, result.damage, fx, this.d.getPixelRatio());
    if (mods) {
      this.hitStopMs = this.cfg.swingFx.hitStopMs * (m.hitStopMul || 1);
      this.cameras.main.shake(this.cfg.swingFx.shakeMs, this.cfg.swingFx.shakeIntensity * (m.shakeMul || 1));
    }
    this.afterHit(target, result);
  }

  // ---------- 맞히기 도움 ----------
  // 둘레 assistRadius 안 몬스터 쪽으로 몸을 돌리고, 닿지 않으면 assistStepPx까지 다가가 침.
  // 무기는 휘두르는 동안(맞힘 판정 전에) 미끄러지듯 다가가고, 주먹은 바로 맞으므로 한 번에 다가감.
  attackWithAssist(mods) {
    const a = this.cfg.attack;
    const w = this.canSwing ? this.weaponDef : null;
    const res = aimAssist(this.pos, this.facing, this.spawner.monsters, {
      radius: a.assistRadius || 0,
      reach: w ? w.reach : a.reach,
      width: w ? w.width : a.width,
      maxStep: a.assistStepPx || 0,
    });
    this.facing = res.facing;
    this.dir = null;
    if (res.step > 0) {
      if (w) {
        this.assistSlide = { dir: res.facing, left: res.step, speed: res.step / Math.max(1, a.assistSlideMs || 1) };
      } else {
        const m = moveStep(this.map.grid, this.pos, res.facing, res.step, this.cfg.player.footBox, 0);
        this.pos.x = m.x;
        this.pos.y = m.y;
      }
    }
    if (w) this.startSwing(mods);
    else this.punch(mods);
  }

  // ---------- 쓰러뜨림: 경험치·전리품 ----------
  onMonsterKilled(target) {
    const def = this.monsterDefs[target.type];
    if (def.exp) this.gainExp(def.exp);
    const entries = rollDrops(def);
    for (const d of this.ground.spawn(target.x, target.y, entries, this.map.grid)) {
      this.dropViews.set(d.id, new DropView(this, d, d.item ? this.itemDefs[d.item] : null, this.d.economy.groundDrops, this.d.getPixelRatio()));
    }
  }

  gainExp(amount) {
    const eco = this.d.economy;
    const before = this.progress.level;
    const gained = addExp(this.progress, amount, eco.levels);
    if (gained > 0) {
      // 레벨업: 최대 체력 +hpPerLevel, 체력 가득(체력바가 차오름), 연출(docs/spec/economy.md '레벨업 연출')
      const fx = eco.levelUpFx;
      const fromHp = this.player.hp;
      this.player.maxHp = maxHpFor(this.progress.level, this.cfg.player.maxHp, eco.levels);
      this.player.hp = this.player.maxHp;
      this.hpFill = { from: fromHp, t: 0, ms: fx.hpFillMs };
      levelUpFx(this, this.pos.x, this.pos.y, this.cfg.player.height, this.progress.level, fx, this.d.getPixelRatio());
      this.sfx.play('levelUp');
      // 아주 짧은 멈춤 + 화면 가장자리 은은한 금빛
      this.hitStopMs = Math.max(this.hitStopMs, fx.pauseMs);
      edgeGlow(fx.edgeColor, fx.edgeMs);
      // 이번에 새로 배울 수 있게 된 무예가 있으면 한 줄 알림
      const now = this.progress.level;
      const opened = this.skills.some((s) => {
        const lv = (s.requires && s.requires.level) || 1;
        return lv > before && lv <= now && !this.learned.includes(s.id);
      });
      if (opened) this.toast.show(fx.newSkillText, 3500);
      this.save();
    }
    this.refreshStatus();
  }

  // 바닥 물건: 시간 흐름, 가까이 가면 저절로 주움
  updateDrops(dt) {
    const alive = !this.dead && !this.transitioning;
    const { picked, expired } = this.ground.update(dt, alive ? this.pos : null);
    const pr = this.d.getPixelRatio();
    const headY = this.pos.y - this.cfg.player.height - 4;
    picked.forEach((d, i) => {
      const view = this.dropViews.get(d.id);
      this.dropViews.delete(d.id);
      if (view) view.pickup(this.pos.x, this.pos.y - this.cfg.player.height * 0.4);
      const y = headY - i * 10;
      if (d.coins) {
        this.equip.coins += d.coins;
        this.sfx.play('coin');
        floatText(this, this.pos.x, y, `+${this.coinsText(d.coins)}`, { color: '#ffd98a', stroke: '#3a2408', fontPx: 10 }, pr);
      } else {
        addItem(this.equip, this.itemDefs, d.item, d.n);
        this.sfx.play('pickup');
        const name = this.itemDefs[d.item].name;
        floatText(this, this.pos.x, y, d.n > 1 ? `+${name} ×${d.n}` : `+${name}`, { color: '#f3ead6', stroke: '#2a1c10', fontPx: 10 }, pr);
      }
    });
    if (picked.length) {
      this.refreshStatus();
      if (this.equipPanel.open) this.renderBag();
    }
    for (const d of expired) {
      const view = this.dropViews.get(d.id);
      this.dropViews.delete(d.id);
      if (view) view.destroy();
    }
    for (const v of this.dropViews.values()) v.update();
  }

  // 바닥 물건 아이콘(그림이 있는 것만, 없으면 글자 칸)
  async prepareIconTextures() {
    if (this.d.iconsLoaded) return;
    this.d.iconsLoaded = true;
    const size = this.d.economy.groundDrops.size * this.pixelScale() * 2;
    await Promise.all(this.d.items.items.filter((it) => it.stack).map(async (it) => {
      const img = await loadImage(it.icon);
      const key = `icon:${it.id}`;
      if (img && !this.textures.exists(key)) this.textures.addCanvas(key, downscale(img, Math.min(1, size / img.width)));
    }));
  }

  // ---------- 무예 ----------
  useSkill(id) {
    const sk = this.skills.find((s) => s.id === id);
    if (!sk) return;
    if (!this.learned.includes(id)) {
      this.toast.show(`${josa(sk.name, '은', '는')} 우물가 늙은 군관에게 배웁니다 (레벨 ${(sk.requires && sk.requires.level) || 1})`);
      return;
    }
    if (this.dead || this.transitioning || this.gridOn || this.equipPanel.open || this.npcPanel.open) return;
    if (!this.cooldowns.ready(id)) return;
    if (this.swing || this.spin || this.punchMs > 0) return;
    if (sk.kind === 'powerSlash') {
      this.attackWithAssist(sk);
    } else if (sk.kind === 'heal') {
      if (this.player.hp >= this.player.maxHp) {
        this.toast.show('체력이 가득합니다');
        return;
      }
      breathFx(this, this.pos.x, this.pos.y, this.cfg.player.height, sk.glowColor, sk.glowMs);
      this.healPlayer(Math.max(1, Math.ceil(this.player.maxHp * sk.healRatio)));
      this.sfx.play('heal');
    } else if (sk.kind === 'spin') {
      this.startSpin(sk);
    } else {
      return;
    }
    this.cooldowns.start(id, sk.cooldownMs);
    this.refreshSkills();
  }

  // 휘돌려 베기: 아래 → 왼쪽 → 위 → 오른쪽으로 몸을 돌리며 원형 궤적, 중간에 둘레 몬스터를 모두 때림
  startSpin(sk) {
    const order = ['down', 'left', 'up', 'right'];
    const w = this.canSwing ? this.weaponDef : null;
    const color = sk.trailColor || (w && w.trailColor) || '#f3ead6';
    this.sfx.play('swing');
    this.spin = {
      sk,
      t: 0,
      hitDone: false,
      startFacing: this.facing,
      order: [...order.slice(order.indexOf(this.facing)), ...order.slice(0, order.indexOf(this.facing))],
      trail: new SpinTrail(this, this.pos.x, this.pos.y - this.cfg.player.height * 0.3, sk.radius, color, sk.trailWidth),
    };
    this.attackCooldown = Math.max(this.attackCooldown, sk.spinMs);
  }

  updateSpin(dt) {
    const s = this.spin;
    const sk = s.sk;
    s.t += dt;
    const p = Math.min(1, s.t / sk.spinMs);
    this.facing = s.order[Math.min(3, Math.floor(p * 4))];
    s.trail.draw(p);
    if (!s.hitDone && p >= sk.hitAt) {
      s.hitDone = true;
      this.spinHit(sk);
    }
    if (p >= 1) {
      s.trail.fadeOut();
      this.facing = s.startFacing;
      this.spin = null;
      return null;
    }
    // 무기를 들었으면 칼을 앞으로 뻗은 내려치기 자세, 맨손이면 주먹
    return this.canSwing ? { theta: 105, lean: 0 } : 'punch';
  }

  spinHit(sk) {
    const fx = this.cfg.hitFx;
    const sfx = this.cfg.swingFx;
    const w = this.canSwing ? this.weaponDef : null;
    const base = w ? w.damage : this.cfg.attack.damage;
    const hits = this.spawner.monsters.filter((m) => m.hp > 0 && Math.hypot(m.x - this.pos.x, m.y - this.pos.y) <= sk.radius);
    for (const target of hits) {
      const dx = target.x - this.pos.x;
      const dy = target.y - this.pos.y;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      const result = hitMonster(target, dir, base * (sk.damageMul || 1), sk.knockbackPx, (w ? w.stunMs : this.cfg.attack.stunMs));
      const def = this.monsterDefs[target.type];
      showDamage(this, target.x, target.y - def.height - 2, result.damage, fx, this.d.getPixelRatio());
      const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      inkSplash(this, target.x, target.y - def.height * 0.45, sfx.splashColor || '#1b1712', sfx, v[0], v[1]);
      this.afterHit(target, result);
    }
    if (hits.length) {
      this.hitStopMs = sfx.hitStopMs;
      this.cameras.main.shake(sfx.shakeMs, sfx.shakeIntensity);
      this.sfx.play(w ? 'woodHit' : 'punchHit');
    }
  }

  // 몬스터 맞음·쓰러짐 소리 (data/monsters.json의 sounds: { hit, die })
  playMonsterSound(m, killed) {
    const snd = this.monsterDefs[m.type].sounds || {};
    const name = killed ? snd.die : snd.hit;
    if (name) this.sfx.play(name);
  }

  // ---------- 주인공이 물림 ----------
  onBitten(bite) {
    if (this.dead || this.transitioning) return;
    this.sfx.play('playerHurt');
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
      const maxHp = maxHpFor(this.progress.level, this.cfg.player.maxHp, this.d.economy.levels);
      this.d.player = { hp: maxHp, maxHp };
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
    if (on && this.equipPanel && this.equipPanel.open) this.setBagOpen(false);
    if (on && this.npcPanel && this.npcPanel.open) this.setNpcOpen(false);
    this.gridOn = on;
    this.hud.setGridOn(on);
    this.editor.setVisible(on);
    this.overlay.setVisible(on);
    // 편집 중에는 화면 왼쪽도 칠할 수 있게 조이스틱을 끔 (PC는 방향키로 이동)
    this.d.joystick.setEnabled(!on);
    if (this.d.attackButton) this.d.attackButton.setVisible(!on);
    if (this.d.skillButtons) this.d.skillButtons.setVisible(!on);
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
    // 휘두르는 중에 누른 것도 버리지 않고 끝난 뒤 나감
    this.cooldowns.update(dt);
    const wantAttack = this.attackCooldown <= 0 && !this.swing && !this.spin && this.attackButton.consume();
    if (wantAttack && !this.swing && !this.transitioning && !this.gridOn && !this.dead && !this.equipPanel.open && !this.npcPanel.open) {
      this.attackWithAssist(null);
    }
    const spinPose = this.spin ? this.updateSpin(dt) : null;
    const swingPose = this.swing ? this.updateSwing(dt) : spinPose;
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
    // 맞히기 도움으로 다가가는 중 (벽은 통과 안 함)
    if (this.assistSlide) {
      const s = this.assistSlide;
      const step = Math.min(s.left, s.speed * dt);
      const res = moveStep(this.map.grid, this.pos, s.dir, step, p.footBox, 0);
      this.pos.x = res.x;
      this.pos.y = res.y;
      s.left = res.moved ? s.left - step : 0;
      if (s.left <= 0.01) this.assistSlide = null;
    }
    if (this.dir && !this.dead) {
      this.facing = this.dir;
      const res = moveStep(this.map.grid, this.pos, this.dir, (p.speed * dt) / 1000, p.footBox, p.cornerSlide);
      this.pos.x = res.x;
      this.pos.y = res.y;
      this.moving = res.moved;
    }
    this.checkPortal();
    this.updateDrops(dt);
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

    // 레벨업 체력바 차오름
    if (this.hpFill) {
      this.hpFill.t += dt;
      if (this.hpFill.t >= this.hpFill.ms || this.player.hp < this.hpFill.from) this.hpFill = null;
      this.playerView.setHp(this.shownHp() / this.player.maxHp);
    }
    // 왼쪽 위 표시·무예 버튼(바뀐 것만 다시 그림)
    this.refreshStatus();
    this.refreshSkills();

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
