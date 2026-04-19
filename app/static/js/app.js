// Project Status Widget - Frontend Logic

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('resultsContainer');
const emptyState = document.getElementById('emptyState');
const loadingIndicator = document.getElementById('loadingIndicator');
const reminderToggle = document.getElementById('reminderToggle');
const remindersPanel = document.getElementById('remindersPanel');
const remindersList = document.getElementById('remindersList');

let remindersVisible = false;

function getStatusClass(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('progress')) return 'status-in-progress';
    if (s.includes('complet')) return 'status-completed';
    if (s.includes('pending')) return 'status-pending';
    if (s.includes('review')) return 'status-under-review';
    if (s.includes('hold')) return 'status-on-hold';
    return 'status-default';
}

function formatHeader(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function headerToKey(header) {
    return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function renderResults(data) {
    const { results, headers } = data;

    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No projects found matching your search.</div>';
        return;
    }

    // Map headers to dict keys to ensure correct ordering
    const orderedKeys = headers ? headers.map(h => headerToKey(h)) : Object.keys(results[0]);

    resultsContainer.innerHTML = results.map(project => {
        const idKey = orderedKeys.find(k => k.includes('id')) || orderedKeys[0];
        const nameKey = orderedKeys.find(k => k.includes('name')) || orderedKeys[1];

        return `
            <div class="result-card">
                <div class="project-title">
                    <span class="project-id">${project[idKey] || ''}</span>
                    ${project[nameKey] || ''}
                </div>
                <div class="result-details">
                    ${orderedKeys.map((key, i) => {
                        const label = (headers && headers[i]) || formatHeader(key);
                        const val = project[key] || '';
                        const isStatus = key.includes('status');
                        return `
                            <div class="detail-item">
                                <span class="detail-label">${label}</span>
                                <span class="detail-value">
                                    ${isStatus
                                        ? `<span class="status-badge-pill ${getStatusClass(val)}">${val}</span>`
                                        : val || '-'}
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

async function doSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        resultsContainer.innerHTML = '';
        emptyState.style.display = '';
        return;
    }

    emptyState.style.display = 'none';
    loadingIndicator.style.display = 'flex';
    resultsContainer.innerHTML = '';

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        renderResults(data);
    } catch (e) {
        resultsContainer.innerHTML = '<div class="no-results">Error connecting to server. Please try again.</div>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

async function loadReminders() {
    try {
        const res = await fetch('/api/reminders');
        const data = await res.json();

        if (!data.reminders || data.reminders.length === 0) {
            remindersList.innerHTML = '<p style="color: var(--text-muted); font-size: 14px;">No upcoming deliveries in the next 7 days.</p>';
            return;
        }

        remindersList.innerHTML = data.reminders.map(r => {
            const urgencyClass = `reminder-${r.urgency}`;
            const daysText = r.days_left === 0 ? 'Due TODAY'
                : r.days_left === 1 ? 'Due TOMORROW'
                : `${r.days_left} days left`;

            const keys = Object.keys(r);
            const nameKey = keys.find(k => k.includes('name')) || keys[1];
            const idKey = keys.find(k => k.includes('id')) || keys[0];

            return `
                <div class="reminder-item ${urgencyClass}">
                    <div>
                        <strong>${r[idKey] || ''}</strong> - ${r[nameKey] || ''}
                        <div style="font-size: 12px; color: var(--text-muted);">Delivery: ${r.expected_delivery || ''}</div>
                    </div>
                    <span class="reminder-days">${daysText}</span>
                </div>
            `;
        }).join('');
    } catch (e) {
        remindersList.innerHTML = '<p style="color: var(--danger);">Could not load reminders.</p>';
    }
}

// Event listeners
searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') doSearch();
});

// Live search with debounce
let debounceTimer;
searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (searchInput.value.trim().length >= 2) doSearch();
        else if (searchInput.value.trim().length === 0) {
            resultsContainer.innerHTML = '';
            emptyState.style.display = '';
        }
    }, 300);
});

reminderToggle.addEventListener('click', () => {
    remindersVisible = !remindersVisible;
    remindersPanel.style.display = remindersVisible ? 'block' : 'none';
    if (remindersVisible) loadReminders();
});
