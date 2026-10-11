// 최소 장비창·가방 (docs/spec/equipment.md). 장비 칸 5개 + 가방 칸 목록.
// 가방 아이템을 누르면 낌, 장비 칸을 누르면 벗음(옷은 벗을 수 없음). 규칙은 src/core/equipment.js.

export class EquipmentPanel {
  // slots: [{ id, name }], itemDefs: { id: def }, onEquip(bagIndex), onUnequip(slot), canUnequip(slot)
  constructor({ slots, itemDefs, onEquip, onUnequip, canUnequip, onClose }) {
    this.slots = slots;
    this.itemDefs = itemDefs;
    this.canUnequip = canUnequip;
    this.el = document.getElementById('equip-panel');
    this.slotRow = this.el.querySelector('.equip-slots');
    this.bagGrid = this.el.querySelector('.equip-bag');
    this.info = this.el.querySelector('.equip-info');
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

  cell(def, label, attrs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'equip-cell';
    for (const [k, v] of Object.entries(attrs)) b.dataset[k] = v;
    if (def) {
      const img = document.createElement('img');
      img.src = def.icon;
      img.alt = '';
      img.draggable = false;
      b.appendChild(img);
    } else {
      b.classList.add('empty');
    }
    const t = document.createElement('span');
    t.textContent = label;
    b.appendChild(t);
    return b;
  }

  // state: { equipped, bag }
  render(state, message = '') {
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
      this.bagGrid.replaceChildren(...state.bag.map((id, i) => this.cell(this.itemDefs[id], this.itemDefs[id].name, { index: String(i) })));
    }
    this.info.textContent = message || '가방 물건을 누르면 끼고, 장비 칸을 누르면 벗습니다';
  }
}
