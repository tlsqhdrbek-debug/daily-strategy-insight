/* Daily Strategy Insight Hub — app.js */
let allInsights = [];

document.addEventListener('DOMContentLoaded', () => {
  setCurrentDate();
  if (document.getElementById('snapshot-grid')) {
    loadInsights();
    setupSearch();
    setupTabs();
  }
});

function setCurrentDate() {
  const el = document.getElementById('current-date');
  if (!el) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  el.textContent = `${y}.${m}.${d}`;
}

async function loadInsights() {
  try {
    const res = await fetch('data/insights.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    data.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.time || '').localeCompare(a.time || '');
    });

    allInsights = data;
    updateStats(data);
    renderSnapshot(data);
    renderArchive(data);
  } catch (e) {
    console.error('loadInsights failed:', e);
    document.getElementById('archive-list').innerHTML =
      '<div class="empty-state"><div class="empty-icon">⚠️</div>인사이트 데이터를 불러오지 못했습니다.</div>';
  }
}

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

function updateStats(insights) {
  const totalEl = document.getElementById('stat-total');
  const todayEl = document.getElementById('stat-today');
  if (totalEl) totalEl.textContent = insights.length;
  if (todayEl) {
    const today = todayStr();
    todayEl.textContent = insights.filter(i => i.date === today).length;
  }
}

function renderSnapshot(insights) {
  const section = document.getElementById('snapshot-section');
  if (!section) return;
  if (insights.length === 0) { section.style.display = 'none'; return; }

  const latestDate = insights[0].date;
  if (latestDate !== todayStr()) { section.style.display = 'none'; return; }

  const items = insights.filter(i => i.date === latestDate);
  const labelEl = document.getElementById('snapshot-label');
  const countEl = document.getElementById('snapshot-count');
  if (labelEl) labelEl.textContent = `오늘의 인사이트 — ${latestDate.replace(/-/g, '.')}`;
  if (countEl) countEl.textContent = `${items.length}건`;
  section.style.display = 'block';

  const grid = document.getElementById('snapshot-grid');
  grid.innerHTML = '';
  items.forEach(item => grid.appendChild(createSnapshotCard(item)));
}

function createSnapshotCard(item) {
  const card = document.createElement('div');
  card.className = 'snapshot-card';
  card.dataset.cat = item.category;
  card.onclick = () => location.href = `insight.html?file=${item.path}`;

  card.innerHTML = `
    <div class="snapshot-card-header">
      <span class="badge badge-${item.category}">${item.categoryName}</span>
    </div>
    <div class="snapshot-title">${cleanTitle(item.title)}</div>
    ${item.summary ? `<div class="snapshot-summary">${item.summary}</div>` : ''}
    <div class="snapshot-footer">
      <span class="snapshot-time">${item.time}</span>
      <span class="snapshot-cta">자세히 보기 →</span>
    </div>
  `;
  return card;
}

function renderArchive(insights) {
  const list = document.getElementById('archive-list');
  const countEl = document.getElementById('total-count');
  if (!list) return;

  if (countEl) countEl.textContent = `${insights.length}건`;
  list.innerHTML = '';

  if (insights.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div>검색 결과가 없습니다.</div>';
    return;
  }

  const groups = groupByDate(insights);
  const dates = Object.keys(groups).sort().reverse();
  const latestDate = dates[0];

  dates.forEach(date => {
    const header = document.createElement('div');
    header.className = 'date-group-header';
    header.innerHTML = `
      <span class="date-label">${date.replace(/-/g, '.')}</span>
      <div class="date-line"></div>
      ${date === latestDate ? '<span class="new-pill">NEW</span>' : ''}
    `;
    list.appendChild(header);
    groups[date].forEach(item => list.appendChild(createArchiveItem(item)));
  });
}

function groupByDate(insights) {
  return insights.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});
}

function createArchiveItem(item) {
  const div = document.createElement('div');
  div.className = 'archive-item';
  div.dataset.cat = item.category;
  div.onclick = () => location.href = `insight.html?file=${item.path}`;

  div.innerHTML = `
    <div class="archive-item-accent"></div>
    <div class="archive-badge-wrap">
      <span class="badge badge-${item.category}">${item.categoryName}</span>
    </div>
    <div class="archive-content">
      <div class="archive-title">${cleanTitle(item.title)}</div>
      ${item.summary ? `<div class="archive-summary">${item.summary}</div>` : ''}
      <div class="archive-time">${item.time}</div>
    </div>
    <div class="archive-arrow">›</div>
  `;
  return div;
}

function setupSearch() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  if (!input) return;

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);
    const snapshot = document.getElementById('snapshot-section');
    if (query) {
      if (snapshot) snapshot.style.display = 'none';
    } else {
      renderSnapshot(allInsights);
    }
    applyFilters();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.remove('visible');
      input.focus();
      renderSnapshot(allInsights);
      applyFilters();
    });
  }
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelector('.tab.active')?.classList.remove('active');
      tab.classList.add('active');
      applyFilters();
    });
  });
}

function applyFilters() {
  const query = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
  const cat = document.querySelector('.tab.active')?.dataset.category || 'all';

  const filtered = allInsights.filter(item => {
    const matchCat = cat === 'all' || item.category === cat;
    const text = `${item.title} ${item.summary || ''} ${item.categoryName}`.toLowerCase();
    const matchQ = !query || text.includes(query);
    return matchCat && matchQ;
  });

  renderArchive(filtered);
}

function cleanTitle(title) {
  return (title || '').replace(/Daily Strategy Insight/gi, '전략 인사이트');
}
