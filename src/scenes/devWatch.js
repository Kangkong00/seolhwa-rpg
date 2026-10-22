// 개발용 감시(docs/spec/feedback_1022.md 10): 프레임마다 글자가 쏟아지거나 값이 NaN·음수·무한대가 되면 콘솔에 경고.
// 1초마다 셈. 결과는 window.__devWatch에도 남김(자동 시험이 읽음). 게임 동작은 바꾸지 않음.
export class DevWatch {
  constructor(scene, cfg = {}) {
    this.scene = scene;
    this.maxTextsPerSec = cfg.maxTextsPerSec ?? 20;
    this.texts = 0;
    this.t = 0;
    this.warned = new Set();
    const w = (window.__devWatch = window.__devWatch || { maxTextsPerSec: 0, warnings: [] });
    this.w = w;
    this.onAdd = (go) => { if (go && go.type === 'Text') this.texts++; };
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdd);
    scene.events.once('shutdown', () => scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdd));
  }

  warn(key, msg) {
    if (this.warned.has(key)) return; // 같은 경고는 맵마다 한 번
    this.warned.add(key);
    this.w.warnings.push(msg);
    console.warn(`[감시] ${msg}`);
  }

  update(dt) {
    this.t += dt;
    if (this.t < 1000) return;
    this.t = 0;
    const s = this.scene;
    this.w.maxTextsPerSec = Math.max(this.w.maxTextsPerSec, this.texts);
    if (this.texts > this.maxTextsPerSec) this.warn(`texts${Math.floor(s.time.now / 10000)}`, `1초에 글자 ${this.texts}개(${this.maxTextsPerSec}개 넘음)`);
    this.texts = 0;
    const bad = (v, min = 0) => typeof v !== 'number' || !Number.isFinite(v) || v < min;
    const p = s.player;
    if (bad(p.hp) || bad(p.maxHp, 1) || p.hp > p.maxHp) this.warn('hp', `체력 이상: ${p.hp} / ${p.maxHp}`);
    const st = s.stats();
    for (const k of ['attack', 'defense', 'speedMul', 'maxHpMul', 'healMul', 'critChance', 'cooldownMul', 'attackMul', 'damageTakenMul', 'swingMul']) {
      if (bad(st[k])) this.warn(`stat.${k}`, `능력치 ${k} 이상: ${st[k]}`);
    }
    if (st.cooldownMul <= 0) this.warn('cdmul', `무예 기다림 배율이 0 이하: ${st.cooldownMul}`);
    for (const [id, v] of Object.entries(s.cooldowns.left)) if (!Number.isFinite(v)) this.warn(`cd.${id}`, `무예 기다림 이상: ${id} ${v}`);
    for (const m of s.spawner.monsters) {
      if (bad(m.hp, -1e9) || bad(m.x) || bad(m.y)) this.warn(`m.${m.type}`, `몬스터 값 이상: ${m.type} hp ${m.hp} (${m.x}, ${m.y})`);
    }
    if (bad(s.pos.x) || bad(s.pos.y)) this.warn('pos', `주인공 자리 이상: ${s.pos.x}, ${s.pos.y}`);
    if (s.slowMo && !(s.slowMo.left > 0 && s.slowMo.left < 10000)) this.warn('slow', `느린 화면이 끝나지 않음: ${JSON.stringify(s.slowMo)}`);
  }
}
