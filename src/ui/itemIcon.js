// 물건 아이콘(DOM). 그림이 아직 없으면 iconText(없으면 이름 첫 글자) 글자 칸으로 대신함.
export function itemIcon(def) {
  const text = () => {
    const t = document.createElement('div');
    t.className = 'icon-text';
    const label = def ? def.iconText || def.name.charAt(0) : '?';
    t.textContent = label;
    if (label.length > 1) t.style.fontSize = '14px';
    return t;
  };
  if (!def || !def.icon) return text();
  const img = document.createElement('img');
  img.src = def.icon;
  if (def.iconFilter) img.style.filter = def.iconFilter; // 그림이 오기 전 임시로 물들임(새 무기)
  img.alt = '';
  img.draggable = false;
  img.addEventListener('error', () => img.replaceWith(text()), { once: true });
  return img;
}

// 한자 한 글자 등 글자 아이콘
export function charIcon(ch) {
  const t = document.createElement('div');
  t.className = 'icon-text';
  t.textContent = ch;
  return t;
}
