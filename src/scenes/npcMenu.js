// 사람(NPC) 창의 내용: 처음 인사 → 사기 · 팔기 · 무예 배우기 · 대화(의뢰).
// 규칙은 src/core(shop·skills·quests), 그리기는 src/ui/npcPanel.js. scene은 MapScene.
import { buyFromShop, sellToShop, shopBuysItem, goodsPrice, maxAffordable } from '../core/shop.js';
import { levelOk } from '../core/stats.js';
import { canLearn, learnSkill } from '../core/skills.js';
import { questStage, acceptQuest, turnInQuest } from '../core/quests.js';
import { countItem } from '../core/equipment.js';
import { itemIcon, charIcon } from '../ui/itemIcon.js';
import { josa } from '../ui/josa.js';
import { openItemInfo } from './itemInfoView.js';

const MENU_LABEL = { buy: '사기', sell: '팔기', learn: '무예 배우기', talk: '대화' };

export class NpcMenu {
  constructor(scene) {
    this.s = scene;
    this.npc = null;
    this.lineIndex = {};
  }

  get panel() {
    return this.s.npcPanel;
  }

  coins(v) {
    return this.s.coinsText(v);
  }

  open(npc) {
    this.npc = npc;
    this.home(npc.greeting);
  }

  close() {
    this.npc = null;
    this.s.setNpcOpen(false);
  }

  // 사고팔거나 배운 뒤: 저장 + 위쪽 표시 갱신
  changed() {
    this.s.refreshStatus();
    this.s.save();
  }

  menuActions() {
    return this.npc.menu.map((m) => ({ label: MENU_LABEL[m], onClick: () => this[m]() }));
  }

  home(text) {
    this.panel.render({ title: this.npc.name, text, actions: this.menuActions(), onClose: () => this.close() });
  }

  back(extra = []) {
    return [...extra, { label: '돌아가기', onClick: () => this.home(this.npc.greeting) }];
  }

  // ---------- 사기 ----------
  buy(message = '') {
    const { itemDefs, equip } = this.s;
    const goods = (this.npc.shop && this.npc.shop.sells) || [];
    this.panel.render({
      title: `${this.npc.name} · 사기`,
      text: message || `가진 엽전: ${this.coins(equip.coins)}`,
      list: goods.map((g) => {
        const def = itemDefs[g.id];
        const price = goodsPrice(g, def);
        // 레벨이 모자라도 사기는 막지 않음(미리 사 둘 수 있게, 임시) — 빨강으로 알림만
        const lvWarn = def.level && !levelOk(def, this.s.progress.level) ? `레벨 ${def.level}부터` : '';
        return {
          icon: itemIcon(def),
          label: def.name,
          sub: lvWarn || this.useText(def),
          subWarn: !!lvWarn,
          right: this.priceText(price),
          disabled: maxAffordable(equip, price) < 1,
          onClick: () => openItemInfo(this.s, g.id, { type: 'buy', price: this.priceText(price), onBuy: () => this.buyCount(g, def) }),
        };
      }),
      empty: '지금은 파는 물건이 없습니다',
      actions: this.back(),
      onClose: () => this.close(),
    });
  }

  useText(def) {
    if (!def.use) return '';
    if (def.use.healFull) return '체력 전부 회복';
    if (def.use.heal) return `체력 ${def.use.heal} 회복`;
    return '';
  }

  // 값 글자: "2냥 + 쥐가죽 5"
  priceText(price) {
    const parts = [];
    if (price.coins || !Object.keys(price.items).length) parts.push(this.coins(price.coins));
    for (const [id, n] of Object.entries(price.items)) parts.push(`${this.s.itemDefs[id] ? this.s.itemDefs[id].name : id} ${n}`);
    return parts.join(' + ');
  }

  // 재료 값이 있으면 가진 재료도 함께 보여 줌
  haveText(price) {
    const parts = [`가진 엽전 ${this.coins(this.s.equip.coins)}`];
    for (const id of Object.keys(price.items)) parts.push(`${this.s.itemDefs[id] ? this.s.itemDefs[id].name : id} ${countItem(this.s.equip, id)}`);
    return parts.join(', ');
  }

