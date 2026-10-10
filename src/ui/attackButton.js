// 오른쪽 아래 공격 버튼 (PC는 스페이스). 누르고 있으면 isDown이 계속 true → 공격 간격마다 반복.

export class AttackButton {
  constructor(el) {
    this.el = el;
    this.pointerDown = false;
    this.keyDown = false;
    this.pressedOnce = false; // 짧게 톡 쳐도 한 번은 나가게
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.pointerDown = true;
      this.pressedOnce = true;
      el.classList.add('active');
    });
    const up = () => {
      this.pointerDown = false;
      el.classList.remove('active');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
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
