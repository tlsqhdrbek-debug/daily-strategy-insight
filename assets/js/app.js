// 공통 JavaScript 로직
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('snapshot-grid') && document.getElementById('archive-list')) {
        loadInsights();
        setupSearch();
        setupTabs();
        setupDateFilter();
    }
    setCurrentDate();
});

// 오늘 날짜 설정
function setCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}.${month}.${day}`;
    document.getElementById('current-date').textContent = dateStr;
}

// 인사이트 데이터 로드
async function loadInsights() {
    try {
        const response = await fetch('data/insights.json');
        if (!response.ok) throw new Error('Failed to load insights');
        const insights = await response.json();

        insights.sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return b.time.localeCompare(a.time);
        });

        allInsights = insights;
        renderSnapshot(insights);
        buildDateFilter(insights);
        renderArchive(insights);
    } catch (error) {
        console.error('Error loading insights:', error);
        showError(`인사이트 데이터를 불러오지 못했습니다. (${error.message})`);
    }
}

// 오늘의 인사이트 스냅샷 렌더링
function renderSnapshot(insights) {
    if (insights.length === 0) return;

    const latestDate = insights[0].date;
    const latestInsights = insights.filter(item => item.date === latestDate);

    document.getElementById('snapshot-title').textContent = `오늘의 주요 전략 인사이트 — ${latestDate.replace(/-/g, ' · ')}`;
    document.getElementById('snapshot-section').style.display = 'block';

    const grid = document.getElementById('snapshot-grid');
    grid.innerHTML = '';

    latestInsights.forEach(item => {
        const card = createSnapshotCard(item);
        grid.appendChild(card);
    });
}

// 제목 한글 변환
function formatTitle(title) {
    return title.replace(/Daily Strategy Insight/gi, '전략 인사이트');
}

// 스냅샷 카드 생성
function createSnapshotCard(item) {
    const card = document.createElement('div');
    card.className = 'snapshot-card';
    card.onclick = () => window.location.href = `insight.html?file=${item.path}`;

    const badgeClass = `badge-${item.category}`;
    const isLatest = item.date === getLatestDate();
    const displayTitle = formatTitle(item.title);

    card.innerHTML = `
        <div class="snapshot-card-header">
            <span class="snapshot-badge ${badgeClass}">${item.categoryName}</span>
            ${isLatest ? '<div class="snapshot-dot"></div>' : ''}
        </div>
        <div class="snapshot-title">${displayTitle}</div>
        ${item.summary ? `<div class="snapshot-summary">${item.summary}</div>` : ''}
        <div class="snapshot-divider"></div>
        <div class="snapshot-meta">
            <span>${item.time}</span>
            <span class="snapshot-view">보기 →</span>
        </div>
    `;

    return card;
}

// 최신 날짜 가져오기
function getLatestDate() {
    return document.getElementById('snapshot-title').textContent.includes('—')
        ? document.getElementById('snapshot-title').textContent.split('—')[1].trim().replace(/ · /g, '-')
        : new Date().toISOString().split('T')[0];
}

// 아카이브 렌더링
function renderArchive(insights) {
    const list = document.getElementById('archive-list');
    const totalCount = document.getElementById('total-count');

    totalCount.textContent = `전체 ${insights.length}건`;
    list.innerHTML = '';

    if (insights.length === 0) {
        list.innerHTML = '<div class="no-results">검색 결과가 없습니다. 다른 검색어 또는 날짜/카테고리를 선택해 주세요.</div>';
        return;
    }

    const grouped = groupByDate(insights);
    const dateKeys = Object.keys(grouped).sort().reverse();
    const latestDate = dateKeys[0];

    dateKeys.forEach(date => {
        const group = grouped[date];

        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group';
        dateGroup.innerHTML = `
            <span class="date-label">${date.replace(/-/g, ' · ')}</span>
            <div class="date-line"></div>
            ${date === latestDate ? '<span class="new-badge">NEW</span>' : ''}
        `;
        list.appendChild(dateGroup);

        group.forEach(item => {
            const archiveItem = createArchiveItem(item);
            list.appendChild(archiveItem);
        });
    });
}

// 날짜별 그룹핑
function groupByDate(insights) {
    return insights.reduce((groups, item) => {
        if (!groups[item.date]) groups[item.date] = [];
        groups[item.date].push(item);
        return groups;
    }, {});
}

// 아카이브 아이템 생성
function createArchiveItem(item) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'archive-item';
    itemDiv.onclick = () => window.location.href = `insight.html?file=${item.path}`;

    const badgeClass = `badge-${item.category}`;
    const displayTitle = formatTitle(item.title);

    itemDiv.innerHTML = `
        <div class="archive-badge snapshot-badge ${badgeClass}">${item.categoryName}</div>
        <div class="archive-content">
            <div class="archive-title">${displayTitle}</div>
            ${item.summary ? `<div class="archive-summary">${item.summary}</div>` : ''}
            <div class="archive-meta">${item.time}</div>
        </div>
        <div class="archive-arrow">›</div>
    `;

    return itemDiv;
}

// 검색 설정
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', function() {
        updateArchiveVisibility();
    });
}

function setupDateFilter() {
    const dateFilter = document.getElementById('date-filter');
    const dateClear = document.getElementById('date-clear');
    if (!dateFilter) return;

    dateFilter.addEventListener('change', function() {
        updateArchiveVisibility();
    });

    if (dateClear) {
        dateClear.addEventListener('click', function() {
            dateFilter.value = '';
            updateArchiveVisibility();
        });
    }
}

// 탭 설정
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelector('.tab.active').classList.remove('active');
            this.classList.add('active');
            updateArchiveVisibility();
        });
    });
}

// 카테고리 필터링
function filterByCategory(category) {
    updateArchiveVisibility();
}

function buildDateFilter(insights) {
    const dateFilter = document.getElementById('date-filter');
    if (!dateFilter) return;

    const uniqueDates = [...new Set(insights.map(item => item.date))].sort();
    if (uniqueDates.length === 0) return;

    dateFilter.min = uniqueDates[0];
    dateFilter.max = uniqueDates[uniqueDates.length - 1];
    dateFilter.value = '';
    dateFilter.placeholder = '전체 날짜';
}

function updateArchiveVisibility() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const selectedCategory = document.querySelector('.tab.active')?.dataset.category || 'all';
    const selectedDate = document.getElementById('date-filter')?.value || 'all';

    const filteredInsights = allInsights.filter(item => {
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        const matchesDate = selectedDate === 'all' || item.date === selectedDate;
        const searchText = `${item.title} ${item.summary || ''} ${item.categoryName}`.toLowerCase();
        const matchesQuery = !query || searchText.includes(query);
        return matchesCategory && matchesDate && matchesQuery;
    });

    renderArchive(filteredInsights);
}

// 배지 텍스트에서 카테고리 추출
function getCategoryFromBadge(text) {
    const map = {
        '일반': 'general',
        '소매금융': 'retail-finance',
        '기업금융': 'corporate-finance',
        '자동차금융': 'auto-finance',
        'AX': 'AX',
        'IT': 'IT'
    };
    return map[text] || 'all';
}

// 검색 필터링
function filterArchive(query) {
    const snapshotSection = document.getElementById('snapshot-section');
    const items = document.querySelectorAll('.archive-item');

    if (query) {
        snapshotSection.style.display = 'none';
        let visibleCount = 0;

        items.forEach(item => {
            const title = item.querySelector('.archive-title').textContent.toLowerCase();
            const summary = item.querySelector('.archive-summary')?.textContent.toLowerCase() || '';
            const category = item.querySelector('.archive-badge').textContent.toLowerCase();

            if (title.includes(query) || summary.includes(query) || category.includes(query)) {
                item.style.display = 'flex';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        updateTotalCount(visibleCount);
    } else {
        snapshotSection.style.display = 'block';
        items.forEach(item => item.style.display = 'flex');
        updateTotalCount(items.length);
    }
}

// 총 개수 업데이트
function updateTotalCount(count) {
    document.getElementById('total-count').textContent = `전체 ${count}건`;
}

// 오류 표시
function showError(message) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.innerHTML = `<div class="error-message">${message}</div>`;
    });
}
