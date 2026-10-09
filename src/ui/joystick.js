// 왼쪽 가상 조이스틱. 왼쪽 영역 아무 곳이나 누르면 그 자리에 생기고,
// 손을 떼면 기본 자리(왼쪽 아래)로 돌아감. PC에서는 마우스 드래그로도 동작.

export class Joystick {
  constructor({ zone, base, knob, radius }) {
    this.zone = zone;
    this.base = base;
    this.knob = knob;
    this.radius = radius;
    this.pointerId = null;
    this.origin = { x: 0, y: 0 };
    this.vector = { x: 0, y: 0 };

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    zone.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('resize', () => this.placeHome());
    this.placeHome();
  }

  // 손을 떼고 있을 때 보이는 기본 자리
  placeHome() {
    if (this.pointerId !== null) return;
    const rect = this.zone.getBoundingClientRect();
    this.setBase(rect.left + 40 + this.radius, rect.bottom - 30 - this.radius);
  }

  setBase(x, y) {
    this.origin.x = x;
    this.origin.y = y;
    this.base.style.left = `${x}px`;
    this.base.style.top = `${y}px`;
    this.setKnob(0, 0);
  }

  setKnob(dx, dy) {
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  onDown(e) {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.base.classList.add('active');
    this.setBase(e.clientX, e.clientY);
    this.update(e.clientX, e.clientY);
  }

  onMove(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.update(e.clientX, e.clientY);
  }

  onUp(e) {
    if (e.pointerId !== this.pointerId) return;
    this.release();
  }

  release() {
    this.pointerId = null;
    this.vector.x = 0;
    this.vector.y = 0;
    this.base.classList.remove('active');
    this.placeHome();
  }

  update(px, py) {
    let dx = px - this.origin.x;
    let dy = py - this.origin.y;
    const len = Math.hypot(dx, dy);
    if (len > this.radius) {
      // 손가락이 많이 벗어나면 받침이 따라와서, 방향을 바꾸기 쉽게 함
      const over = len - this.radius;
      this.origin.x += (dx / len) * over;
      this.origin.y += (dy / len) * over;
      this.base.style.left = `${this.origin.x}px`;
      this.base.style.top = `${this.origin.y}px`;
      dx = (dx / len) * this.radius;
      dy = (dy / len) * this.radius;
    }
    this.setKnob(dx, dy);
    this.vector.x = dx / this.radius;
    this.vector.y = dy / this.radius;
  }

  setEnabled(enabled) {
    this.zone.classList.toggle('disabled', !enabled);
    if (!enabled && this.pointerId !== null) this.release();
  }
}
