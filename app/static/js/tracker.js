// Uber-Style Inspection Tracker

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('resultsContainer');
const emptyState = document.getElementById('emptyState');
const loadingIndicator = document.getElementById('loadingIndicator');

const STAGES = ['Scheduled', 'Inspection', 'Report Writing', 'Delivered'];
const STAGE_ICONS = {
    'Scheduled': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    'Inspection': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    'Report Writing': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    'Delivered': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};

function headerToKey(header) {
    return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function deriveStatus(project, orderedKeys) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find relevant keys
    const inspectionKey = orderedKeys.find(k => k.includes('inspection'));
    const deliveryKey = orderedKeys.find(k => k.includes('delivery') || k.includes('expected'));
    const delayKey = orderedKeys.find(k => k.includes('delay'));

    const inspDate = inspectionKey && project[inspectionKey] ? new Date(project[inspectionKey]) : null;
    const delDate = deliveryKey && project[deliveryKey] ? new Date(project[deliveryKey]) : null;
    const hasDelay = delayKey && project[delayKey] && project[delayKey].trim() !== '';

    if (inspDate) inspDate.setHours(0, 0, 0, 0);
    if (delDate) delDate.setHours(0, 0, 0, 0);

    if (hasDelay) return { status: 'Delayed', stageIndex: -1 };
    if (delDate && now > delDate) return { status: 'Delivered', stageIndex: 3 };
    if (inspDate && now >= inspDate) return { status: 'Report Writing', stageIndex: 2 };
    if (inspDate && now < inspDate) return { status: 'Scheduled', stageIndex: 0 };

    return { status: 'Scheduled', stageIndex: 0 };
}

function getDaysInfo(expectedDelivery, inspectionDate) {
    if (!expectedDelivery) return { daysLeft: null, percent: 0 };

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const delivery = new Date(expectedDelivery);
    delivery.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((delivery - now) / (1000 * 60 * 60 * 24));

    let percent = 0;
    if (inspectionDate) {
        const start = new Date(inspectionDate);
        start.setHours(0, 0, 0, 0);
        const totalDays = Math.ceil((delivery - start) / (1000 * 60 * 60 * 24));
        if (totalDays > 0) {
            const elapsed = totalDays - daysLeft;
            percent = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
        }
    }

    return { daysLeft, percent };
}

