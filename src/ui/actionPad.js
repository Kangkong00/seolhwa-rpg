// 오른쪽 아래 공격·무예 단추 배치(docs/spec/feedback_1023.md 6). data/game.json actionPad.
// layout "numpad": 키보드 숫자패드 모양 — 무예 칸 3×3(아래 줄 1·2·3, 위 줄 7·8·9), 오른쪽 끝에 공격(엔터처럼 두 줄 높이), 그 위 「무예창」 칸.
// layout "rows": 예전 배치(공격 동그라미 + 그 위 4칸 줄) — style.css 그대로. 관리자 설정에서 바꿔 비교.
// 누르는 영역은 칸 사이 틈의 가운데까지(서로 겹치지 않게, 10-20 "단추 안 눌림").
import { vibrate } from './press.js';

export class ActionPad {
  // els: { attack, skills, menu }, onMenu(): 무예창 열기
  constructor(els, onMenu) {
    this.els = els;
    this.visible = true;
    this.menuOn = false;
    els.menu.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      vibrate();
      onMenu();
    });
  }

  apply(cfg) {
    const { attack, skills, menu } = this.els;
    const numpad = cfg.layout === 'numpad';
    document.body.classList.toggle('pad-numpad', numpad);
    const btns = [...skills.children];
    const clear = (el) => el.removeAttribute('style');
    if (!numpad) {
      [attack, skills, ...btns].forEach(clear);
      this.menuOn = false;
      menu.hidden = true;
      return;
    }
    const { slot, gap, margin, attackW, attackRows } = cfg;
    const px = (v) => `${v}px`;
    const edge = (side, v) => `calc(env(safe-area-inset-${side}) + ${v}px)`;
    const attackH = attackRows * slot + (attackRows - 1) * gap;
    const cols = 3;
    const rows = Math.ceil(btns.length / cols);
    Object.assign(attack.style, { right: edge('right', margin), bottom: edge('bottom', margin), width: px(attackW), height: px(attackH), borderRadius: '12px' });
    Object.assign(skills.style, {
      right: edge('right', margin + attackW + gap),
      bottom: edge('bottom', margin),
      gridTemplateColumns: `repeat(${cols}, ${slot}px)`,
      gridAutoRows: px(slot),
      gap: px(gap),
    });
    // 숫자패드 순서: i번째 칸(번호 i+1)은 아래 줄부터 왼쪽→오른쪽
    btns.forEach((b, i) => {
      Object.assign(b.style, { width: px(slot), height: px(slot), padding: '0', gridRow: String(rows - Math.floor(i / cols)), gridColumn: String((i % cols) + 1) });
      b.style.setProperty('--half-gap', px(gap / 2));
    });
    this.menuOn = !!cfg.menuCell;
    menu.hidden = !(this.menuOn && this.visible);
    Object.assign(menu.style, { right: edge('right', margin), bottom: edge('bottom', margin + attackH + gap), width: px(attackW), height: px(slot) });
    attack.style.setProperty('--half-gap', px(gap / 2));
    menu.style.setProperty('--half-gap', px(gap / 2));
  }

  // 공격·무예 단추와 함께 숨김(격자 편집·쓰러짐 등)
  setVisible(v) {
    this.visible = v;
    this.els.menu.hidden = !(this.menuOn && v);
  }
}