  priceTimes(price, n) {
    const items = {};
    for (const [id, k] of Object.entries(price.items)) items[id] = k * n;
    return { coins: price.coins * n, items };
  }

  buyCount(g, def) {
    const price = goodsPrice(g, def);
    const max = maxAffordable(this.s.equip, price);
    if (max < 1) return this.buy(Object.keys(price.items).length ? `모자랍니다 (${this.haveText(price)})` : '엽전이 모자랍니다');
    this.panel.render({
      title: `${this.npc.name} · 사기`,
      text: `${def.name} 몇 개 살까요? (하나에 ${this.priceText(price)}, ${this.haveText(price)})`,
      count: {
        max,
        value: 1,
        label: (n) => `${n}개 사기 · ${this.priceText(this.priceTimes(price, n))}`,
        onConfirm: (n) => {
          const r = buyFromShop(this.s.equip, this.s.itemDefs, this.npc.shop, g.id, n);
          if (r.ok) {
            this.s.sfx.play('coin');
            this.changed();
            this.buy(`${def.name} ${n}개를 샀습니다 (−${this.priceText({ coins: r.cost, items: r.items })})`);
          } else {
            this.buy(r.reason);
          }
        },
      },
      actions: [{ label: '돌아가기', onClick: () => this.buy() }],
      onClose: () => this.close(),
    });
  }

  // ---------- 팔기 ----------
  sell(message = '') {
    const { itemDefs, equip } = this.s;
    const shop = this.npc.shop;
    const ids = [...new Set(equip.bag.map((e) => e.id))].filter((id) => shopBuysItem(shop, id, itemDefs[id]));
    const wants = (shop.buys || []).map((id) => itemDefs[id] && itemDefs[id].name).filter(Boolean).join(', ');
    this.panel.render({
      title: `${this.npc.name} · 팔기`,
      text: message || `${josa(wants, '을', '를')} 사 줍니다. 가진 엽전: ${this.coins(equip.coins)}`,
      list: ids.map((id) => {
        const def = itemDefs[id];
        const n = countItem(equip, id);
        return {
          icon: itemIcon(def),
          label: `${def.name} ×${n}`,
          sub: `하나에 ${this.coins(def.sellPrice || 0)}`,
          onClick: () => openItemInfo(this.s, id, { type: 'sell', onSell: () => this.sellCount(id, def, n) }),
        };
      }),
      empty: '이 가게가 사 줄 물건이 가방에 없습니다',
      actions: this.back(),
      onClose: () => this.close(),
    });
  }

  sellCount(id, def, have) {
    this.panel.render({
      title: `${this.npc.name} · 팔기`,
      text: `${def.name} 몇 개 팔까요? (가진 것 ${have}개, 하나에 ${this.coins(def.sellPrice || 0)})`,
      count: {
        max: have,
        value: have,
        label: (n) => `${n}개 팔기 · ${this.coins((def.sellPrice || 0) * n)}`,
        onConfirm: (n) => {
          const r = sellToShop(this.s.equip, this.s.itemDefs, this.npc.shop, id, n);
          if (r.ok) {
            this.s.sfx.play('coin');
            this.changed();
            this.sell(`${def.name} ${n}개를 팔았습니다 (+${this.coins(r.coins)})`);
          } else {
            this.sell(r.reason);
          }
        },
      },
      actions: [{ label: '돌아가기', onClick: () => this.sell() }],
      onClose: () => this.close(),
    });
  }

  // ---------- 무예 배우기 ----------
  costText(skill) {
    const parts = [];
    const c = skill.cost || {};
    if (c.coins) parts.push(this.coins(c.coins));
    for (const [id, n] of Object.entries(c.items || {})) parts.push(`${this.s.itemDefs[id] ? this.s.itemDefs[id].name : id} ${n}`);
    return parts.join(' + ');
  }

