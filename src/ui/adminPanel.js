// 관리자 창(docs/spec/admin_mode.md): 나 · 물건 · 맵 · 설정 탭.
// 시험을 빠르게 하려고 원하는 상태로 바로 건너뜀. 규칙은 src/core의 보통 함수만 부름(관리자 전용 규칙 없음 —
// MMO 때는 서버 명령으로 바꾸면 됨). 안 죽기·한 방은 저장하지 않음(scene.d.admin).
// getScene() = 지금 MapScene(맵을 옮기면 장면이 바뀌므로 매번 물어봄)
import { addItem, addCoins, equipFromBag } from '../core/equipment.js';
import { maxLevel } from '../core/progress.js';
import { grantSkill } from '../core/skills.js';
import { resetQuests } from '../core/quests.js';
import { clearSave, listGridEdits, clearAllGridEdits } from '../save/localSave.js';
import { itemIcon } from './itemIcon.js';
import { josa } from './josa.js';

const TABS = [
  { id: 'me', label: '나' },
  { id: 'items', label: '물건' },
  { id: 'maps', label: '맵' },
  { id: 'settings', label: '설정' },
];

// 물건 탭 묶음(순서대로)
const GROUPS = [
  { label: '무기', test: (d) => d.slot === 'weapon' },
  { label: '옷', test: (d) => d.slot === 'outfit' },
  { label: '머리·팔·발', test: (d) => d.slot === 'head' || d.slot === 'arms' || d.slot === 'feet' },
  { label: '먹을거리·쓰는 것', test: (d) => !d.slot && !!d.use },
  { label: '전리품', test: (d) => !d.slot && !d.use },
];

