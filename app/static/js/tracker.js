// Uber-Style Project Tracker

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('resultsContainer');
const emptyState = document.getElementById('emptyState');
const loadingIndicator = document.getElementById('loadingIndicator');

const STAGES = ['Pending', 'In Progress', 'Under Review', 'Completed'];
const STAGE_ICONS = {
    'Pending': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    'In Progress': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    'Under Review': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    'Completed': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};

function headerToKey(header) {
    return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function getStageIndex(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('complet') || s.includes('deliver') || s.includes('done')) return 3;
    if (s.includes('review') || s.includes('testing') || s.includes('qa')) return 2;
    if (s.includes('progress') || s.includes('working') || s.includes('active')) return 1;
    if (s.includes('hold')) return -1; // special case
    return 0; // pending or unknown
}

function getDaysInfo(expectedDelivery, startDate) {
    if (!expectedDelivery) return { daysLeft: null, totalDays: null, percent: 0 };

    const now = new Date();
    const delivery = new Date(expectedDelivery);
    const start = startDate ? new Date(startDate) : null;
    const daysLeft = Math.ceil((delivery - now) / (1000 * 60 * 60 * 24));
    const totalDays = start ? Math.ceil((delivery - start) / (1000 * 60 * 60 * 24)) : null;
    const elapsed = totalDays ? totalDays - daysLeft : null;
    const percent = totalDays && totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : null;

    return { daysLeft, totalDays, elapsed, percent };
}

function renderTracker(project, headers) {
    const orderedKeys = headers ? headers.map(h => headerToKey(h)) : Object.keys(project);
    const idKey = orderedKeys.find(k => k.includes('id')) || orderedKeys[0];
    const nameKey = orderedKeys.find(k => k.includes('name')) || orderedKeys[1];
    const statusKey = orderedKeys.find(k => k.includes('status')) || orderedKeys[2];
    const dateKey = orderedKeys.find(k => k === 'date' || k.includes('start')) || orderedKeys[3];
    const deliveryKey = orderedKeys.find(k => k.includes('delivery') || k.includes('expected') || k.includes('due')) || orderedKeys[4];

    const status = project[statusKey] || 'Pending';
    const stageIndex = getStageIndex(status);
    const isOnHold = stageIndex === -1;
    const isCompleted = stageIndex === 3;
    const activeStage = isOnHold ? 1 : stageIndex;

    const { daysLeft, percent } = getDaysInfo(project[deliveryKey], project[dateKey]);

    // ETA text
    let etaText, etaSub, etaClass;
    if (isCompleted) {
        etaText = 'Delivered';
        etaSub = 'Project completed successfully';
        etaClass = 'status-completed';
    } else if (isOnHold) {
        etaText = 'On Hold';
        etaSub = 'Project is temporarily paused';
        etaClass = 'status-on-hold';
    } else if (daysLeft !== null) {
        if (daysLeft < 0) {
            etaText = `${Math.abs(daysLeft)} days overdue`;
            etaSub = `Was expected on ${project[deliveryKey]}`;
            etaClass = 'status-on-hold';
        } else if (daysLeft === 0) {
            etaText = 'Arriving Today';
            etaSub = 'Expected delivery is today!';
            etaClass = '';
        } else if (daysLeft === 1) {
            etaText = 'Tomorrow';
            etaSub = 'Expected delivery is tomorrow';
            etaClass = '';
        } else {
            etaText = `${daysLeft} days`;
            etaSub = `Expected delivery: ${project[deliveryKey]}`;
            etaClass = '';
        }
    } else {
        etaText = status;
        etaSub = 'Delivery date not set';
        etaClass = 'status-pending';
    }

    // Progress bar width
    let barPercent;
    if (isCompleted) barPercent = 100;
    else if (isOnHold) barPercent = (1 / 3) * 100;
    else barPercent = (activeStage / 3) * 100;

    // Vehicle position
    const vehiclePercent = isCompleted ? 92 : (percent !== null ? Math.min(88, percent) : barPercent * 0.88);

    // Build detail rows (skip id and name since shown in header)
    const detailKeys = orderedKeys.filter(k => k !== idKey && k !== nameKey);

    return `
        <div class="tracker-card">
            <div class="tracker-eta ${etaClass}">
                <div class="eta-label">Estimated Delivery</div>
                <div class="eta-value">${etaText}</div>
                <div class="eta-sublabel">${etaSub}</div>
            </div>

            <div class="tracker-info">
                <div class="tracker-project-name">${project[nameKey] || 'Project'}</div>
                <div class="tracker-project-id">${project[idKey] || ''}</div>
            </div>

            <div class="delivery-vehicle">
                <div class="vehicle-start"></div>
                <div class="vehicle-road"></div>
                <div class="vehicle-icon" style="left: 0%" data-target="${vehiclePercent}">📦</div>
                <div class="vehicle-end">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#0a0a0a"/></svg>
                    <span class="vehicle-end-label">Delivery</span>
                </div>
            </div>

            <div class="tracker-timeline">
                <div class="timeline-track">
                    <div class="timeline-bar">
                        <div class="timeline-bar-fill ${isCompleted ? 'completed' : ''}" style="width: 0%" data-target="${barPercent}"></div>
                    </div>
                    ${STAGES.map((stage, i) => {
                        let stepClass = '';
                        if (isCompleted) stepClass = 'done';
                        else if (i < activeStage) stepClass = 'done';
                        else if (i === activeStage && !isOnHold) stepClass = 'active';
                        return `
                            <div class="timeline-step ${stepClass}">
                                <div class="step-dot">${STAGE_ICONS[stage]}</div>
                                <span class="step-label">${stage}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="tracker-details">
                ${detailKeys.map((key, i) => {
                    const headerIdx = orderedKeys.indexOf(key);
                    const label = (headers && headers[headerIdx]) || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return `
                        <div class="detail-row">
                            <span class="detail-row-label">${label}</span>
                            <span class="detail-row-value">${project[key] || '-'}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function animateCards() {
    // Animate progress bars
    document.querySelectorAll('.timeline-bar-fill').forEach(bar => {
        setTimeout(() => {
            bar.style.width = bar.dataset.target + '%';
        }, 200);
    });

    // Animate vehicle icons
    document.querySelectorAll('.vehicle-icon').forEach(icon => {
        setTimeout(() => {
            icon.style.left = icon.dataset.target + '%';
        }, 300);
    });
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

        if (!data.results || data.results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No projects found. Check the ID or name and try again.</div>';
            return;
        }

        resultsContainer.innerHTML = data.results.map(p => renderTracker(p, data.headers)).join('');
        requestAnimationFrame(() => animateCards());
    } catch (e) {
        resultsContainer.innerHTML = '<div class="no-results">Connection error. Please try again.</div>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Event listeners
searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') doSearch();
});

let debounceTimer;
searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (searchInput.value.trim().length >= 2) doSearch();
        else if (searchInput.value.trim().length === 0) {
            resultsContainer.innerHTML = '';
            emptyState.style.display = '';
        }
    }, 400);
});