  learn(message = '') {
    const { skills, progress, equip, learned, itemDefs } = this.s;
    this.panel.render({
      title: `${this.npc.name} · 무예 배우기`,
      text: message || '무예는 엽전과, 몸으로 구해 온 것을 내고 배우는 걸세.',
      list: skills.map((sk) => {
        const known = learned.includes(sk.id);
        const c = canLearn(sk, progress, equip, learned, itemDefs, this.s.treeOpts());
        const req = `레벨 ${(sk.requires && sk.requires.level) || 1} · ${this.costText(sk)}`;
        return {
          icon: sk.image ? itemIcon({ icon: sk.image, name: sk.icon, iconText: sk.icon }) : charIcon(sk.icon),
          label: sk.name,
          sub: known ? `배움${sk.type === 'passive' ? ' · 패시브' : ''} · ${sk.desc}` : c.ok ? `${req} · 배울 수 있음` : `${req} · 모자람: ${c.reasons.join(', ')}`,
          right: known ? '배움' : '',
          disabled: known || !c.ok,
          onClick: () => {
            const r = learnSkill(sk, progress, equip, learned, itemDefs, this.s.treeOpts());
            if (!r.ok) return this.learn(r.reasons.join(', '));
            this.s.sfx.play('learn');
            this.s.autoSlotSkill(sk.id); // 빈 무예 칸이 있으면 바로 넣음
            this.changed();
            this.s.refreshSkills();
            if (sk.type === 'passive') {
              this.s.refreshAfterPassive();
              this.learn(`${josa(sk.name, '을', '를')} 익혔네! ${sk.desc}. 몸에 배어 늘 켜져 있을 걸세.`);
            } else {
              this.learn(`${josa(sk.name, '을', '를')} 익혔네! ${sk.desc}. 공격 버튼 옆 무예 칸으로 쓰게(칸은 위쪽 '무예'에서 고름).`);
            }
          },
        };
      }),
      actions: this.back(),
      onClose: () => this.close(),
    });
  }

  // ---------- 대화 (의뢰가 있으면 의뢰) ----------
  talk() {
    const q = this.npc.quest && this.s.questDefs[this.npc.quest];
    if (q) return this.questTalk(q);
    const lines = this.npc.lines || [];
    const i = this.lineIndex[this.npc.id] || 0;
    this.lineIndex[this.npc.id] = i + 1;
    this.panel.render({
      title: this.npc.name,
      text: lines.length ? lines[i % lines.length] : this.npc.greeting,
      actions: this.back([{ label: '더 듣기', onClick: () => this.talk(), primary: true }]),
      onClose: () => this.close(),
    });
  }

  questTalk(q, notice = '') {
    const { equip, itemDefs, quests } = this.s;
    const stage = questStage(q, quests, equip);
    const needId = Object.keys(q.need || {})[0];
    const fill = (t) => t.replace('{have}', String(needId ? countItem(equip, needId) : 0)).replace('{need}', String(needId ? q.need[needId] : 0));
    const view = { title: this.npc.name, onClose: () => this.close() };
    if (stage === 'offer') {
      view.text = q.offer;
      view.actions = this.back([{
        label: q.accept,
        primary: true,
        onClick: () => {
          acceptQuest(q, quests);
          this.changed();
          this.questTalk(q);
        },
      }]);
    } else if (stage === 'progress') {
      view.text = fill(q.progress);
      view.actions = this.back();
    } else if (stage === 'ready') {
      view.text = fill(q.progress);
      view.actions = this.back([{
        label: q.turnIn,
        primary: true,
        onClick: () => {
          const r = turnInQuest(q, quests, equip, itemDefs, this.s.cfg.testBoost);
          if (!r) return this.questTalk(q);
          this.s.sfx.play('learn');
          if (r.exp) this.s.gainExp(r.exp); // 주인공 머리 위에 "+N 경험"
          this.changed();
          const got = [r.coins ? this.coins(r.coins) : '', r.exp ? `경험치 ${r.exp}` : '', ...Object.entries(r.items || {}).map(([id, n]) => `${itemDefs[id].name} ${n}개`)].filter(Boolean).join(', ');
          this.s.toast.show(`의뢰 「${q.name}」 마침 · ${got}`);
          this.questTalk(q, q.done);
        },
      }]);
    } else {
      view.text = notice || q.after;
      view.actions = this.back();
    }
    this.panel.render(view);
  }
}
