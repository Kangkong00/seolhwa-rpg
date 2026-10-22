// 맵 화면(마을·던전 공통): 통그림 맵 + 보이지 않는 격자 + 주인공 + 몬스터 + 카메라 따라가기.
// 맵 사이 이동은 맵 JSON의 portals: 발이 사각형에 들어가면 화면이 어두워졌다가 다음 맵에서 밝아짐.
import { Grid } from '../core/grid.js';
import { parseMap, serializeMap } from '../core/mapData.js';
import { dirFromVector, moveStep, nearestStandable } from '../core/movement.js';
import { MonsterSpawner } from '../core/monsters.js';
import { findTarget, hitMonster, hitPlayer, aimAssist, rollCrit } from '../core/combat.js';
import { loadOutfitImages, buildOutfitFrames, loadImage, downscale, loadHeadImages, wearHead, removeOutfitFrames } from './characterFrames.js';
import { createEquipment, equipFromBag, unequip, canUnequip, useFromBag, addItem, countItem, removeItem } from '../core/equipment.js';
import { createProgress, addExp, expToNext, maxHpFor, damageBonus, setLevel } from '../core/progress.js';
import { totalStats, damageTaken, levelOk, passiveSum } from '../core/stats.js';
import { killRewards, GroundDrops } from '../core/loot.js';
import { Cooldowns, normalizeSlots, autoSlot } from '../core/skills.js';
import { SKILL_KINDS, chainMods, pullMonsters } from './skillKinds.js';
import { formatCoins } from '../core/money.js';
import { EquipmentPanel } from '../ui/equipmentPanel.js';
import { ItemInfo } from '../ui/itemInfo.js';
import { openItemInfo, tipText } from './itemInfoView.js';
import { StatusPanel } from '../ui/statusPanel.js';
import { SkillButtons } from '../ui/skillButtons.js';
import { NpcPanel } from '../ui/npcPanel.js';
import { Toast } from '../ui/toast.js';
import { NpcView, loadNpcTexture } from './NpcView.js';
import { NpcMenu } from './npcMenu.js';
import { DropView, makeDropTexture } from './dropView.js';
import { PickupFeed } from './pickupFeed.js';
import { josa } from '../ui/josa.js';
import { crescentWave, WindRing, leafSwirl, CrescentShot } from './skillFx.js';
import { levelUpFx } from './levelUpFx.js';
import { SwingTrail, inkSplash } from './weaponFx.js';
import { swingTheta } from './weaponPose.js';
import { PlayerView } from './PlayerView.js';
import { MonsterView, loadMonsterTextures } from './MonsterView.js';
import { preloadMapObjects, createMapObjects, OcclusionGhost } from './mapObjects.js';
import { PortalFx } from './portalFx.js';
import { showDamage } from './damageText.js';
import { hitStar, slashMark, weaponHitFx, trailParticle, sevenStar } from './impactFx.js';
import { AttackButton } from '../ui/attackButton.js';
import { GridOverlay } from './gridOverlay.js';
import { Hud } from '../ui/hud.js';
import { AdminPanel } from '../ui/adminPanel.js';
import { SkillPanel } from '../ui/skillPanel.js';
import { SkillCommonFx } from './skillCommonFx.js';
import { floatText } from './progressFx.js';
import { shadeImage } from './shade.js';
import { preloadFx } from './fxSprite.js';
import { EditorPanel, downloadText } from '../ui/editorPanel.js';
import { loadSave, writeSave, loadGridEdit, writeGridEdit, clearGridEdit } from '../save/localSave.js';

