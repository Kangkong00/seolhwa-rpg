// 4방향 이동과 충돌 처리. 화면 코드를 참조하지 않음.

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// 조이스틱 값(-1~1)을 4방향 중 하나로 바꿈.
// 대각선 근처에서 방향이 깜빡이지 않도록, 지금 방향을 조금 더 우대함.
export function dirFromVector(vx, vy, deadZone, currentDir = null, stickiness = 0.15) {
  const ax = Math.abs(vx);
  const ay = Math.abs(vy);
  if (Math.hypot(vx, vy) < deadZone) return null;

  let horizontal = ax > ay;
  if (currentDir) {
    const curIsH = currentDir === 'left' || currentDir === 'right';
    if (curIsH && ay < ax + stickiness) horizontal = true;
    if (!curIsH && ax < ay + stickiness) horizontal = false;
  }
  if (horizontal) return vx < 0 ? 'left' : 'right';
  return vy < 0 ? 'up' : 'down';
}

// 발 위치(x, y)를 기준으로 한 충돌 상자
function footBlocked(grid, x, y, box) {
  const hw = box.w / 2;
  return grid.isBoxBlocked(x - hw, y - box.h, x + hw, y);
}

export function isStandable(grid, x, y, box) {
  return !footBlocked(grid, x, y, box);
}

// 한 방향으로 distance만큼 이동. 막히면 그 앞에서 멈추고,
// 모서리에 살짝 걸린 경우 옆으로 비켜 줌(cornerSlide 픽셀 이내).
// 반환: { x, y, moved }
export function moveStep(grid, pos, dir, distance, box, cornerSlide = 0) {
  const d = DIRS[dir];
  if (!d || distance <= 0) return { x: pos.x, y: pos.y, moved: false };

  let x = pos.x;
  let y = pos.y;
  let remaining = distance;
  let moved = false;
  const STEP = 1; // 1픽셀씩 나눠서 검사 (빠르게 움직여도 벽을 통과하지 않음)

  while (remaining > 0) {
    const s = Math.min(STEP, remaining);
    const nx = x + d.x * s;
    const ny = y + d.y * s;
    if (!footBlocked(grid, nx, ny, box)) {
      x = nx;
      y = ny;
      remaining -= s;
      moved = true;
      continue;
    }

    // 막힘 → 옆으로 조금 비키면 지나갈 수 있는지 확인
    const slide = findSlide(grid, x, y, d, box, cornerSlide);
    if (slide === 0) break;
    const px = d.y !== 0 ? Math.sign(slide) * s : 0;
    const py = d.x !== 0 ? Math.sign(slide) * s : 0;
    if (footBlocked(grid, x + px, y + py, box)) break;
    x += px;
    y += py;
    remaining -= s;
    moved = true;
  }
  return { x, y, moved };
}

// 진행 방향과 수직으로 ±1..maxSlide 픽셀 옮겼을 때 앞으로 갈 수 있으면 그쪽 부호를 돌려줌
function findSlide(grid, x, y, d, box, maxSlide) {
  for (let off = 1; off <= maxSlide; off++) {
    for (const sign of [-1, 1]) {
      const ox = d.y !== 0 ? sign * off : 0;
      const oy = d.x !== 0 ? sign * off : 0;
      if (!footBlocked(grid, x + ox, y + oy, box) && !footBlocked(grid, x + ox + d.x, y + oy + d.y, box)) {
        return sign;
      }
    }
  }
  return 0;
}

// 막힌 곳에 서 있으면 가장 가까운 빈 곳을 찾음 (저장 위치가 격자 수정으로 막힌 경우 등)
export function nearestStandable(grid, x, y, box, maxRadius = 200) {
  if (isStandable(grid, x, y, box)) return { x, y };
  const step = grid.cellSize / 2;
  for (let r = step; r <= maxRadius; r += step) {
    for (let a = 0; a < 16; a++) {
      const t = (a / 16) * Math.PI * 2;
      const nx = x + Math.cos(t) * r;
      const ny = y + Math.sin(t) * r;
      if (isStandable(grid, nx, ny, box)) return { x: nx, y: ny };
    }
  }
  return null;
}
