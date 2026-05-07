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

/* ---------- 날짜 ---------- */
function setCurrentDate() {
  const el = document.getElementById('current-date');
  if (!el) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  el.textContent = `${y}.${m}.${d}`;
}

/* ---------- 데이터 로드 ---------- */
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
    renderSnapshot(data);
    renderArchive(data);
  } catch (e) {
    console.error('loadInsights failed:', e);
    document.getElementById('archive-list').innerHTML =
      '<div class="empty-state">인사이트 데이터를 불러오지 못했습니다.</div>';
  }
}

/* ---------- 스냅샷 ---------- */
function renderSnapshot(insights) {
  const section = document.getElementById('snapshot-section');
  if (!section || insights.length === 0) return;

  const latestDate = insights[0].date;
  const today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
  })();

  if (latestDate !== today) {
    section.style.display = 'none';
    return;
  }

  const items = insights.filter(i => i.date === latestDate);
  document.getElementById('snapshot-label').textContent =
    `오늘의 인사이트 — ${latestDate.replace(/-/g, '.')}`;
  section.style.display = 'block';

  const grid = document.getElementById('snapshot-grid');
  grid.innerHTML = '';
  items.forEach(item => grid.appendChild(createSnapshotCard(item, true)));
}

function createSnapshotCard(item, showDot) {
  const card = document.createElement('div');
  card.className = 'snapshot-card';
  card.onclick = () => location.href = `insight.html?file=${item.path}`;

  card.innerHTML = `
    <div class="snapshot-card-top">
      <span class="badge badge-${item.category}">${item.categoryName}</span>
      ${showDot ? '<div class="snapshot-dot"></div>' : ''}
    </div>
    <div class="snapshot-title">${cleanTitle(item.title)}</div>
    ${item.summary ? `<div class="snapshot-summary">${item.summary}</div>` : ''}
    <div class="snapshot-divider"></div>
    <div class="snapshot-meta">
      <span>${item.time}</span>
      <span class="snapshot-view">보기 →</span>
    </div>
  `;
  return card;
}

/* ---------- 아카이브 ---------- */
function renderArchive(insights) {
  const list = document.getElementById('archive-list');
  const countEl = document.getElementById('total-count');
  if (!list) return;

  if (countEl) countEl.textContent = `전체 ${insights.length}건`;
  list.innerHTML = '';

  if (insights.length === 0) {
    list.innerHTML = '<div class="empty-state">등록된 인사이트가 없습니다.</div>';
    return;
  }

  const groups = groupByDate(insights);
  const dates = Object.keys(groups).sort().reverse();
  const latestDate = dates[0];

  dates.forEach(date => {
    const header = document.createElement('div');
    header.className = 'date-group-header';
    header.innerHTML = `
      <span class="date-label">${date.replace(/-/g, ' · ')}</span>
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
  div.onclick = () => location.href = `insight.html?file=${item.path}`;

  div.innerHTML = `
    <div class="archive-badge-wrap">
      <span class="badge badge-${item.category}">${item.categoryName}</span>
    </div>
    <div class="archive-content">
      <div class="archive-title">${cleanTitle(item.title)}</div>
      ${item.summary ? `<div class="archive-summary">${item.summary}</div>` : ''}
      <div class="archive-meta">${item.time}</div>
    </div>
    <span class="archive-arrow">›</span>
  `;
  return div;
}

/* ---------- 검색 ---------- */
function setupSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    const snapshot = document.getElementById('snapshot-section');
    if (query) {
      if (snapshot) snapshot.style.display = 'none';
    } else {
      renderSnapshot(allInsights);
    }
    applyFilters();
  });
}

/* ---------- 탭 ---------- */
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelector('.tab.active')?.classList.remove('active');
      tab.classList.add('active');
      applyFilters();
    });
  });
}

/* ---------- 필터 적용 ---------- */
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

/* ---------- 유틸 ---------- */
function cleanTitle(title) {
  return (title || '').replace(/Daily Strategy Insight/gi, '전략 인사이트');
}