function renderTracker(project, headers) {
    const orderedKeys = headers ? headers.map(h => headerToKey(h)) : Object.keys(project);

    // Find key fields
    const nameKey = orderedKeys.find(k => k === 'name') || orderedKeys.find(k => k.includes('name') && !k.includes('last'));
    const lastNameKey = orderedKeys.find(k => k.includes('last'));
    const claimKey = orderedKeys.find(k => k.includes('claim'));
    const stateKey = orderedKeys.find(k => k === 'state');
    const cityKey = orderedKeys.find(k => k === 'city');
    const inspectionKey = orderedKeys.find(k => k.includes('inspection'));
    const deliveryKey = orderedKeys.find(k => k.includes('delivery') || k.includes('expected'));
    const delayKey = orderedKeys.find(k => k.includes('delay'));

    const fullName = [project[nameKey], project[lastNameKey]].filter(Boolean).join(' ') || 'Client';
    const claimNum = claimKey ? project[claimKey] : '';
    const location = [project[cityKey], project[stateKey]].filter(Boolean).join(', ');
    const inspectionDate = inspectionKey ? project[inspectionKey] : '';
    const expectedDelivery = deliveryKey ? project[deliveryKey] : '';
    const delayReason = delayKey ? project[delayKey] : '';

    // Derive status from dates
    const { status, stageIndex } = deriveStatus(project, orderedKeys);
    const isDelayed = stageIndex === -1;
    const isCompleted = stageIndex === 3;
    const activeStage = isDelayed ? 2 : stageIndex;

    const { daysLeft, percent } = getDaysInfo(expectedDelivery, inspectionDate);

    // Format dates nicely
    const formatDate = (d) => {
        if (!d) return '-';
        try {
            const date = new Date(d);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return d; }
    };

    // ETA text
    let etaText, etaSub, etaClass;
    if (isCompleted) {
        etaText = 'Delivered';
        etaSub = 'Report has been delivered';
        etaClass = 'status-completed';
    } else if (isDelayed) {
        etaText = 'Delayed';
        etaSub = delayReason || 'Processing delay';
        etaClass = 'status-on-hold';
    } else if (daysLeft !== null) {
        if (daysLeft < 0) {
            etaText = `${Math.abs(daysLeft)} days overdue`;
            etaSub = `Was expected on ${formatDate(expectedDelivery)}`;
            etaClass = 'status-on-hold';
        } else if (daysLeft === 0) {
            etaText = 'Today';
            etaSub = 'Expected delivery is today';
            etaClass = '';
        } else if (daysLeft === 1) {
            etaText = 'Tomorrow';
            etaSub = 'Expected delivery is tomorrow';
            etaClass = '';
        } else {
            etaText = `${daysLeft} days`;
            etaSub = `Expected delivery: ${formatDate(expectedDelivery)}`;
            etaClass = '';
        }
    } else {
        etaText = status;
        etaSub = 'Delivery date pending';
        etaClass = 'status-pending';
    }

    // Progress bar width
    let barPercent;
    if (isCompleted) barPercent = 100;
    else if (isDelayed) barPercent = (2 / 3) * 100;
    else barPercent = (activeStage / 3) * 100;

    const vehiclePercent = isCompleted ? 92 : (percent > 0 ? Math.min(88, percent) : barPercent * 0.88);

    return `
        <div class="tracker-card">
            <div class="tracker-eta ${etaClass}">
                <div class="eta-label">Estimated Delivery</div>
                <div class="eta-value">${etaText}</div>
                <div class="eta-sublabel">${etaSub}</div>
            </div>

            <div class="tracker-info">
                <div class="tracker-project-name">${fullName}</div>
                <div class="tracker-project-id">${claimNum || location}</div>
            </div>

            <div class="delivery-vehicle">
                <div class="vehicle-start"></div>
                <div class="vehicle-road"></div>
                <div class="vehicle-icon" style="left: 0%" data-target="${vehiclePercent}">📋</div>
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
                        else if (i === activeStage && !isDelayed) stepClass = 'active';
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
                ${location ? `
                <div class="detail-row">
                    <span class="detail-row-label">Location</span>
                    <span class="detail-row-value">${location}</span>
                </div>` : ''}
                ${claimNum ? `
                <div class="detail-row">
                    <span class="detail-row-label">Claim Number</span>
                    <span class="detail-row-value">${claimNum}</span>
                </div>` : ''}
                <div class="detail-row">
                    <span class="detail-row-label">Status</span>
                    <span class="detail-row-value">${status}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-row-label">Inspection Date</span>
                    <span class="detail-row-value">${formatDate(inspectionDate)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-row-label">Expected Delivery</span>
                    <span class="detail-row-value">${formatDate(expectedDelivery)}</span>
                </div>
                ${delayReason ? `
                <div class="detail-row">
                    <span class="detail-row-label">Delay Reason</span>
                    <span class="detail-row-value" style="color: #E54D42;">${delayReason}</span>
                </div>` : ''}
            </div>
        </div>
    `;
}

function animateCards() {
    document.querySelectorAll('.timeline-bar-fill').forEach(bar => {
        setTimeout(() => { bar.style.width = bar.dataset.target + '%'; }, 200);
    });
    document.querySelectorAll('.vehicle-icon').forEach(icon => {
        setTimeout(() => { icon.style.left = icon.dataset.target + '%'; }, 300);
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
            resultsContainer.innerHTML = '<div class="no-results">No records found. Check the name or claim number and try again.</div>';
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

searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

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
