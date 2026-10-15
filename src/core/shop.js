// 가게 사고팔기(화면과 무관). shop = data/npcs.json의 shop: { buys: [아이템 id], sells: [{ id, price? }] }
// 가게는 자기가 사 주는 물건만 삼. 파는 값은 data/items.json sellPrice.
import { addItem, removeItem, countItem } from './equipment.js';

// 가게가 사 주는 물건인지(def.anyShop이면 어느 가게든 사 줌 — 쥐왕의 엽전 꿰미)
export function shopBuysItem(shop, id, def = null) {
  if (!shop || !Array.isArray(shop.buys)) return false;
  return shop.buys.includes(id) || !!(def && def.anyShop && shop.sells !== undefined && shop.buys.length > 0);
}

// 가게에 팔기. 반환: { ok, coins, reason }
export function sellToShop(inv, itemDefs, shop, id, n) {
  const def = itemDefs[id];
  if (!def || !shopBuysItem(shop, id, def)) return { ok: false, reason: '이 가게에서는 사지 않습니다' };
  n = Math.floor(n);
  if (n <= 0 || countItem(inv, id) < n) return { ok: false, reason: '가진 것이 모자랍니다' };
  removeItem(inv, id, n);
  const coins = (def.sellPrice || 0) * n;
  inv.coins += coins;
  return { ok: true, coins };
}

// 파는 물건의 값: { coins, items: { 재료 id: 개수 } }. sells에 price(푼)가 있으면 그것, 없으면 data/items.json의 shopPrice
// (재료가 필요한 값 — 대장장이 무기, docs/spec/feedback_1015.md 7)
export function goodsPrice(goods, def) {
  if (goods && typeof goods.price === 'number') return { coins: goods.price, items: {} };
  const p = (def && def.shopPrice) || {};
  return { coins: p.coins || 0, items: { ...(p.items || {}) } };
}

// 몇 개까지 살 수 있는지(엽전과 재료 모두 따져서)
export function maxAffordable(inv, price, cap = 99) {
  let max = cap;
  if (price.coins > 0) max = Math.min(max, Math.floor(inv.coins / price.coins));
  for (const [id, n] of Object.entries(price.items)) if (n > 0) max = Math.min(max, Math.floor(countItem(inv, id) / n));
  return Math.max(0, max);
}

// 모자란 것 설명: ['엽전 모자람', '쥐가죽 2/5']
export function missingFor(inv, itemDefs, price, n = 1) {
  const out = [];
  if (inv.coins < price.coins * n) out.push('엽전 모자람');
  for (const [id, k] of Object.entries(price.items)) {
    const have = countItem(inv, id);
    if (have < k * n) out.push(`${itemDefs[id] ? itemDefs[id].name : id} ${have}/${k * n}`);
  }
  return out;
}

// 가게에서 사기(엽전 + 재료를 함께 냄). 반환: { ok, cost, items, reason }
export function buyFromShop(inv, itemDefs, shop, id, n) {
  const goods = shop && (shop.sells || []).find((g) => g.id === id);
  if (!goods || !itemDefs[id]) return { ok: false, reason: '팔지 않는 물건입니다' };
  n = Math.floor(n);
  if (n <= 0) return { ok: false, reason: '' };
  const price = goodsPrice(goods, itemDefs[id]);
  const miss = missingFor(inv, itemDefs, price, n);
  if (miss.length) return { ok: false, reason: miss[0] === '엽전 모자람' && miss.length === 1 ? '엽전이 모자랍니다' : `모자랍니다: ${miss.join(', ')}` };
  const cost = price.coins * n;
  const items = {};
  inv.coins -= cost;
  for (const [mid, k] of Object.entries(price.items)) {
    removeItem(inv, mid, k * n);
    items[mid] = k * n;
  }
  addItem(inv, itemDefs, id, n);
  return { ok: true, cost, items };
}
