// 최소 장비창·가방 (docs/spec/equipment.md). 장비 칸 5개 + 가방 칸 목록.
// 가방 아이템을 누르면 낌(먹을 것은 먹음), 장비 칸을 누르면 벗음(옷은 벗을 수 없음). 규칙은 src/core/equipment.js.
// 겹치는 물건은 ×개수, 위쪽에 가진 엽전.
import { itemIcon } from './itemIcon.js';

export class EquipmentPanel {
  // slots: [{ id, name }], itemDefs: { id: def }, onEquip(bagIndex), onUnequip(slot), canUnequip(slot)
  // decorate(el, def): 칸마다 덧붙일 것(PC 마우스 올리면 작은 창)
  constructor({ slots, itemDefs, onEquip, onUnequip, canUnequip, onClose, decorate = () => {} }) {
    this.decorate = decorate;
    this.totals = document.querySelector('#equip-panel .equip-totals');
    this.slots = slots;
    this.itemDefs = itemDefs;
    this.canUnequip = canUnequip;
    this.el = document.getElementById('equip-panel');
    this.slotRow = this.el.querySelector('.equip-slots');
    this.bagGrid = this.el.querySelector('.equip-bag');
    this.info = this.el.querySelector('.equip-info');
    this.bagTitle = this.el.querySelectorAll('.equip-title')[1];
    this.el.querySelector('.equip-close').addEventListener('click', () => onClose());
    // 창을 눌러도 게임 화면 터치로 이어지지 않게
    for (const ev of ['pointerdown', 'touchstart']) this.el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    this.slotRow.addEventListener('click', (e) => {
      const b = e.target.closest('[data-slot]');
      if (b) onUnequip(b.dataset.slot);
    });
    this.bagGrid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-index]');
      if (b) onEquip(Number(b.dataset.index));
    });
  }

  get open() {
    return !this.el.hidden;
  }

  setVisible(on) {
    this.el.hidden = !on;
  }

  cell(def, label, attrs, count = 1) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'equip-cell';
    for (const [k, v] of Object.entries(attrs)) b.dataset[k] = v;
    if (def) {
      b.appendChild(itemIcon(def));
      this.decorate(b, def);
    } else b.classList.add('empty');
    const t = document.createElement('span');
    t.textContent = label;
    b.appendChild(t);
    if (count > 1) {
      const c = document.createElement('span');
      c.className = 'count';
      c.textContent = `×${count}`;
      b.appendChild(c);
    }
    return b;
  }

  // state: { equipped, bag: [{ id, n }], coins }, coinsText: 엽전 표시
  render(state, message = '', coinsText = '', totalsText = '') {
    this.totals.textContent = totalsText;
    this.bagTitle.textContent = coinsText ? `가방 · ${coinsText}` : '가방';
    this.slotRow.replaceChildren(
      ...this.slots.map((s) => {
        const def = this.itemDefs[state.equipped[s.id]];
        const b = this.cell(def, def ? def.name : s.name, { slot: s.id });
        b.title = def ? `${s.name}: ${def.name}` : `${s.name}: 비어 있음`;
        if (def && !this.canUnequip(s.id)) b.classList.add('locked');
        return b;
      }),
    );
    if (state.bag.length === 0) {
      const p = document.createElement('div');
      p.className = 'equip-none';
      p.textContent = '가방이 비어 있습니다';
      this.bagGrid.replaceChildren(p);
    } else {
      this.bagGrid.replaceChildren(...state.bag.map((e, i) => this.cell(this.itemDefs[e.id], this.itemDefs[e.id].name, { index: String(i) }, e.n)));
    }
    this.info.textContent = message || '물건을 누르면 정보창(끼기·벗기·쓰기)이 열립니다';
  }
}
