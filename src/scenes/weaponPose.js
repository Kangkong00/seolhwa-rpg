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

// 휘두르기 진행(0~1, 시간) → theta. 처음엔 느리고 끝으로 갈수록 빠르게(ease 지수)
export function swingTheta(swing, progress) {
  const p = Math.max(0, Math.min(1, progress));
  return swing.thetaFrom + (swing.thetaTo - swing.thetaFrom) * Math.pow(p, swing.ease);
}
