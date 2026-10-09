// 조이스틱과 키보드(PC: 방향키 / WASD)를 하나의 입력 값으로 합침.

const KEY_VECTORS = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

export class MoveInput {
  constructor(joystick) {
    this.joystick = joystick;
    this.pressed = []; // 나중에 누른 키가 우선
    window.addEventListener('keydown', (e) => {
      if (!KEY_VECTORS[e.code] || e.target instanceof HTMLInputElement) return;
      e.preventDefault();
      if (!this.pressed.includes(e.code)) this.pressed.push(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.pressed = this.pressed.filter((c) => c !== e.code);
    });
    window.addEventListener('blur', () => {
      this.pressed = [];
    });
  }

  // { x, y } (-1 ~ 1)
  getVector() {
    if (this.pressed.length) {
      const [x, y] = KEY_VECTORS[this.pressed[this.pressed.length - 1]];
      return { x, y };
    }
    return { x: this.joystick.vector.x, y: this.joystick.vector.y };
  }
}