function el(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class AdminPanel {
  constructor(root, getScene) {
    this.root = root;
    this.getScene = getScene;
    this.tab = 'me';
    this.open = false;
    this.confirmClear = 0; // 저장 지우기 두 번 확인
    this.box = el('div', 'ad-box');
    root.appendChild(this.box);
    // 창 바깥(어두운 곳)을 누르면 닫힘. 게임 화면 터치로 이어지지 않게
    root.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.target === root) this.close();
    });
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    // 휠·터치가 게임으로 새지 않게(목록은 창 안에서만 넘어감)
    for (const ev of ['wheel', 'touchstart', 'touchmove']) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }

  get s() {
    return this.getScene();
  }

  get cfg() {
    return this.s.cfg.admin || {};
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    const s = this.s;
    if (!s || !s.pos) return;
    if (s.gridOn) s.setGridMode(false);
    if (s.equipPanel.open) s.setBagOpen(false);
    if (s.npcPanel.open) s.setNpcOpen(false);
    if (s.d.skillPanel && s.d.skillPanel.open) s.d.skillPanel.close();
    s.itemInfo.hide();
    this.open = true;
    this.confirmClear = 0;
    this.root.hidden = false;
    s.setControlsVisible(false);
    s.hud.setAdminOn(true);
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    const s = this.s;
    if (s && s.hud) {
      s.hud.setAdminOn(false);
      if (!s.gridOn && !s.npcPanel.open && !s.equipPanel.open) s.setControlsVisible(true);
    }
  }

  // 아래쪽 한 줄 알림(창 안)
  note(text) {
    this.message = text;
    this.render();
  }

  render() {
    if (!this.open) return;
    const keepScroll = this.lastTab === this.tab ? this.body && this.body.scrollTop : 0;
    this.box.replaceChildren();
    const head = el('div', 'ad-head');
    head.appendChild(el('div', 'ad-title', '관리자'));
    const tabs = el('div', 'ad-tabs');
    for (const t of TABS) {
      const b = this.btn(t.label, () => {
        this.tab = t.id;
        this.message = '';
        this.confirmClear = 0;
        this.confirmEmpty = false;
        this.render();
      });
      if (t.id === this.tab) b.classList.add('on');
      tabs.appendChild(b);
    }
    head.appendChild(tabs);
    head.appendChild(this.btn('닫기', () => this.close()));
    this.box.appendChild(head);
    this.body = el('div', 'ad-body');
    this[this.tab](this.body);
    this.box.appendChild(this.body);
    if (this.message) this.box.appendChild(el('div', 'ad-msg', this.message));
    this.body.scrollTop = keepScroll || 0;
    this.lastTab = this.tab;
  }

  btn(label, onClick, cls = '') {
    const b = el('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  row(label, ...children) {
    const r = el('div', 'ad-row');
    r.appendChild(el('span', 'ad-label', label));
    const right = el('div', 'ad-ctrl');
    children.forEach((c) => right.appendChild(c));
    r.appendChild(right);
    return r;
  }

  toggleBtn(on, onClick) {
    return this.btn(on ? '켬' : '끔', onClick, on ? 'ad-toggle on' : 'ad-toggle');
  }

  // ---------- 나 ----------
  me(body) {
    const s = this.s;
    const lv = s.progress.level;
    const top = maxLevel(s.d.economy.levels);
    const setLv = (n) => {
      s.setLevelNow(n);
      this.note(`레벨 ${s.progress.level}`);
    };
    const minus = this.btn('−', () => setLv(lv - 1));
    const plus = this.btn('+', () => setLv(lv + 1));
    minus.disabled = lv <= 1;
    plus.disabled = lv >= top;
    body.appendChild(this.row('레벨', minus, el('span', 'ad-value', `Lv ${lv}`), plus));
    const exp = (n) => {
      s.gainExp(n);
      s.refreshStatus();
      s.save();
      this.note(`경험치 +${n}`);
    };
    body.appendChild(this.row('경험치', this.btn('+100', () => exp(100)), this.btn('+1000', () => exp(1000))));
    const coins = (n) => {
      addCoins(s.equip, n);
      s.refreshStatus();
      if (s.equipPanel.open) s.renderBag();
      s.save();
      this.note(`엽전 +${s.coinsText(n)} (가진 엽전 ${s.coinsText(s.equip.coins)})`);
    };
    const nyang = s.d.economy.money.nyang;
    body.appendChild(this.row(`엽전 (${s.coinsText(s.equip.coins)})`, this.btn('+1냥', () => coins(nyang)), this.btn('+10냥', () => coins(nyang * 10))));
    body.appendChild(this.row(`체력 (${s.player.hp}/${s.player.maxHp})`, this.btn('가득', () => {
      s.healPlayer(s.player.maxHp);
      this.note('체력 가득');
    })));
    const flag = (key, label) => this.row(label, this.toggleBtn(s.d.admin[key], () => {
      s.d.admin[key] = !s.d.admin[key];
      if (key === 'noCooldown' && s.d.admin.noCooldown) s.cooldowns.left = {};
      s.hud.setAdminWarn(s.d.admin.noDie || s.d.admin.oneHit || s.d.admin.noCooldown);
      this.note(`${label} ${s.d.admin[key] ? '켬' : '끔'} (저장 안 됨, 다시 열면 꺼짐)`);
    }));
    body.appendChild(flag('noDie', '안 죽기'));
    body.appendChild(flag('oneHit', '한 방'));
    body.appendChild(flag('noCooldown', '무예 기다림 없음'));
    const left = s.skills.filter((sk) => !s.learned.includes(sk.id)).length;
    const learnAll = this.btn(left ? `모두 배우기 (${left})` : '모두 배움', () => {
      let n = 0;
      for (const sk of s.skills) if (grantSkill(sk, s.learned)) n++;
      fill(0); // 배운 액티브 1~8번째로 칸을 채움
      s.refreshAfterPassive();
      s.refreshSkills();
      s.save();
      this.note(`무예 ${n}개를 배웠습니다`);
    });
    learnAll.disabled = !left;
    body.appendChild(this.row('무예', learnAll));
    // 액티브가 칸보다 많아 시험하기 쉽게: 배운 액티브를 from번째부터 순서대로 칸에 넣고 남는 칸은 비움
    const fill = (from) => {
      const act = s.skills.filter((k) => k.type !== 'passive' && s.learned.includes(k.id)).map((k) => k.id).slice(from, from + s.skillSlots.length);
      for (let i = 0; i < s.skillSlots.length; i++) s.skillSlots[i] = act[i] || null;
      s.refreshSkills();
      s.save();
      return act.length;
    };
    const n = s.skillSlots.length;
    const total = s.skills.filter((k) => k.type !== 'passive').length;
    body.appendChild(this.row('무예 칸',
      this.btn(`칸 채우기 1~${n}`, () => this.note(`배운 액티브 ${fill(0)}개를 칸에 넣었습니다`)),
      this.btn(`칸 채우기 ${n + 1}~${total}`, () => this.note(`배운 액티브 ${fill(n)}개를 칸에 넣었습니다`))));
  }

  // ---------- 물건 ----------
  items(body) {
    const s = this.s;
    // 수량: 1 · 10 · 100(기본 1, 장비는 늘 1개) — 길게 누르기는 뺌(스크롤하다 10개씩 들어가던 것)
    this.qty = this.qty || 1;
    const qrow = el('div', 'ad-row ad-qty');
    qrow.appendChild(el('span', 'ad-label', '한 번에'));
    const qctl = el('div', 'ad-ctrl');
    for (const n of [1, 10, 100]) {
      const b = this.btn(`${n}개`, () => { this.qty = n; this.render(); }, n === this.qty ? 'on' : '');
      qctl.appendChild(b);
    }
    qrow.appendChild(qctl);
    body.appendChild(qrow);
    // 가방 비우기(낀 것은 그대로) — 두 번 눌러 확인
    const emptyLabel = this.confirmEmpty ? '정말 비울까요? 한 번 더' : '가방 비우기';
    body.appendChild(this.row('가방', this.btn(emptyLabel, () => {
      if (!this.confirmEmpty) {
        this.confirmEmpty = true;
        return this.render();
      }
      this.confirmEmpty = false;
      const n = s.equip.bag.length;
      s.equip.bag = [];
      if (s.equipPanel.open) s.renderBag();
      s.save();
      this.note(`가방을 비웠습니다(${n}칸, 낀 것은 그대로)`);
    }, this.confirmEmpty ? 'ad-danger on' : 'ad-danger')));
    body.appendChild(el('div', 'ad-help', '누르면 고른 수량만큼 가방에. 장비는 1개씩. "끼기"는 레벨 제한 없이 바로 낌.'));
    const defs = s.d.items.items;
    for (const g of GROUPS) {
      const list = defs.filter(g.test);
      if (!list.length) continue;
      body.appendChild(el('div', 'ad-group', g.label));
      const grid = el('div', 'ad-items');
      for (const def of list) grid.appendChild(this.itemCell(def));
      body.appendChild(grid);
    }
  }

  itemCell(def) {
    const s = this.s;
    const cell = el('div', 'ad-item');
    const give = el('button', 'ad-give');
    give.type = 'button';
    give.appendChild(itemIcon(def));
    give.appendChild(el('span', 'ad-item-name', def.name));
    give.addEventListener('click', () => this.give(def, def.slot ? 1 : this.qty || 1));
    cell.appendChild(give);
    if (def.slot) {
      const worn = s.equip.equipped[def.slot] === def.id;
      const wear = this.btn(worn ? '낌' : '끼기', () => this.wear(def), 'ad-wear');
      wear.disabled = worn;
      cell.appendChild(wear);
    }
    return cell;
  }

  give(def, n) {
    const s = this.s;
    addItem(s.equip, s.itemDefs, def.id, n);
    if (s.equipPanel.open) s.renderBag();
    s.refreshStatus();
    s.save();
    this.note(`${def.name} ${n}개를 가방에 넣었습니다`);
  }

  // 가방에 하나 넣고 레벨 제한 없이 바로 낌(벗은 것은 가방으로)
  wear(def) {
    const s = this.s;
    if (s.swing || s.spin) return this.note('휘두르는 중에는 바꿀 수 없습니다');
    addItem(s.equip, s.itemDefs, def.id, 1);
    let index = -1;
    s.equip.bag.forEach((e, i) => {
      if (e.id === def.id) index = i;
    });
    const slot = equipFromBag(s.equip, s.itemDefs, index, Infinity);
    if (!slot) return this.note(`${def.name}: 낄 수 없습니다`);
    s.afterEquipChange(slot);
    this.note(`${josa(def.name, '을', '를')} 꼈습니다`);
  }

  // ---------- 맵 ----------
  maps(body) {
    const s = this.s;
    const go = (id) => {
      this.close();
      s.d.fetchMap(id).then((json) => {
        const sp = json.spawn || {};
        this.s.travel(id, { x: sp.x, y: sp.y, facing: 'down' });
      });
    };
    for (const m of this.cfg.maps || []) {
      const here = m.id === s.d.mapId;
      const b = this.btn(here ? `${m.name} (지금 여기)` : m.name, () => go(m.id), 'ad-wide');
      body.appendChild(b);
    }
    body.appendChild(el('div', 'ad-group', '지금 맵'));
    body.appendChild(this.row('몬스터', this.btn('모두 다시 생기게', () => {
      const n = s.respawnMonsters();
      this.note(n ? `몬스터 ${n}마리가 다시 생겼습니다` : '이 맵에는 몬스터가 없습니다');
    })));
    // 우두머리(쥐왕·늙은 구렁이) 바로 생기게: 이 맵에 그 자리가 없으면 그 우두머리 굴로(들어가면 바로 있음)
    for (const b of this.cfg.bosses || []) {
      const bossName = (s.monsterDefs[b.monster] || {}).name || b.monster;
      body.appendChild(this.row(bossName, this.btn('바로 생기게', () => {
        const n = s.spawnNow(b.monster);
        if (n > 0) this.note(`${josa(bossName, '이', '가')} 나타났습니다`);
        else if (n === 0) this.note(`${josa(bossName, '은', '는')} 이미 있습니다`);
        else if (b.map) go(b.map);
      })));
    }
  }

  // ---------- 설정 ----------
  settings(body) {
    const s = this.s;
    const b = s.cfg.testBoost;
    if (b) {
      body.appendChild(el('div', 'ad-group', '시험 배율 (이번 실행에만, 다시 열면 data/game.json 값)'));
      body.appendChild(this.row('켜기', this.toggleBtn(b.enabled, () => {
        b.enabled = !b.enabled;
        s.refreshStatus();
        this.note(`시험 배율 ${b.enabled ? '켬' : '끔'}`);
      })));
      const stepper = (key, label, step, min, max) => {
        const set = (v) => {
          b[key] = Math.round(Math.max(min, Math.min(max, v)) * 10) / 10;
          s.refreshStatus();
          this.render();
        };
        const minus = this.btn('−', () => set(b[key] - step));
        const plus = this.btn('+', () => set(b[key] + step));
        minus.disabled = b[key] <= min;
        plus.disabled = b[key] >= max;
        return this.row(label, minus, el('span', 'ad-value', `×${b[key]}`), plus);
      };
      body.appendChild(stepper('exp', '경험치', 1, 1, 10));
      body.appendChild(stepper('coins', '엽전', 1, 1, 10));
      body.appendChild(stepper('dropChance', '전리품 확률', 0.5, 1, 5));
    }
    body.appendChild(el('div', 'ad-group', '화면'));
    // 빛 번짐(docs/spec/feedback_1021.md 추가 수정): 이번 실행만. 기본은 fxCommon.bloom, 아이폰·사파리는 자동으로 끔
    const fx = s.skillFx;
    body.appendChild(this.row('빛 번짐 (무예)', this.toggleBtn(fx.bloomWanted, () => {
      s.d.admin.bloom = !fx.bloomWanted;
      this.note(`빛 번짐 ${s.d.admin.bloom ? '켬 — 화면이 검게 되면 끄세요' : '끔'} (저장 안 됨)`);
    })));
    body.appendChild(el('div', 'ad-group', '기타'));
    body.appendChild(this.row('의뢰', this.btn('처음부터', () => {
      resetQuests(s.quests);
      s.save();
      this.note('의뢰를 모두 처음으로 돌렸습니다');
    })));
    body.appendChild(this.row('격자 편집', this.btn('열기', () => {
      this.close();
      s.setGridMode(true);
    })));
    // 이 기기에 남은 격자 편집(docs/spec/feedback_1023.md 2): 저장소 격자 대신 쓰일 수 있어 맵 이름을 보이고 모두 지움
    const edits = listGridEdits();
    const names = edits.map((id) => (s.d.game.admin && (s.d.game.admin.maps || []).find((m) => m.id === id) || {}).name || id);
    const wipe = this.btn('모두 지우기', () => {
      const n = clearAllGridEdits();
      s.map.grid = s.loadMap().grid; // 지금 맵도 저장소 격자로
      if (s.overlay && s.gridOn) s.overlay.draw(s.map.grid, s.map);
      this.note(`격자 편집 ${n}개를 지웠습니다(저장소 격자 사용)`);
      this.render();
    });
    wipe.disabled = !edits.length;
    body.appendChild(this.row(`이 기기 격자 편집 (${edits.length ? names.join(', ') : '없음'})`, wipe));
    const labels = ['저장 지우고 새로 시작', '정말 지울까요? 한 번 더', '마지막: 누르면 지웁니다'];
    // 두 번 확인한 뒤(세 번째 누름) 지우고 다시 불러옴. 그동안 자동 저장이 다시 쓰지 않게 noSave
    const clear = this.btn(labels[this.confirmClear], () => {
      if (this.confirmClear < 2) {
        this.confirmClear += 1;
        return this.render();
      }
      s.d.noSave = true;
      clearSave();
      window.location.reload();
    }, this.confirmClear ? 'ad-danger on' : 'ad-danger');
    body.appendChild(this.row('저장', clear));
  }
}
