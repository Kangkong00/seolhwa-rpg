// 화면 단추 공통(docs/spec/feedback_1020.md 7): 누르는 순간(pointerdown) 반응, 눌린 모양(.pressed — 0.9배),
// 짧은 진동(되는 기기만), 게임 화면으로 터치가 새지 않게. 손을 떼거나 취소되면 모양만 되돌림.
export function vibrate(ms = 8) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    // 진동이 안 되는 기기는 그냥 넘어감
  }
}

export function onPress(el, handler) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.add('pressed');
    vibrate();
    handler(e);
  });
  const up = () => el.classList.remove('pressed');
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  // 키보드(Enter·Space)로 누른 경우만 click으로 받음(터치·마우스는 pointerdown에서 이미 처리)
  el.addEventListener('click', (e) => {
    if (e.detail === 0) handler(e);
  });
}