// 그림을 색으로 물들임(곱하기 — 회색이면 색이 빠지고 어두워짐), 투명한 곳은 그대로
function tintImage(img, color) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  // 먼저 흑백으로
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const g = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.min(255, g * 1.25);
  }
  ctx.putImageData(d, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0);
  return c;
}

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
    // 물건 조각(앞뒤 가림)
    preloadMapObjects(this, this.d.mapId, this.d.mapJson.objectsData);
    // 효과 그림(assets/fx, 없으면 도형 연출로 대신)
    preloadFx(this, this.d.game.fxImages);
  }

  create() {
    const { game: cfg, mapId } = this.d;
    this.cfg = cfg;
    this.map = this.loadMap();
    this.transitioning = false;

    // 맵 그림이 좌표계보다 크면(고해상도 그림) 좌표계 크기로 줄여 그림
    this.add.image(0, 0, this.mapKey).setOrigin(0, 0).setDisplaySize(this.map.width, this.map.height).setDepth(-1);
    // 물건 조각: 마을 그림과 같은 자리에 겹쳐 놓고 깊이 = baseY (발이 baseY보다 북쪽이면 가려짐)
    this.mapObjects = createMapObjects(this, this.d.mapId, this.d.mapJson.objectsData);
    // 던전 입구 표시: 빛나는 테두리 + 가까이 가면 이름표
    this.unlocked = new Set();
    this.portalFx = this.map.portals.map((p) => new PortalFx(this, p, cfg.portalFx, this.d.getPixelRatio()));
    this.portalFx.forEach((fx, i) => fx.setVisible(this.portalOpen(this.map.portals[i])));

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
    this.slowMo = null; // 레벨업 멈칫(게임이 잠깐 느려짐)
    this.recall = null; // 귀환 부적 쓰는 중 { left }
    this.dead = false;
    // 레벨·경험치, 배운 무예, 의뢰: 저장된 것(맵을 옮겨도 이어짐)
    const eco = this.d.economy;
    if (!this.d.progress) this.d.progress = createProgress(save && save.progress);
    if (!this.d.learned) this.d.learned = Array.isArray(save && save.skills) ? save.skills.filter((id) => this.d.skills.skills.some((s) => s.id === id)) : [];
    if (!this.d.quests) this.d.quests = save && save.quests && typeof save.quests === 'object' ? { ...save.quests } : {};
    if (!this.d.cooldowns) this.d.cooldowns = new Cooldowns();
    // 무예 칸 4개(무예창에서 고름, 저장됨). 저장이 없으면 배운 순서대로
    if (!this.d.skillSlots) this.d.skillSlots = normalizeSlots(save && save.skillSlots, this.d.learned.filter((id) => this.isActiveSkill(id)));
    this.progress = this.d.progress;
    this.learned = this.d.learned;
    this.quests = this.d.quests;
    this.cooldowns = this.d.cooldowns;
    this.skillSlots = this.d.skillSlots;
    this.act = null; // 오래 걸리는 무예를 하는 중(skillKinds.js setAct)
    this.skills = this.d.skills.skills;
    this.questDefs = Object.fromEntries(this.d.questsData.quests.map((q) => [q.id, q]));
    // 주인공 체력: 맵을 옮겨도 이어짐. 처음이거나 쓰러졌다 다시 시작하면 가득. 최대 체력은 레벨에 따라
    const maxHp = this.maxHpNow();
    const freshHp = !this.d.player || this.d.player.hp <= 0;
    if (freshHp) this.d.player = { hp: maxHp, maxHp };
    this.player = this.d.player;
    this.player.maxHp = maxHp;
    this.player.hp = Math.min(this.player.hp, maxHp);
    this.attackCooldown = 0; // 다음 공격까지 남은 시간
    // 관리자 '안 죽기'·'한 방'(저장하지 않음 — 다시 열면 꺼짐, docs/spec/admin_mode.md)
    if (!this.d.admin) this.d.admin = { noDie: false, oneHit: false };
    // 이동 지점 위에서 시작하면 한 번 밖으로 나가야 다시 작동 (도착하자마자 되돌아가지 않게)
    this.portalArmed = !this.portalAt(this.pos.x, this.pos.y);

    this.playerView = new PlayerView(this, cfg.player, this.d.outfits.canvas, cfg.shadow, cfg.hpBar);
    // 가려지면 가려진 부분에만 진한 윤곽선 (몸이 실제로 minCovered 넘게 가려졌을 때만)
    this.ghost = new OcclusionGhost(this, this.mapObjects, this.playerView.sprite, cfg.occlusionGhost);
    this.events.once('shutdown', () => this.ghost.destroy());
    this.playerView.setHp(this.player.hp / this.player.maxHp);
    // 장비·가방: 저장된 것, 없으면 data/items.json의 start (맵을 옮겨도 이어짐)
    this.itemDefs = Object.fromEntries(this.d.items.items.map((it) => [it.id, it]));
    this.weaponDefs = Object.fromEntries(this.d.weapons.weapons.map((w) => [w.id, w]));
    if (!this.d.equip) this.d.equip = createEquipment(this.itemDefs, this.d.items.start, save && save.equipment);
    this.equip = this.d.equip;
    // 팔찌(최대 체력 +)까지 넣은 최대 체력(처음 불러올 때는 장비가 여기서 생기므로 다시 맞춤)
    this.player.maxHp = this.maxHpNow();
    this.player.hp = freshHp ? this.player.maxHp : Math.min(this.player.hp, this.player.maxHp);

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
        onRecall: () => this.d.scene.startRecall(),
        onSound: () => {
          this.d.sfx.setMuted(!this.d.sfx.muted);
          this.d.hud.setSoundOn(!this.d.sfx.muted);
        },
        onGrid: () => this.d.scene.setGridMode(!this.d.scene.gridOn),
        onAdmin: () => this.d.adminPanel.toggle(),
        onSkills: () => this.d.skillPanel.toggle(),
        adminEnabled: !!(this.cfg.admin && this.cfg.admin.enabled),
      });
      this.d.adminPanel = new AdminPanel(document.getElementById('admin-panel'), () => this.d.scene);
      this.d.skillPanel = new SkillPanel(document.getElementById('skill-panel'), () => this.d.scene);
      // PC는 K로 무예창
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyK' && !e.repeat) this.d.skillPanel.toggle();
      });
      // PC는 F2로 관리자 창
      if (this.cfg.admin && this.cfg.admin.enabled) {
        window.addEventListener('keydown', (e) => {
          if (e.code !== 'F2') return;
          e.preventDefault();
          this.d.adminPanel.toggle();
        });
      }
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
        decorate: (el, def) => this.d.itemInfo.hover(el, () => tipText(this.d.scene, def)),
      });
      this.d.itemInfo = new ItemInfo(document.getElementById('item-info'), document.getElementById('item-tip'));
      this.d.status = new StatusPanel(document.getElementById('status'));
      this.d.toast = new Toast(document.getElementById('toast'), this.d.economy.textFx.toastHoldMs);
      this.d.npcPanel = new NpcPanel(document.getElementById('npc-panel'));
      this.d.skillButtons = new SkillButtons(document.getElementById('skill-buttons'), this.d.skills.skills, (id) => this.d.scene.useSkill(id), () => this.d.skillPanel.show());
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
    this.itemInfo = this.d.itemInfo;
    this.itemInfo.hide();
    this.statusPanel = this.d.status;
    this.toast = this.d.toast;
    this.npcPanel = this.d.npcPanel;
    this.skillButtons = this.d.skillButtons;
    this.npcMenu = new NpcMenu(this);
    this.adminPanel = this.d.adminPanel;
    this.hud.setAdminWarn(this.d.admin.noDie || this.d.admin.oneHit || this.d.admin.noCooldown);
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
    this.spawner = new MonsterSpawner(this.map, this.monsterDefs, Math.random, this.d.monsters.bodyBox);
    this.monsterViews = new Map();
    const monsterReady = this.prepareMonsterTextures().then(() => {
      for (const m of this.spawner.monsters) this.addMonsterView(m);
    });

    // 바닥에 떨어진 전리품·엽전 (맵을 옮기면 사라짐)
    this.ground = new GroundDrops(this.d.economy.groundDrops);
    this.pickupFeed = new PickupFeed(this, this.d.economy.textFx, this.d.getPixelRatio());
    this.dropViews = new Map();
    // 무예 공통 연출 층(어둡게·이름·3겹 빛·알갱이·빛 번짐, docs/spec/feedback_1020.md 5)
    this.skillFx = new SkillCommonFx(this, this.d.skills.fxCommon);
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
    if (!on) this.itemInfo.hide();
    if (on && this.gridOn) this.setGridMode(false);
    if (on && this.npcPanel.open) this.setNpcOpen(false);
    this.equipPanel.setVisible(on);
    this.hud.setBagOn(on);
    if (on) this.renderBag();
    // 장비창이 열려 있는 동안은 움직이거나 공격하지 않음
    this.setControlsVisible(!on);
  }

  renderBag(message = '') {
    const st = this.stats();
    const pa = st.passiveAttack ? ` (+${st.passiveAttack} 패시브)` : '';
    const ps = st.passiveSpeed ? ` (+${Math.round(st.passiveSpeed * 100)}% 패시브)` : '';
    const totals = `공격력 ${st.attack}${pa} · 방어력 ${st.defense} · 걸음 ${st.speedMul > 1 ? `+${Math.round((st.speedMul - 1) * 100)}%` : '보통'}${ps}`;
    this.equipPanel.render(this.equip, message, this.coinsText(this.equip.coins), totals, this.progress.level);
  }

  // 조이스틱·공격·무예 버튼 보이기(창이 열려 있으면 숨김)
  setControlsVisible(v) {
    this.d.joystick.setEnabled(v);
    this.attackButton.setVisible(v);
    this.skillButtons.setVisible(v);
  }

  // 가방 물건을 누르면 정보창(끼기·쓰기는 정보창 단추로)
  equipItem(bagIndex) {
    const e = this.equip.bag[bagIndex];
    if (e) openItemInfo(this, e.id, { type: 'bag', index: bagIndex });
  }

  // 정보창 '끼기': 레벨이 모자라면 끼지 않음
  equipFromBagIndex(bagIndex) {
    if (this.swing || this.spin) return; // 휘두르는 중에는 바꾸지 않음
    const e = this.equip.bag[bagIndex];
    const def = e && this.itemDefs[e.id];
    if (!def) return;
    if (!levelOk(def, this.progress.level)) {
      this.renderBag(`${def.name}: 레벨 ${def.level}부터 낄 수 있습니다`);
      return;
    }
    const slot = equipFromBag(this.equip, this.itemDefs, bagIndex, this.progress.level);
    if (slot) this.afterEquipChange(slot);
  }

  // 정보창 '쓰기'
  useBagItem(bagIndex) {
    const e = this.equip.bag[bagIndex];
    const def = e && this.itemDefs[e.id];
    if (def && def.use) this.eatItem(bagIndex, def);
  }

  // 먹을 것(주먹밥·탕약): 체력 회복 / 귀환 부적: 1초 동안 빛난 뒤 마을 성황당 앞으로(startRecall)
  eatItem(bagIndex, def) {
    if (def.use.returnTo) {
      this.setBagOpen(false);
      this.startRecall();
      return;
    }
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

  // small: 조금씩 차는 회복(숨 고르기 이어 채우기·질긴 숨) — 숫자를 작게 띄움
  // big: 숨 고르기처럼 크게 띄움
  healPlayer(amount, small = false, big = false) {
    amount = Math.round(amount * this.stats().healMul); // 옥 팔찌: 회복 +
    const before = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
    this.playerView.setHp(this.player.hp / this.player.maxHp);
    const got = this.player.hp - before;
    if (got > 0) showDamage(this, this.pos.x, this.pos.y - this.cfg.player.height - 6, got, this.cfg.hitFx, this.d.getPixelRatio(), small ? 'healSmall' : big ? 'healBig' : 'heal');
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
    this.statusPanel.setBoost(this.cfg.testBoost);
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
    this.skillButtons.update(this.skillSlots, (id) => this.cooldowns.remaining(id), !!this.canSwing);
  }

  // ---------- 사람(NPC) ----------
  async prepareNpcs() {
    const list = this.d.npcs.npcs.filter((n) => n.map === this.d.mapId);
    if (!list.length) return;
    const canvas = this.d.npcs.imageCanvas;
    const outlineFor = (sc) => this.outlineFor(sc, canvas.displayHeight, canvas.refHeight);
    for (const npc of list) {
      const tex = await loadNpcTexture(this, npc, canvas, this.pixelScale(), outlineFor);
      if (!this.sys.isActive()) return;
      this.npcViews.push(new NpcView(this, npc, tex, { canvas, shadowCfg: this.cfg.shadow, pixelRatio: this.d.getPixelRatio() }));
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
    if (!on) this.itemInfo.hide();
    this.npcPanel.setVisible(on);
    this.setControlsVisible(!on && !this.gridOn);
  }

  // 장비 칸을 누르면 정보창(벗기는 정보창 단추로)
  unequipSlot(slot) {
    const id = this.equip.equipped[slot];
    if (id) openItemInfo(this, id, { type: 'slot', slot });
  }

  // 가방에서 버리기: 발 앞 바닥에 떨어짐(다시 주울 수 있음, dropLifetimeMs 뒤 사라짐)
  dropFromBag(id, n) {
    const def = this.itemDefs[id];
    if (!def || !removeItem(this.equip, id, n)) return;
    const g = this.d.economy.groundDrops;
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing] || [0, 1];
    let x = this.pos.x + v[0] * g.dropAheadPx;
    let y = this.pos.y + v[1] * g.dropAheadPx;
    if (this.map.grid.isPointBlocked(x, y)) {
      x = this.pos.x;
      y = this.pos.y;
    }
    const d = this.ground.drop(x, y, { item: id, n }, g.dropLifetimeMs);
    this.dropViews.set(d.id, new DropView(this, d, def, g, this.d.getPixelRatio(), this.cfg.shadow, `drop:${id}`, this.dropTexRes()));
    this.renderBag(`${josa(`${def.name} ${n}개`, '을', '를')} 버렸습니다`);
    this.save();
  }

  takeOff(slot) {
    if (this.swing || this.spin) return;
    const id = this.equip.equipped[slot];
    if (id && !canUnequip(slot)) {
      this.renderBag('옷은 벗을 수 없습니다. 가방의 다른 옷을 누르면 갈아입습니다');
      return;
    }
    if (unequip(this.equip, slot)) this.afterEquipChange(slot);
  }

  afterEquipChange(slot) {
    // 팔찌로 최대 체력이 바뀔 수 있음
    this.player.maxHp = this.maxHpNow();
    this.player.hp = Math.min(this.player.hp, this.player.maxHp);
    this.playerView.setHp(this.player.hp / this.player.maxHp);
    this.renderBag();
    if (slot === 'weapon') this.setWeapon(this.equip.equipped.weapon);
    // 옷을 바꾸면 무기를 쓸 수 있는지가 바뀌므로 다 만든 뒤 합계를 다시 그림
    else if (slot === 'outfit' || slot === 'head') this.refreshLook().then(() => this.equipPanel.open && this.renderBag());
    // 토시·신발은 화면에 안 보임(능력치만, 아직 0)
    this.save();
  }

  save() {
    if (!this.pos || this.d.noSave) return; // 저장을 지우고 새로 시작하는 중이면 다시 쓰지 않음
    writeSave({
      map: this.d.mapId,
      x: Math.round(this.pos.x),
      y: Math.round(this.pos.y),
      facing: this.facing,
      equipment: { equipped: { ...this.equip.equipped }, bag: this.equip.bag.map((e) => ({ ...e })), coins: this.equip.coins, grants: [...(this.equip.grants || [])] },
      progress: { ...this.progress },
      skills: [...this.learned],
      skillSlots: [...this.skillSlots],
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
    // 우두머리가 부르는 것(개왕 → 들개)도 미리
    for (const t of [...types]) for (const mv of (this.monsterDefs[t] && this.monsterDefs[t].moves) || []) if (mv.kind === 'summon') types.add(mv.monster);
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
        let img = await loadImage(def.image);
        if (!img || !this.sys.isActive()) return;
        if (def.tint) img = tintImage(img, def.tint); // 그림이 없는 무기를 임시로 물들여 쓸 때(data/weapons.json tint)
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
    // 삼연참처럼 빠르게 휘두르는 무예는 swingMsMul배 시간
    // 검술 숙련: 휘두르기 swingMul배 시간(빠르게)
    const sm = this.stats().swingMul;
    const msMul = ((mods && mods.swingMsMul) || 1) * sm;
    const w = msMul !== 1 ? { ...this.weaponDef, swingMs: this.weaponDef.swingMs * msMul, cooldownMs: this.weaponDef.cooldownMs * sm } : this.weaponDef;
    this.sfx.play('swing');
    this.swing = { weapon: w, t: 0, hitDone: false, trail: null, mods };
    if (mods && mods.chargeMs) this.playerView.setWeaponGlow(mods.chargeColor, 0.9, mods.chargeMs + 260);
    this.attackCooldown = w.cooldownMs;
    const res = moveStep(this.map.grid, this.pos, this.facing, w.stepPx, this.cfg.player.footBox, 0);
    this.pos.x = res.x;
    this.pos.y = res.y;
  }

  // 몸 전체 움직임(640 기준): 직전 preMs 동안 뒤로 backPx → 진행 stepFrom~stepTo 동안 앞으로 step → 끝나면 제자리
  // pre: 휘두르기 직전 뒤로 빼는 시간(힘껏 베기는 모으기 시간만큼 김)
  swingLean(t, w, pre) {
    const sw = this.d.weapons.swing;
    const L = sw.lean;
    if (!L) return 0;
    const side = this.facing === 'left' || this.facing === 'right';
    const step = side ? L.stepSide : L.stepFrontBack;
    const smooth = (v) => v * v * (3 - 2 * v);
    if (t < pre) return -L.backPx * smooth(t / pre);
    const p = (t - pre) / w.swingMs;
    if (p < L.stepFrom) return -L.backPx * (1 - smooth(p / L.stepFrom));
    if (p < L.stepTo) return step * smooth((p - L.stepFrom) / (L.stepTo - L.stepFrom));
    if (p <= 1) return step;
    return step * (1 - smooth(Math.min(1, (t - pre - w.swingMs) / sw.recoverMs)));
  }

  // 휘두르는 중 한 프레임. 직전 lean.preMs 동안은 몸만 뒤로 빼고(칼은 치켜든 채),
  // 그 뒤 칼 방향 theta를 thetaFrom → thetaTo로 돌림(처음엔 느리고 끝으로 빠르게).
  // 몸 그림은 PlayerView가 theta로 고름(raise → swing → strike).
  // 반환: 그릴 자세 { theta, lean } 또는 null(끝남)
  updateSwing(dt) {
    const s = this.swing;
    const w = s.weapon;
    const sw = this.d.weapons.swing;
    // 힘껏 베기는 모으기(chargeMs) 동안 더 오래 뒤로 빼고 칼에 금빛이 번짐
    const pre = ((sw.lean && sw.lean.preMs) || 0) + ((s.mods && s.mods.chargeMs) || 0);
    s.t += dt;
    if (s.t >= pre + w.swingMs + sw.recoverMs) {
      if (s.trail) s.trail.fadeOut();
      this.swing = null;
      // 연속 무예(삼연참): 다음 휘두르기를 바로 이어감
      const ch = s.mods && s.mods.chain;
      if (ch && ch.index + 1 < ch.sk.hits) {
        this.startSwing(chainMods(ch.sk, ch.index + 1));
        return this.updateSwing(0);
      }
      return null;
    }
    const lean = this.swingLean(s.t, w, pre);
    if (s.t < pre) return { theta: sw.thetaFrom, lean };
    const theta = swingTheta(sw, (s.t - pre) / w.swingMs);
    // 칼이 앞을 지나는 순간(hitTheta) 맞힘 판정
    if (!s.hitDone && theta >= sw.hitTheta) {
      s.hitDone = true;
      // 지축 가르기·검풍·받아치기처럼 내려치는 순간 다른 일을 하는 무예는 onStrike
      if (s.mods && s.mods.onStrike) s.mods.onStrike();
      else this.strikeHit(w, s.mods);
      if (s.mods && s.mods.waveRadius) crescentWave(this, this.pos.x, this.pos.y, this.facing, s.mods);
    }
    // 궤적: 방향마다 정해 둔 모양을 휘두르는 진행만큼 그림 (data/weapons.json trail)
    if (!s.trail) s.trail = this.makeTrail(w, s.mods);
    const prog = (theta - sw.thetaFrom) / (sw.thetaTo - sw.thetaFrom);
    s.trail.draw(prog);
    this.swingParticles(s, w, prog, dt);
    if (s.t >= pre + w.swingMs) s.trail.fadeOut();
    return { theta, lean };
  }

  makeTrail(w, mods = null, edge = false) {
    const tr = this.d.weapons.trail;
    const facing = this.facing;
    const base = tr[facing === 'up' ? 'back' : facing === 'down' ? 'front' : 'side'];
    // 힘껏 베기: 궤적을 굵게
    let shape = mods && mods.trailWidthMul ? { ...base, thickness: base.thickness * mods.trailWidthMul } : base;
    if (edge) shape = { ...shape, thickness: shape.thickness * 1.35 };
    const x = this.pos.x;
    const y = this.pos.y;
    const pv = this.playerView;
    // 흑웅 대검: 검은 궤적 뒤에 금빛 테두리(trailEdge)
    if (w.trailEdge && !edge && !(mods && mods.trailColor)) {
      const back = this.makeTrail(w, mods, true);
      const front = this.makeTrail({ ...w, trailEdge: null }, mods);
      return { draw: (u) => { back.draw(u); front.draw(u); }, fadeOut: () => { back.fadeOut(); front.fadeOut(); }, pointAt: (u) => front.pointAt(u) };
    }
    return new SwingTrail(this, {
      shape,
      cfg: tr,
      k: w.tipFromGrip / tr.refTip,
      color: edge ? w.trailEdge : (mods && mods.trailColor) || w.trailColor,
      toMap: (px, py) => pv.posePoint(px, py, x, y + ((mods && mods.trailOffset) || 0), facing === 'right'),
      res: this.pixelScale(),
      // 칼(몸 앞 +0.01)·손 덮개(+0.02) 아래, 몸 위. 뒷면은 몸 뒤
      depth: y + (shape.behind ? -0.03 : 0.005) - (edge ? 0.001 : 0),
      // 삼연참: 궤적이 trailHoldMs 동안 남아 엇갈려 보임
      fx: mods && mods.trailHoldMs ? { ...this.cfg.swingFx, trailMs: mods.trailHoldMs } : this.cfg.swingFx,
    });
  }

  // 휘두르는 동안 칼끝을 따라 무기 고유 알갱이(trailParticles: cloud·petal·flame·dust·star, 칠성검 sevenStars)
  swingParticles(s, w, prog, dt) {
    const kind = w.fx && w.fx.trailParticles;
    if (!kind || !s.trail.pointAt || prog <= 0.05) return;
    if (kind === 'sevenStars') {
      s.starsLit = s.starsLit || 0;
      while (s.starsLit < 7 && prog >= (s.starsLit + 0.5) / 7.5) {
        const p = s.trail.pointAt((s.starsLit + 0.5) / 7.5);
        sevenStar(this, p.x, p.y);
        s.starsLit += 1;
      }
      return;
    }
    s.particleT = (s.particleT || 0) - dt;
    if (s.particleT > 0 || prog >= 1) return;
    s.particleT = 22;
    const p = s.trail.pointAt(prog);
    trailParticle(this, p.x, p.y, kind, w.trailColor);
  }

  // 내려치는 순간: 앞의 몬스터 1마리 맞힘 + 히트스톱·타격 불꽃·화면 흔들림
  strikeHit(w, mods = null) {
    const m = mods || {};
    const hf = w.fx && w.fx.hitFx;
    // 청풍검: 바람 칼날이 앞으로 16 더 날아가 맞힘
    const reach = w.reach + (hf === 'windBlade' ? 16 : 0);
    if (hf === 'windBlade') this.windBladeFx(w);
    const target = findTarget(this.pos, this.facing, this.spawner.monsters, reach, w.width);
    if (!target) return;
    this.impactHit(target, this.facing, (w.damage + this.levelDamage()) * (m.damageMul || 1), {
      kind: mods ? 'skill' : 'hit',
      knockbackPx: w.knockbackPx * (m.knockbackMul || 1) * (hf === 'crack' ? 1.5 : 1), // 쇠엄니 대도: 밀어내기 큼
      stunMs: w.stunMs,
      hitStopMul: (m.hitStopMul || 1) * (w.hitStopMul || 1), // 무거운 칼(쇠엄니·산저·흑웅)은 조금 길게
      shakeMul: m.shakeMul,
      starScale: m.starScale,
    });
  }

  // 청풍검 바람 칼날: 작은 반달이 앞으로 짧게 날아가 사라짐
  windBladeFx(w) {
    const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing];
    const shot = new CrescentShot(this, dx, dy, 18, w.trailColor);
    const x0 = this.pos.x + dx * 14;
    const y0 = this.pos.y + dy * 6;
    const o = { d: 0 };
    this.tweens.add({ targets: o, d: w.reach + 16, duration: 160, onUpdate: () => shot.draw(x0 + dx * o.d, y0 + dy * o.d, 1 - o.d / (w.reach + 40)), onComplete: () => shot.destroy() });
  }

  // ---------- 맞히기 한 번(모든 공격·무예 공통, docs/spec/skills_impact.md 1) ----------
  // 회심 판정(규칙 쪽 rollCrit) → 체력 깎기 → 숫자 → 흰 섬광 별·베인 자국·먹 방울·찌그러짐 → 멈춤·흔들림·소리 → 쓰러뜨림.
  // o: { kind 'hit'|'skill', knockbackPx, stunMs, hitStopMul, shakeMul, starScale(섬광 배율), color(베인 자국 색),
  //      forceCrit(받아치기), quiet(여러 마리를 한꺼번에 칠 때 — 멈춤·흔들림·맞음 소리는 부르는 쪽이 한 번만) }
  // 반환: { damage, killed, crit }
  impactHit(target, dir, damage, o = {}) {
    const im = this.cfg.impact;
    const sfx = this.cfg.swingFx;
    const fx = this.cfg.hitFx;
    const st = this.stats();
    // 은 팔찌·급소 노리기: 회심 확률 +, 급소 노리기: 회심 데미지 +
    const critCfg = { ...im.crit, chance: im.crit.chance + st.critChance, damageMul: im.crit.damageMul + st.critDamageAdd };
    // 패시브 공격력 배율(검술 숙련·기세), 산군의 기백: 우두머리에게 +
    damage *= st.attackMul * (this.monsterDefs[target.type].boss ? st.bossDamageMul : 1);
    this.calmMs = 0;
    const roll = rollCrit(damage, critCfg, Math.random, !!o.forceCrit);
    const isSkill = o.kind === 'skill';
    if (isSkill) this.skillFx.markHit(target.id); // 맞은 몬스터는 어둡게 하지 않음
    // 평타는 조금 더 밀려남(impact.knockbackMul)
    const knock = (o.knockbackPx ?? this.cfg.attack.knockbackPx) * (isSkill ? 1 : im.knockbackMul);
    const result = hitMonster(target, dir, this.adminDamage(target, roll.damage), knock, o.stunMs ?? this.cfg.attack.stunMs);
    const def = this.monsterDefs[target.type];
    const pr = this.d.getPixelRatio();
    const fxc = this.d.skills.fxCommon;
    const skillColor = o.color || this.skillFx.color || '#ffd75e';
    showDamage(this, target.x, target.y - def.height - 2, result.damage, fx, pr, roll.crit ? 'crit' : o.kind || 'hit', isSkill ? { scale: fxc.numberScale, stroke: skillColor } : null);
    // 무기 구간(fxTier)마다 섬광·베인 자국·먹 방울이 커짐
    const w = this.canSwing ? this.weaponDef : null;
    const tier = (w && w.fx && w.fx.fxTier) || 1;
    const tierK = 1 + (tier - 1) * im.tierStep;
    const hx = target.x;
    const hy = target.y - def.height * 0.45;
    const big = (o.starScale || 1) * (roll.crit ? im.crit.starScale : 1);
    hitStar(this, hx, hy, im.starSize * tierK * big, roll.crit ? im.crit.starColor : im.starColor, im.starMs * (roll.crit ? 1.5 : 1));
    if (w || o.color) slashMark(this, hx, hy, dir, im.slashLen * tierK * Math.sqrt(big), im.slashWidth * tierK, o.color || w.trailColor, im.slashMs);
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    inkSplash(this, hx, hy, sfx.splashColor || '#1b1712', tierK === 1 ? sfx : { ...sfx, splashSize: sfx.splashSize * tierK }, v[0], v[1]);
    // 작은 파편(무기 궤적 색), 무예로 맞히면 큰 섬광 + X자 베인 자국 + 파편 더
    this.skillFx.shards(hx, hy, (w && w.trailColor) || '#f3ead6', Math.round(im.shards * tierK), 20 * tierK);
    if (isSkill) this.skillFx.hit(hx, hy, dir, skillColor);
    // 회심: 화면 가장자리가 하얗게
    if (roll.crit) this.skillFx.edgeFlash(im.crit.edgeAlpha, im.crit.edgeMs);
    const view = this.monsterViews.get(target.id);
    if (view && !result.killed) view.squash(im.squashMs, im.squashX, im.squashY);
    // 무기 고유 타격 연출(weapon_list.md: 구렁이 비늘검 독안개)
    if (w && w.fx && w.fx.hitFx) weaponHitFx(this, w.fx.hitFx, hx, hy, dir, w.trailColor, tierK);
    if (roll.crit) this.sfx.play('crit');
    if (!o.quiet) {
      let stop = sfx.hitStopMs * (o.hitStopMul || 1) * (isSkill ? fxc.hitStopMul : 1);
      let shake = sfx.shakeIntensity * (o.shakeMul || 1) * (isSkill ? fxc.shakeMul : 1);
      if (roll.crit) {
        stop *= im.crit.hitStopMul;
        shake *= im.crit.shakeMul;
      }
      if (result.killed) stop *= im.kill.hitStopMul;
      this.hitStopMs = Math.max(this.hitStopMs, stop);
      this.cameras.main.shake(sfx.shakeMs, shake);
      this.sfx.play(o.sound || (w ? 'woodHit' : 'punchHit'));
      this.playPok(tier);
    }
    this.afterHit(target, result, dir);
    return { ...result, crit: roll.crit };
  }

  // 여러 마리를 한꺼번에 친 뒤 멈춤·흔들림·소리를 한 번만(stopMul: 보통 멈춤의 배율)
  // 무예 중이면 멈춤·흔들림 fxCommon 배율, 맞힌 수만큼 '타다닥'
  multiHitFeedback(hits, stopMul = 0.5, shakeMul = 1) {
    if (!hits.length) return;
    const sfx = this.cfg.swingFx;
    const fxc = this.d.skills.fxCommon;
    const k = this.skillFx.active ? 1 : 0;
    const killed = hits.some((h) => h.killed);
    this.hitStopMs = Math.max(this.hitStopMs, sfx.hitStopMs * stopMul * (killed ? this.cfg.impact.kill.hitStopMul : 1) * (k ? fxc.hitStopMul : 1));
    this.cameras.main.shake(sfx.shakeMs, sfx.shakeIntensity * shakeMul * (k ? fxc.shakeMul : 1));
    this.sfx.play(this.canSwing ? 'woodHit' : 'punchHit');
    const w = this.canSwing ? this.weaponDef : null;
    this.playPok((w && w.fx && w.fx.fxTier) || 1);
    if (hits.length > 1) {
      for (let i = 0; i < Math.min(hits.length, fxc.tickMax); i++) this.time.delayedCall(i * fxc.tickGapMs, () => this.sfx.play('tick'));
    }
  }

  // 맞힘 밑의 낮은 '퍽': 무기 구간이 높을수록 낮고 크게
  playPok(tier) {
    const pk = this.cfg.impact.pok;
    this.sfx.play('pok', { pitch: Math.max(0.5, 1 - (tier - 1) * pk.tierPitchStep), volume: 1 + (tier - 1) * pk.tierVolumeStep });
  }

  // 맞힌 뒤: 소리, 번쩍 또는 쓰러짐(맞은 방향으로 튕겨 날아가며 연기, 경험치·전리품)
  afterHit(target, result, dir = this.facing) {
    const fx = this.cfg.hitFx;
    const view = this.monsterViews.get(target.id);
    this.playMonsterSound(target, result.killed);
    if (result.killed && target.clone) {
      // 분신(둔갑 너구리): 연기로 사라짐, 경험치·전리품 없음
      this.spawner.remove(target);
      this.monsterViews.delete(target.id);
      if (view) view.vanish();
      this.sfx.play('poof');
      return;
    }
    if (result.killed) {
      // 규칙에서 바로 빼서 다시 생기는 시간이 흐르기 시작하고, 그림은 날아가는 연출 뒤 사라짐
      this.spawner.remove(target);
      this.monsterViews.delete(target.id);
      if (view) view.dieFly(dir, this.cfg.impact.kill, fx.flashMs);
      this.sfx.play('kill');
      // 쓰러뜨림: 아주 잠깐 느린 화면(이미 더 느리면 그대로)
      const kc = this.cfg.impact.kill;
      if (!this.slowMo || this.slowMo.scale > kc.slowScale) this.slowMo = { left: kc.slowMs, scale: kc.slowScale };
      this.onMonsterKilled(target);
    } else if (view) {
      view.flash(fx.flashMs);
    }
  }

  // ---------- 주먹 지르기 ----------
  // 바라보는 쪽으로 조금 내딛고, 바로 앞 몬스터 1마리를 맞힘 (mods: 힘껏 베기 배율)
  punch(mods = null) {
    const a = this.cfg.attack;
    const m = mods || {};
    this.punchMs = a.punchMs;
    this.attackCooldown = a.cooldownMs;
    const p = this.cfg.player;
    const res = moveStep(this.map.grid, this.pos, this.facing, a.stepPx, p.footBox, 0);
    this.pos.x = res.x;
    this.pos.y = res.y;

    const target = findTarget(this.pos, this.facing, this.spawner.monsters, a.reach, a.width);
    if (!target) return;
    if (mods && mods.waveRadius) crescentWave(this, this.pos.x, this.pos.y, this.facing, mods);
    this.impactHit(target, this.facing, (a.damage + this.levelDamage()) * (m.damageMul || 1), {
      kind: mods ? 'skill' : 'hit',
      knockbackPx: a.knockbackPx * (m.knockbackMul || 1),
      stunMs: a.stunMs,
      hitStopMul: m.hitStopMul,
      shakeMul: m.shakeMul,
      starScale: m.starScale,
    });
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

  // 낀 장비 전체 능력치 { attack, defense, speedMul } — 옷 6종 모두 무기 자세가 있어 무기 공격력 그대로(2026-10-18)
  // + 배운 패시브(docs/spec/feedback_1020.md 8), 기세가 켜져 있으면 공격력 +
  stats() {
    return totalStats(this.equip.equipped, this.itemDefs, this.weaponDefs, this.cfg.attack.damage, this.progress.level, this.d.economy.levels, this.passive(), this.momentumMs > 0);
  }

  // 배운 패시브 효과 합(배운 수가 바뀔 때만 다시 셈)
  passive() {
    const learned = this.d.learned || [];
    const c = this.d.passiveCache;
    if (c && c.n === learned.length) return c.p;
    const p = passiveSum(this.d.skills.skills, learned);
    this.d.passiveCache = { n: learned.length, p };
    return p;
  }

  // 패시브를 새로 배운 뒤: 최대 체력(단련된 몸)·능력치 다시 맞춤. 늘어난 최대 체력만큼 지금 체력도 늘림
  refreshAfterPassive() {
    const old = this.player.maxHp;
    this.player.maxHp = this.maxHpNow();
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(0, this.player.maxHp - old));
    this.playerView.setHp(this.player.hp / this.player.maxHp);
    this.refreshStatus();
    if (this.equipPanel.open) this.renderBag();
  }

  // 무예 트리 규칙(앞 무예를 배워야 다음, data/game.json skillTreeRequires)
  treeOpts() {
    return { tree: this.cfg.skillTreeRequires !== false, names: Object.fromEntries(this.skills.map((k) => [k.id, k.name])) };
  }

  isActiveSkill(id) {
    const sk = this.d.skills.skills.find((k) => k.id === id);
    return !!sk && sk.type !== 'passive';
  }

  // 최대 체력 = 레벨 표 + 낀 장비의 maxHp(구슬 팔찌). 장비가 아직 없으면(처음 불러올 때) 레벨 표만
  maxHpNow() {
    const base = maxHpFor(this.progress.level, this.cfg.player.maxHp, this.d.economy.levels);
    const eq = this.d.equip;
    if (!eq) return base;
    const defs = this.itemDefs || Object.fromEntries(this.d.items.items.map((it) => [it.id, it]));
    const eqHp = Object.values(eq.equipped).reduce((a, id) => a + ((id && defs[id] && defs[id].stats && defs[id].stats.maxHp) || 0), 0);
    return Math.round((base + eqHp) * (1 + this.passive().maxHpMul)); // 단련된 몸: 최대 체력 +10%
  }

  // 레벨 데미지 보너스(레벨마다 +damagePerLevel, 정수 부분만)
  // + 팔찌 공격력(금 팔찌)
  levelDamage() {
    return damageBonus(this.progress.level, this.d.economy.levels) + this.stats().attackBonus;
  }

  // ---------- 쓰러뜨림: 경험치·전리품 ----------
  onMonsterKilled(target) {
    const def = this.monsterDefs[target.type];
    // 기세: 쓰러뜨리면 momentumMs 동안 공격력 +(겹치지 않고 시간만 새로)
    const pv = this.passive();
    if (pv.momentumMs) {
      if (!(this.momentumMs > 0)) this.toast.show('기세! 공격력 +' + Math.round(pv.momentumAttackMul * 100) + '%', 1200);
      this.momentumMs = pv.momentumMs;
    }
    // 우두머리를 쓰러뜨리면 잠긴 출구가 열림(빛나기 시작)
    this.map.portals.forEach((p, i) => {
      if (p.unlockOnKill === target.type && !this.unlocked.has(p.id)) {
        this.unlocked.add(p.id);
        this.portalFx[i].setVisible(true);
        const label = p.label || p.name;
        // '마을로'처럼 이미 '로'로 끝나면 그대로
        this.toast.show(`${label.endsWith('로') ? label : josa(label, '으로', '로')} 가는 길이 열렸습니다`, 3000);
      }
    });
    const { exp, entries } = killRewards(def, this.cfg.testBoost);
    if (exp) this.gainExp(exp, { x: target.x, y: target.y - def.height - 2 });
    for (const d of this.ground.spawn(target.x, target.y, entries, this.map.grid)) {
      const key = `drop:${d.coins ? 'coins' : d.item}`;
      this.dropViews.set(d.id, new DropView(this, d, d.item ? this.itemDefs[d.item] : null, this.d.economy.groundDrops, this.d.getPixelRatio(), this.cfg.shadow, key, this.dropTexRes()));
    }
  }

  // at: "+N 경험" 글자를 띄울 자리(몬스터 머리 위, 없으면 주인공 머리 위)
  gainExp(amount, at = null) {
    this.showExpGain(amount, at || { x: this.pos.x, y: this.pos.y - this.cfg.player.height - 10 });
    const eco = this.d.economy;
    const before = this.progress.level;
    const gained = addExp(this.progress, amount, eco.levels);
    if (gained > 0) {
      // 레벨업: 최대 체력 +hpPerLevel, 체력 가득(체력바가 차오름), 연출(docs/spec/economy.md '2차 다듬기 — 레벨업 연출')
      const fx = eco.levelUpFx;
      const fromHp = this.player.hp;
      const oldMax = this.player.maxHp;
      this.player.maxHp = this.maxHpNow();
      this.player.hp = this.player.maxHp;
      this.hpFill = { from: fromHp, t: 0, ms: fx.hpFillMs };
      // 멈칫: slowMs 동안 게임이 slowScale 배속으로 느려짐(조작은 그대로 됨)
      this.slowMo = { left: fx.slowMs, scale: fx.slowScale };
      levelUpFx(this, () => this.pos, this.cfg.player.height, this.progress.level, this.player.maxHp - oldMax, fx, this.d.getPixelRatio());
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

  // 무예 시전 때 나머지를 어둡게(docs/spec/feedback_1021.md 6): 바닥은 검은 막이, 깊이 순으로 서는 것 중
  // 물건 조각·NPC·이번 무예와 상관없는 몬스터·떨어진 물건은 같은 정도로 물들임. 주인공·무예 연출·맞은 몬스터는 그대로
  applyShade() {
    const fx = this.skillFx;
    const k = fx.shadeK;
    if (k <= 0 && !this.shadeOn) return;
    this.shadeOn = k > 0;
    for (const o of this.mapObjects) shadeImage(o.image, k);
    for (const v of this.npcViews) {
      shadeImage(v.sprite, k);
      shadeImage(v.label, k);
    }
    for (const v of this.dropViews.values()) for (const c of (v.box && v.box.list) || []) shadeImage(c, k);
    for (const [id, v] of this.monsterViews) v.applyShade(fx.isHit(id) ? 0 : k);
    if (k <= 0) fx.hitIds = null; // 어둠이 다 걷히면 맞은 몬스터 표시도 지움
  }

  // 얻은 경험치 글자(docs/spec/feedback_1021.md 3): 데미지 숫자보다 delayMs 늦게 떠올라 holdMs 머묾, 시험 배율이면 옆에 작게 "×3"
  showExpGain(amount, at) {
    const c = this.cfg.expText;
    const boost = this.cfg.testBoost && this.cfg.testBoost.enabled && this.cfg.testBoost.exp !== 1 ? `×${this.cfg.testBoost.exp}` : '';
    const pr = this.d.getPixelRatio();
    this.statusPanel.flashExp(amount);
    this.time.delayedCall(c.delayMs, () => {
      const style = { color: c.color, stroke: c.stroke, fontPx: c.fontPx, floatPx: c.floatPx, holdMs: c.holdMs, fadeMs: c.fadeMs };
      const t = floatText(this, at.x, at.y - c.abovePx, `+${amount} 경험`, style, pr);
      if (boost) {
        const b = floatText(this, at.x + t.displayWidth / 2 + 2, at.y - c.abovePx - 2, boost, { ...style, fontPx: c.boostPx }, pr);
        b.setOrigin(0, 1);
      }
    });
  }

  // 바닥 물건: 시간 흐름, 가까이 가면 저절로 주움
  updateDrops(dt) {
    const alive = !this.dead && !this.transitioning;
    const { picked, expired } = this.ground.update(dt, alive ? this.pos : null);
    // 줍기 알림: 머리 위에 쌓이고 같은 물건은 합침(`쥐고기 +3`, `5푼`)
    picked.forEach((d) => {
      const view = this.dropViews.get(d.id);
      this.dropViews.delete(d.id);
      if (view) view.pickup(this.pos.x, this.pos.y - this.cfg.player.height * 0.4);
      if (d.coins) {
        this.equip.coins += d.coins;
        this.sfx.play('coin');
        this.pickupFeed.add('coins', d.coins, (n) => this.coinsText(n), { color: '#ffd98a', stroke: '#3a2408' });
      } else {
        addItem(this.equip, this.itemDefs, d.item, d.n);
        this.sfx.play('pickup');
        const name = this.itemDefs[d.item].name;
        this.pickupFeed.add(d.item, d.n, (n) => `${name} +${n}`, { color: '#f3ead6', stroke: '#2a1c10' });
      }
    });
    this.pickupFeed.update(dt, this.pos.x, this.pos.y - this.cfg.player.height - 8);
    if (picked.length) {
      this.refreshStatus();
      if (this.equipPanel.open) this.renderBag();
    }
    for (const d of expired) {
      const view = this.dropViews.get(d.id);
      this.dropViews.delete(d.id);
      if (view) view.destroy();
    }
    // 이름 글자: 서로 가까우면 하나만
    const shown = [];
    const near = this.d.economy.groundDrops.labelOverlapPx;
    for (const v of this.dropViews.values()) {
      v.update();
      const clash = shown.some((o) => Math.abs(o.x - v.d.x) < near && Math.abs(o.y - v.d.y) < near * 0.5);
      v.setLabelVisible(!clash);
      if (!clash) shown.push(v.d);
    }
  }

  // 바닥 아이콘 텍스처: 맵 1픽셀당 텍스처 픽셀(화면 배율의 1.5배로 또렷하게)
  dropTexRes() {
    return this.pixelScale() * 1.5;
  }

  // 바닥 물건 아이콘(그림이 있는 것만, 없으면 글자 칸)
  async prepareIconTextures() {
    if (this.d.iconsLoaded) return;
    this.d.iconsLoaded = true;
    // 바닥용: 테두리(크림색 + 진한 갈색, 드문 것은 금색)를 두른 아이콘을 한 번 만들어 둠
    const gd = this.d.economy.groundDrops;
    const list = this.d.items.items.filter((it) => it.stack).map((it) => [it.id, it.icon]);
    list.push(['coins', gd.coinIcon]);
    await Promise.all(list.map(async ([id, path]) => {
      const img = await loadImage(path);
      if (img && this.sys.isActive()) makeDropTexture(this, `drop:${id}`, img, gd, this.dropTexRes(), (gd.rareItems || []).includes(id));
    }));
  }

  // 둘레 r 안의 몬스터와 그 그림(레벨업 충격파로 밀려나 보이기)
  monsterViewsNear(x, y, r) {
    const out = [];
    for (const m of this.spawner.monsters) {
      const v = this.monsterViews.get(m.id);
      if (v && Math.hypot(m.x - x, m.y - y) <= r) out.push([m, v]);
    }
    return out;
  }

  // 저절로 차는 체력·버프 시간: 숨 고르기 이어 채우기(hot), 질긴 숨(싸우지 않은 지 regenAfterMs 뒤 regenEveryMs마다), 기세 시간
  updateRecovery(dt) {
    if (this.momentumMs > 0) this.momentumMs -= dt;
    if (this.dead) return;
    const h = this.hot;
    if (h) {
      const step = Math.min(dt, h.left);
      h.left -= step;
      h.acc += h.perMs * step;
      // 1 이상 모이면 정수만큼 채우고 나머지는 남김(끝날 때 남은 것은 올림)
      const n = h.left <= 0 ? Math.round(h.acc) : Math.floor(h.acc);
      if (n >= 1) {
        this.healPlayer(n, true);
        h.acc -= n;
      }
      if (h.left <= 0) this.hot = null;
    }
    const pv = this.passive();
    this.calmMs = (this.calmMs || 0) + dt;
    if (pv.regenRatio && this.calmMs >= pv.regenAfterMs && this.player.hp < this.player.maxHp) {
      this.regenAcc = (this.regenAcc || 0) + dt;
      if (this.regenAcc >= pv.regenEveryMs) {
        this.regenAcc -= pv.regenEveryMs;
        this.healPlayer(Math.max(1, Math.round(this.player.maxHp * pv.regenRatio)), true);
      }
    } else {
      this.regenAcc = 0;
    }
  }

  // ---------- 무예 ----------
  useSkill(id) {
    const sk = this.skills.find((s) => s.id === id);
    if (!sk) return;
    if (sk.type === 'passive') return; // 패시브는 늘 켜져 있음(칸에 안 넣음)
    if (!this.learned.includes(id)) {
      this.toast.show(`${josa(sk.name, '은', '는')} 우물가 늙은 군관에게 배웁니다 (레벨 ${(sk.requires && sk.requires.level) || 1})`);
      return;
    }
    if (this.dead || this.transitioning || this.gridOn || this.equipPanel.open || this.npcPanel.open) return;
    if ((this.d.adminPanel && this.d.adminPanel.open) || (this.d.skillPanel && this.d.skillPanel.open)) return;
    if (!this.cooldowns.ready(id)) return;
    if (this.swing || this.spin || this.act || this.punchMs > 0) return;
    // 칼이 있어야 하는 무예(지축 가르기·검풍·백호일섬·칠성검무)
    if (sk.needsBlade && !this.canSwing) {
      this.toast.show('칼이 있어야 합니다');
      return;
    }
    const run = SKILL_KINDS[sk.kind];
    if (!run || !run(this, this.fxScaled(sk))) return;
    this.skillFx.start(sk, (sk.colorFromWeapon && this.canSwing ? this.weaponDef.trailColor : sk.color || sk.trailColor || sk.ringColor || sk.glowColor || sk.boltColor || sk.shieldColor) || '#ffd75e');
    // 칠보 팔찌·무예 달인: 기다림 −, 관리자 '무예 기다림 없음'이면 기다리지 않음
    if (!this.d.admin.noCooldown) this.cooldowns.start(id, sk.cooldownMs * this.stats().cooldownMul);
    this.refreshSkills();
  }

  // 무예 연출 크기·알갱이 수를 키운 사본(fxCommon.sizeKeys×sizeMul, countKeys×particleMul). 맞는 범위(radius 등)는 그대로.
  // 칠성검무는 별 자리(size)가 곧 맞는 자리라 키우지 않음
  fxScaled(sk) {
    const c = this.d.skills.fxCommon;
    if (!c || sk.kind === 'ultimate') return sk;
    const out = { ...sk };
    for (const k of c.sizeKeys) if (typeof out[k] === 'number') out[k] *= c.sizeMul;
    for (const k of c.countKeys) if (typeof out[k] === 'number') out[k] = Math.round(out[k] * c.particleMul);
    return out;
  }

  // 오래 걸리는 무예 '하는 중' 상태(skillKinds.js). act: { dur, lockMove, update(dt, t) → 자세, onEnd, guard }
  setAct(act) {
    this.act = { t: 0, ...act };
  }

  updateAct(dt) {
    const a = this.act;
    a.t += dt;
    const pose = a.update ? a.update(dt, a.t) : null;
    if (this.act === a && a.t >= a.dur) {
      this.act = null;
      if (a.onEnd) a.onEnd();
    }
    return pose;
  }

  // 무예 칸에 넣음(배울 때 빈칸이 있으면 자동으로)
  autoSlotSkill(id) {
    if (!this.isActiveSkill(id)) return;
    autoSlot(this.skillSlots, id);
    this.refreshSkills();
  }

  // 휘돌려 베기: 아래 → 왼쪽 → 위 → 오른쪽으로 몸을 돌리며 원형 궤적, 중간에 둘레 몬스터를 모두 때림
  // 휘돌려 베기(지속형): spinMs 동안 계속 돌며(한 바퀴 turnMs) tickMs마다 둘레 몬스터를 모두 벰. 도는 동안 천천히 움직일 수 있음
  startSpin(sk) {
    const order = ['down', 'left', 'up', 'right'];
    this.sfx.play('swing');
    this.spin = {
      sk,
      t: 0,
      nextTick: sk.tickMs,
      startFacing: this.facing,
      order: [...order.slice(order.indexOf(this.facing)), ...order.slice(0, order.indexOf(this.facing))],
      ring: new WindRing(this, sk),
      // 회오리 베기: 안쪽에 반대로 도는 고리 하나 더 + 나뭇잎 회오리
      ring2: sk.rings2 ? new WindRing(this, { ...sk, radius: sk.radius * 0.62, turnMs: -sk.turnMs * 0.8 }) : null,
    };
    if (sk.leafCount) leafSwirl(this, () => this.pos, sk, sk.spinMs);
    this.attackCooldown = Math.max(this.attackCooldown, sk.spinMs);
  }

  updateSpin(dt) {
    const s = this.spin;
    const sk = s.sk;
    s.t += dt;
    this.facing = s.order[Math.floor(s.t / (sk.turnMs / 4)) % 4];
    s.ring.update(this.pos, s.t, dt);
    if (s.ring2) s.ring2.update(this.pos, s.t, dt);
    while (s.t >= s.nextTick && s.nextTick <= sk.spinMs) {
      s.nextTick += sk.tickMs;
      this.sfx.play('swing');
      this.spinHit(sk);
    }
    if (s.t >= sk.spinMs) {
      s.ring.fadeOut();
      if (s.ring2) s.ring2.fadeOut();
      this.facing = s.startFacing;
      this.spin = null;
      return null;
    }
    // 무기를 들었으면 칼을 앞으로 뻗은 내려치기 자세, 맨손이면 주먹
    return this.canSwing ? { theta: 105, lean: 0 } : 'punch';
  }

  spinHit(sk) {
    const w = this.canSwing ? this.weaponDef : null;
    const base = this.skillBase();
    const hits = this.monstersInCircle(this.pos.x, this.pos.y, sk.radius).map((target) =>
      this.impactHit(target, this.dirTo(target), base * (sk.damageMul || 1), {
        kind: 'skill',
        knockbackPx: sk.knockbackPx,
        stunMs: w ? w.stunMs : this.cfg.attack.stunMs,
        quiet: true,
      }));
    // 여러 번 때리므로 멈춤은 짧게
    this.multiHitFeedback(hits, 0.5);
    if (sk.pullPx) pullMonsters(this, sk);
  }

  // 무예 데미지 바탕: 든 무기(맨손이면 주먹) + 레벨 보너스
  skillBase() {
    return (this.canSwing ? this.weaponDef.damage : this.cfg.attack.damage) + this.levelDamage();
  }

  // 주인공 → 몬스터 쪽 4방향
  dirTo(m, from = this.pos) {
    const dx = m.x - from.x;
    const dy = m.y - from.y;
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  }

  // (x, y)에서 반경 r 안의 살아 있는 몬스터(가까운 순)
  monstersInCircle(x, y, r) {
    return this.spawner.monsters
      .filter((m) => m.hp > 0 && Math.hypot(m.x - x, m.y - y) <= r)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
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
    // 받아치기 자세: 데미지 0 + 바로 반격
    if (this.act && this.act.guard) {
      this.act.guard.counter(bite.monster);
      return;
    }
    // 데미지 없는 포효(산군): 몸만 굳음
    if (!bite.damage && bite.rootMs) {
      this.rootMs = Math.max(this.rootMs || 0, bite.rootMs);
      this.cancelRecall('포효에 귀환이 끊겼습니다');
      this.toast.show('포효에 몸이 굳었습니다', 1200);
      return;
    }
    this.sfx.play('playerHurt');
    this.cancelRecall('맞아서 귀환이 끊겼습니다');
    const ph = this.cfg.playerHit;
    // 방어력만큼 덜 아픔(최소 1)
    this.calmMs = 0;
    const st = this.stats();
    const result = hitPlayer(this.player, damageTaken(bite.damage, st.defense, st.damageTakenMul)); // 철갑 기운: −10%
    // 관리자 '안 죽기': 체력이 1 아래로 내려가지 않음
    if (this.d.admin.noDie && this.player.hp < 1) {
      this.player.hp = 1;
      result.killed = false;
    }
    this.playerView.setHp(this.player.hp / this.player.maxHp);
    this.playerView.flash(ph.flashColor, ph.flashMs);
    showDamage(this, this.pos.x, this.pos.y - this.cfg.player.height - 8, result.damage, this.cfg.hitFx, this.d.getPixelRatio(), 'player');
    this.knock = { dir: bite.dir, left: bite.knockbackPx ?? ph.knockbackPx }; // 쥐왕 돌진은 더 많이 밀려남
    // 산군 포효: rootMs 동안 못 움직임
    if (bite.rootMs) {
      this.rootMs = Math.max(this.rootMs || 0, bite.rootMs);
      this.toast.show('포효에 몸이 굳었습니다', 1200);
    }
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
      const maxHp = this.maxHpNow();
      this.d.player = { hp: maxHp, maxHp };
      this.scene.restart({ ...this.d, mapId: start, mapJson, arrive: { ...mapJson.spawn, facing: 'down' } });
    });
  }

  // ---------- 맵 이동 ----------
  // 잠긴 이동 지점(unlockOnKill: 그 몬스터를 쓰러뜨려야 열림 — 쥐왕의 방 '마을로')은 열리기 전엔 없는 것과 같음
  portalOpen(p) {
    return !p.unlockOnKill || (this.unlocked && this.unlocked.has(p.id));
  }

  portalAt(x, y) {
    return this.map.portals.find((p) => this.portalOpen(p) && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) || null;
  }

  // ---------- 귀환(부적) ----------
  recallDef() {
    return this.itemDefs[this.cfg.recall.item];
  }

  recallUsable() {
    const def = this.recallDef();
    return !!def && this.d.mapId !== def.use.returnTo.map;
  }

  // 귀환 시작: channelMs 동안 몸이 푸르게 빛난 뒤 이동. 그 사이 맞으면 취소(부적은 그대로)
  startRecall() {
    const def = this.recallDef();
    if (!def || this.recall || this.transitioning || this.dead) return;
    if (!this.recallUsable()) {
      this.toast.show('마을에서는 쓸 수 없습니다');
      return;
    }
    if (countItem(this.equip, def.id) <= 0) {
      this.toast.show('귀환 부적은 성황당(마을 왼쪽 아래 서낭나무)이나 약방에서 살 수 있습니다', 2500);
      return;
    }
    const rc = this.cfg.recall;
    this.recall = { left: rc.channelMs };
    this.playerView.setGlow(rc.glowColor, rc.glowAlpha, rc.channelMs + 200);
    this.sfx.play('heal');
  }

  cancelRecall(reason) {
    if (!this.recall) return;
    this.recall = null;
    this.playerView.glowState = null;
    this.playerView.glow.setVisible(false);
    if (reason) this.toast.show(reason);
  }

  updateRecall(dt) {
    if (!this.recall) return;
    this.recall.left -= dt;
    if (this.recall.left > 0) return;
    this.recall = null;
    const def = this.recallDef();
    if (!removeItem(this.equip, def.id, 1)) return;
    this.toast.show(`${josa(def.name, '을', '를')} 썼습니다`);
    this.save();
    const r = def.use.returnTo;
    this.travel(r.map, { x: r.x, y: r.y, facing: r.facing || 'down' });
  }

  // 다른 맵(또는 같은 맵의 다른 자리)으로: 어두워졌다가 도착 자리에서 밝아짐
  travel(mapId, arrive) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.save();
    const cam = this.cameras.main;
    const next = this.d.fetchMap(mapId);
    cam.fadeOut(this.cfg.mapFadeMs, 0, 0, 0);
    cam.once('camerafadeoutcomplete', async () => {
      try {
        const mapJson = await next;
        this.scene.restart({ ...this.d, mapId, mapJson, arrive });
      } catch (err) {
        console.error(err);
        this.transitioning = false;
        cam.fadeIn(this.cfg.mapFadeMs);
      }
    });
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

  // 날아가는 여우불(spawner.shots): 푸른 불덩이 + 꼬리 빛
  drawShots() {
    const shots = this.spawner.shots;
    if (!this.shotG) this.shotG = this.add.graphics().setDepth(1e6 - 4).setBlendMode(Phaser.BlendModes.ADD);
    const g = this.shotG;
    g.clear();
    for (const sh of shots) {
      const c = Phaser.Display.Color.HexStringToColor(sh.color || '#58a8ff').color;
      for (let k = 0; k < 4; k++) {
        const t = k * 0.04;
        g.fillStyle(c, 0.5 - k * 0.1);
        g.fillCircle(sh.x - sh.vx * t, sh.y - sh.vy * t, sh.radius * (1 - k * 0.18));
      }
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(sh.x, sh.y, sh.radius * 0.45);
    }
  }

  // ---------- 관리자 모드에서 부르는 것(docs/spec/admin_mode.md, 창은 src/ui/adminPanel.js) ----------
  // 한 방: 맞힌 몬스터의 남은 체력만큼
  adminDamage(target, damage) {
    return this.d.admin.oneHit ? Math.max(damage, target.hp) : damage;
  }

  // 레벨을 바로 정함: 최대 체력·데미지 보너스가 바로 바뀌고 체력 가득, 레벨업 연출 없음
  setLevelNow(level) {
    setLevel(this.progress, level, this.d.economy.levels);
    this.player.maxHp = this.maxHpNow();
    this.player.hp = this.player.maxHp;
    this.hpFill = null;
    this.playerView.setHp(1);
    this.refreshStatus();
    if (this.equipPanel.open) this.renderBag();
    this.save();
  }

  // 지금 맵 몬스터를 모두 지우고 처음처럼 다시 생기게
  respawnMonsters() {
    const { removed, born } = this.spawner.reset();
    for (const m of removed) {
      const v = this.monsterViews.get(m.id);
      if (v) v.destroy();
      this.monsterViews.delete(m.id);
    }
    for (const m of born) this.addMonsterView(m);
    return born.length;
  }

  // 그 몬스터 구역을 바로 채움(쥐왕). 반환: 새로 생긴 수, 이 맵에 그 구역이 없으면 -1
  spawnNow(type) {
    if (!this.map.spawnZones.some((z) => z.monster === type)) return -1;
    const born = this.spawner.fill(type);
    for (const m of born) this.addMonsterView(m);
    return born.length;
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
    // 앱 전환 직후 큰 delta로 순간이동하지 않게. 레벨업 멈칫 동안은 느리게
    let dt = Math.min(delta, 50);
    if (this.slowMo) {
      dt *= this.slowMo.scale;
      this.slowMo.left -= delta;
      if (this.slowMo.left <= 0) this.slowMo = null;
    }
    const p = this.cfg.player;
    // 공격: 쿨다운이 끝났고 버튼(스페이스)이 눌려 있으면 주먹
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.punchMs = Math.max(0, this.punchMs - dt);
    // 쿨다운 중에 톡 친 것은 버리지 않고 쿨다운이 끝나면 나감
    // 휘두르는 중에 누른 것도 버리지 않고 끝난 뒤 나감
    this.cooldowns.update(dt);
    this.updateRecovery(dt);
    this.skillFx.update(dt, !!(this.act || this.spin || (this.swing && this.swing.mods)));
    // 관리자 창·무예창이 열려 있으면 게임 입력을 막음(docs/spec/feedback_1020.md 3)
    const modal = !!((this.d.adminPanel && this.d.adminPanel.open) || (this.d.skillPanel && this.d.skillPanel.open));
    const wantAttack = !modal && this.attackCooldown <= 0 && !this.swing && !this.spin && !this.act && this.attackButton.consume();
    if (wantAttack && !this.swing && !this.transitioning && !this.gridOn && !this.dead && !this.equipPanel.open && !this.npcPanel.open) {
      this.attackWithAssist(null);
    }
    const spinPose = this.spin ? this.updateSpin(dt) : null;
    const actPose = this.act ? this.updateAct(dt) : null;
    const swingPose = this.swing ? this.updateSwing(dt) : spinPose || actPose;
    const punching = this.punchMs > 0 || !!swingPose;

    // 주먹 지르는 동안·무예를 하는 동안은 걷지 않음(휘돌려 베기는 도는 동안 천천히 걸을 수 있음)
    if (this.rootMs > 0) this.rootMs -= dt;
    const locked = modal || this.transitioning || (punching && !this.spin) || (this.act && this.act.lockMove) || this.rootMs > 0;
    const v = locked ? { x: 0, y: 0 } : this.d.input.getVector();
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
      if (!this.spin) this.facing = this.dir;
      // 걸음 = 기본 속도 × 장비 걸음 배율(짚신) × 휘돌려 베기 중이면 moveMul
      const speed = p.speed * this.stats().speedMul * (this.spin ? this.spin.sk.moveMul : 1);
      const res = moveStep(this.map.grid, this.pos, this.dir, (speed * dt) / 1000, p.footBox, p.cornerSlide);
      this.pos.x = res.x;
      this.pos.y = res.y;
      this.moving = res.moved;
    }
    this.checkPortal();
    this.updateRecall(dt);
    this.updateDrops(dt);
    for (const fx of this.portalFx) fx.update(this.pos.x, this.pos.y);

    this.playerView.update(dt, this.pos.x, this.pos.y, this.facing, this.moving, swingPose || (this.punchMs > 0 ? 'punch' : null));
    // 물건 조각 뒤로 가려지면 가려진 부분에 윤곽선
    this.ghost.update(this.pos.y);

    // 마을 사람: 레벨에 따라 보이기·오가기(방물장수 — 창이 열려 있으면 멈춤)
    for (const v of this.npcViews) v.update(dt, this.progress.level, this.npcPanel.open);

    // 몬스터
    const target = { x: this.pos.x, y: this.pos.y, alive: !this.dead && !this.transitioning };
    const { born, bites, gone } = this.spawner.update(dt, target);
    for (const m of born) this.addMonsterView(m);
    for (const b of bites) this.onBitten(b);
    // 포기해 사라진 분신: 연기
    for (const m of gone || []) {
      const v = this.monsterViews.get(m.id);
      if (v) v.vanish();
      this.monsterViews.delete(m.id);
    }
    this.drawShots();
    for (const m of this.spawner.monsters) {
      const view = this.monsterViews.get(m.id);
      if (view) view.update(dt, m);
    }
    this.applyShade();

    // 레벨업 체력바 차오름
    if (this.hpFill) {
      this.hpFill.t += dt;
      if (this.hpFill.t >= this.hpFill.ms || this.player.hp < this.hpFill.from) this.hpFill = null;
      this.playerView.setHp(this.shownHp() / this.player.maxHp);
    }
    // 왼쪽 위 표시·무예 버튼·귀환 단추(바뀐 것만 다시 그림)
    this.hud.setRecall(countItem(this.equip, this.cfg.recall.item), this.recallUsable(), !!this.recall);
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
