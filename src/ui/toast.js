// 화면 위쪽 가운데에 잠깐 뜨는 알림. ms 동안 그대로 보였다가 0.6초 동안 흐려짐(src/style.css #toast).
export class Toast {
  constructor(el, holdMs = 1500) {
    this.el = el;
    this.timer = null;
    this.holdMs = holdMs;
  }

  show(text, ms = this.holdMs) {
    this.el.textContent = text;
    this.el.classList.add('show');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.el.classList.remove('show'), ms);
  }
}
