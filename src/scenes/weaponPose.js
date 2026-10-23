// 무기 방향을 3D로 계산해 화면에 투영 (CLAUDE.md "무기"의 계산법 그대로).
// theta: 0 = 칼끝이 위, 90 = 칼끝이 바라보는 쪽(앞), 180 = 아래, 음수 = 머리 뒤.
// lat: 옆으로 기운 정도(대각선 베기).
// 3D 방향: 위 Y = cos θ, 앞 F = sin θ, 옆 X = lat.
// 화면 방향 (sx 오른쪽+, sy 아래+), 깊이 줄임 K:
//   정면(아래를 봄): sx = X,  sy = −Y + K·F,  F < 0 이면 몸 뒤
//   뒷면(위를 봄):   sx = −X, sy = −Y − K·F,  F > 0 이면 몸 뒤
//   옆면(왼쪽을 봄): sx = −F, sy = −Y,        F < 0 이면 몸 뒤 (오른쪽은 sx 반전)
// 반환: { angle: 화면 각도(도, 위에서 시계 방향), length: 세로 길이 비율(최대 1), behind }
export function projectWeapon(facing, thetaDeg, lat, K) {
  const t = (thetaDeg * Math.PI) / 180;
  const Y = Math.cos(t);
  const F = Math.sin(t);
  const X = lat;
  let sx;
  let sy;
  let behind;
  if (facing === 'down') {
    sx = X;
    sy = -Y + K * F;
    behind = F < 0;
  } else if (facing === 'up') {
    sx = -X;
    sy = -Y - K * F;
    behind = F > 0;
  } else {
    sx = -F;
    sy = -Y;
    behind = F < 0;
    if (facing === 'right') sx = -sx;
  }
  const angle = (Math.atan2(sx, -sy) * 180) / Math.PI;
  const length = Math.min(1, Math.hypot(sx, sy));
  return { angle, length, behind };
}

// 휘두르기 진행(0~1, 시간) → theta. 처음엔 느리고 끝으로 갈수록 빠르게(ease 지수) — 예전 방식("ease")
export function swingTheta(swing, progress) {
  const p = Math.max(0, Math.min(1, progress));
  return swing.thetaFrom + (swing.thetaTo - swing.thetaFrom) * Math.pow(p, swing.ease);
}

const EASE = { in: (k) => k * k, linear: (k) => k, out: (k) => 1 - (1 - k) * (1 - k) };

// 휘두르기 진행(0~1) → { pose, theta } (docs/spec/feedback_1023.md 5).
// timing "keys"(기본): 몸 자세가 칼 각도를 이끎 — 지금 시간이 든 key의 자세로, 칼은 그 key의 theta0→theta1 안에서만.
// timing "ease": 예전 방식(칼은 ease 지수로 매끄럽게, 몸은 칼 각도 문턱으로) — pose는 null(PlayerView가 문턱으로 고름)
export function swingPose(swing, progress) {
  const p = Math.max(0, Math.min(1, progress));
  if (swing.timing === 'ease' || !Array.isArray(swing.keys) || !swing.keys.length) return { pose: null, theta: swingTheta(swing, p) };
  const k = swing.keys.find((x) => p < x.t1) || swing.keys[swing.keys.length - 1];
  const u = Math.max(0, Math.min(1, (p - k.t0) / Math.max(1e-6, k.t1 - k.t0)));
  return { pose: k.pose, theta: k.theta0 + (k.theta1 - k.theta0) * (EASE[k.ease] || EASE.linear)(u) };
}
