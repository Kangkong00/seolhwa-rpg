// 오른쪽 아래 공격 버튼 (PC는 스페이스). 누르고 있으면 isDown이 계속 true → 공격 간격마다 반복.
// 여러 손가락: 조이스틱을 누른 채 눌러도 됨(포인터마다 따로 셈). 누르는 순간 짧은 진동.
import { vibrate } from './press.js';

export class AttackButton {
  constructor(el) {
    this.el = el;
    this.pointerDown = false;
    this.keyDown = false;
    this.pressedOnce = false; // 짧게 톡 쳐도 한 번은 나가게
    this.pointers = new Set();
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // 손가락이 단추 밖으로 조금 미끄러져도 떼기 전까지 눌린 것으로(포인터 붙잡기)
      try { el.setPointerCapture(e.pointerId); } catch { /* 안 되는 브라우저 */ }
      this.pointers.add(e.pointerId);
      this.pointerDown = true;
      this.pressedOnce = true;
      el.classList.add('active');
      vibrate();
    });
    const up = (e) => {
      if (e && e.pointerId !== undefined) this.pointers.delete(e.pointerId);
      else this.pointers.clear();
      if (this.pointers.size) return;
      this.pointerDown = false;
      el.classList.remove('active');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (!this.keyDown) this.pressedOnce = true;
      this.keyDown = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.keyDown = false;
    });
    window.addEventListener('blur', () => {
      this.keyDown = false;
      up();
    });
  }

  // 이번 프레임에 공격하고 싶은지 (눌려 있거나, 지난 프레임 뒤 한 번이라도 눌렸으면)
  consume() {
    const want = this.pointerDown || this.keyDown || this.pressedOnce;
    this.pressedOnce = false;
    return want;
  }

  setVisible(v) {
    this.el.hidden = !v;
  }
}
