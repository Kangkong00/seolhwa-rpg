// 시작점: 데이터 파일을 읽고 Phaser 게임을 만듦.
import { VillageScene } from './scenes/VillageScene.js';
import { Joystick } from './ui/joystick.js';
import { MoveInput } from './ui/input.js';

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} 을 불러오지 못했습니다 (${res.status})`);
  return res.json();
}

// 아이폰 사파리의 확대·당겨서 새로고침·두 손가락 제스처 막기
function lockPageGestures() {
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
}

async function boot() {
  lockPageGestures();
  const loading = document.getElementById('loading');

  const [game, outfits] = await Promise.all([fetchJson('data/game.json'), fetchJson('data/outfits.json')]);
  const mapId = game.startMap;
  const mapJson = await fetchJson(`data/maps/${mapId}.json`);

  // 화면 선명도: 기기 픽셀 비율만큼 캔버스를 키우되, 성능을 위해 maxPixelRatio로 제한
  const getPixelRatio = () => Math.min(window.devicePixelRatio || 1, game.maxPixelRatio);
  const viewSize = () => {
    const vv = window.visualViewport;
    return { w: Math.round(vv ? vv.width : window.innerWidth), h: Math.round(vv ? vv.height : window.innerHeight) };
  };

  const joystick = new Joystick({
    zone: document.getElementById('joystick-zone'),
    base: document.getElementById('joystick-base'),
    knob: document.getElementById('joystick-knob'),
    radius: game.joystick.radius,
  });
  const input = new MoveInput(joystick);

  const dpr = getPixelRatio();
  const { w, h } = viewSize();
  const phaserGame = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: w * dpr,
    height: h * dpr,
    backgroundColor: '#1d1a14',
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    render: { antialias: true, roundPixels: false },
    input: { activePointers: 3 },
    banner: false,
  });

  const resize = () => {
    const r = getPixelRatio();
    const s = viewSize();
    phaserGame.scale.setZoom(1 / r);
    phaserGame.scale.resize(s.w * r, s.h * r);
    joystick.placeHome();
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 300));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  // 개발 중 확인용 (브라우저 콘솔에서 seolhwa.game)
  window.seolhwa = { game: phaserGame };

  phaserGame.scene.add('village', VillageScene, true, {
    game,
    outfits,
    mapId,
    mapJson,
    input,
    joystick,
    getPixelRatio,
    onReady: () => loading.classList.add('hide'),
  });
}

boot().catch((err) => {
  console.error(err);
  const loading = document.getElementById('loading');
  loading.textContent = `오류: ${err.message}`;
});
