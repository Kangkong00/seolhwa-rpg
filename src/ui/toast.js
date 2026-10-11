// 화면 위쪽 가운데에 잠깐 뜨는 알림.
export class Toast {
  constructor(el) {
    this.el = el;
    this.timer = null;
  }

  show(text, ms = 1800) {
    this.el.textContent = text;
    this.el.classList.add('show');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.remove('show'), ms);
  }
}
