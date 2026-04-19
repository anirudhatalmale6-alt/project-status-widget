// Uber-Style Inspection Tracker

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('resultsContainer');
const pinnedContainer = document.getElementById('pinnedContainer');
const emptyState = document.getElementById('emptyState');
const loadingIndicator = document.getElementById('loadingIndicator');

const STAGES = ['Scheduled', 'Inspection', 'Report Writing', 'Delivered'];
const STAGE_ICONS = {
    'Scheduled': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    'Inspection': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    'Report Writing': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    'Delivered': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};

// --- Pinned history (localStorage) ---
const PINNED_KEY = 'af_pinned_names';
const URGENCY_KEY = 'af_urgency';
const DELIVERY_REQ_KEY = 'af_delivery_requests';

function getPinned() {
    try { return JSON.parse(localStorage.getItem(PINNED_KEY)) || []; }
    catch { return []; }
}

function savePinned(list) {
    localStorage.setItem(PINNED_KEY, JSON.stringify(list));
}

function addPinned(name) {
    const list = getPinned();
    const norm = name.trim().toLowerCase();
    if (!list.find(p => p.toLowerCase() === norm)) {
        list.push(name.trim());
        savePinned(list);
    }
}

function removePinned(name) {
    const list = getPinned().filter(p => p.toLowerCase() !== name.trim().toLowerCase());
    savePinned(list);
}

// --- Urgency (localStorage) ---
function getUrgency() {
    try { return JSON.parse(localStorage.getItem(URGENCY_KEY)) || {}; }
    catch { return {}; }
}

function setUrgency(name, isUrgent) {
    const map = getUrgency();
    const key = name.trim().toLowerCase();
    if (isUrgent) map[key] = true;
    else delete map[key];
    localStorage.setItem(URGENCY_KEY, JSON.stringify(map));
}

function isUrgent(name) {
    return !!getUrgency()[name.trim().toLowerCase()];
}

// --- Delivery date requests (localStorage) ---
function getDeliveryRequests() {
    try { return JSON.parse(localStorage.getItem(DELIVERY_REQ_KEY)) || {}; }
    catch { return {}; }
}

function setDeliveryRequest(name, date) {
    const map = getDeliveryRequests();
    map[name.trim().toLowerCase()] = date;
    localStorage.setItem(DELIVERY_REQ_KEY, JSON.stringify(map));
}

function getDeliveryRequest(name) {
    return getDeliveryRequests()[name.trim().toLowerCase()] || null;
}

// --- Delivery sound ---
let deliverySoundPlayed = {};
function playDeliverySound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.4);
        });
    } catch (e) {}
}

function headerToKey(header) {
    return header.trim().toLowerCase().replace(/\s+/g, '_');
}

// Parse date string as local date (avoids UTC timezone shift)
function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!parts) return null;
    return new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
}

function deriveStatus(project, orderedKeys) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const inspectionKey = orderedKeys.find(k => k.includes('inspection'));
    const deliveryKey = orderedKeys.find(k => k.includes('delivery') || k.includes('expected'));
    const delayKey = orderedKeys.find(k => k.includes('delay'));

    const inspDate = inspectionKey ? parseLocalDate(project[inspectionKey]) : null;
    const delDate = deliveryKey ? parseLocalDate(project[deliveryKey]) : null;
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
    const delivery = parseLocalDate(expectedDelivery);
    if (!delivery) return { daysLeft: null, percent: 0 };
    const daysLeft = Math.round((delivery - now) / (1000 * 60 * 60 * 24));

    let percent = 0;
    if (inspectionDate) {
        const start = parseLocalDate(inspectionDate);
        if (!start) return { daysLeft, percent: 0 };
        const totalDays = Math.ceil((delivery - start) / (1000 * 60 * 60 * 24));
        if (totalDays > 0) {
            const elapsed = totalDays - daysLeft;
            percent = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
        }
    }

    return { daysLeft, percent };
}

function getHoursMinutesLeft(expectedDelivery) {
    if (!expectedDelivery) return null;
    const delivery = parseLocalDate(expectedDelivery);
    if (!delivery) return null;
    // Set delivery to end of day (5pm)
    delivery.setHours(17, 0, 0, 0);
    const now = new Date();
    const diff = delivery - now;
    if (diff <= 0) return { hours: 0, minutes: 0, total: 0 };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes, total: diff };
}

function renderTracker(project, headers, options = {}) {
    const orderedKeys = headers ? headers.map(h => headerToKey(h)) : Object.keys(project);
    const isPinned = options.isPinned || false;

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

    const { status, stageIndex } = deriveStatus(project, orderedKeys);
    const isDelayed = stageIndex === -1;
    const isCompleted = stageIndex === 3;
    const activeStage = isDelayed ? 2 : stageIndex;

    const { daysLeft, percent } = getDaysInfo(expectedDelivery, inspectionDate);
    const urgent = isUrgent(fullName);
    const requestedDate = getDeliveryRequest(fullName);

    // Play sound when delivered + urgent
    if (isCompleted && urgent && !deliverySoundPlayed[fullName.toLowerCase()]) {
        deliverySoundPlayed[fullName.toLowerCase()] = true;
        setTimeout(() => playDeliverySound(), 500);
    }

    const formatDate = (d) => {
        if (!d) return '-';
        const date = parseLocalDate(d);
        if (!date) return d;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // ETA text - use hours/minutes for urgent
    let etaText, etaSub, etaClass;
    if (isCompleted) {
        etaText = 'Delivered';
        etaSub = 'Report has been delivered';
        etaClass = 'status-completed';
    } else if (isDelayed) {
        etaText = 'Delayed';
        etaSub = delayReason || 'Processing delay';
        etaClass = 'status-on-hold';
    } else if (urgent && expectedDelivery) {
        const hm = getHoursMinutesLeft(expectedDelivery);
        if (hm && hm.total > 0) {
            etaText = `${hm.hours}h ${hm.minutes}m`;
            etaSub = `Expected delivery: ${formatDate(expectedDelivery)}`;
            etaClass = 'status-urgent';
        } else if (hm && hm.total <= 0) {
            etaText = 'Overdue';
            etaSub = `Was expected on ${formatDate(expectedDelivery)}`;
            etaClass = 'status-urgent';
        } else {
            etaText = 'Urgent';
            etaSub = 'Delivery date pending';
            etaClass = 'status-urgent';
        }
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

    let barPercent;
    if (isCompleted) barPercent = 100;
    else if (isDelayed) barPercent = (2 / 3) * 100;
    else barPercent = (activeStage / 3) * 100;

    const vehiclePercent = isCompleted ? 92 : (percent > 0 ? Math.min(88, percent) : barPercent * 0.88);

    const cardClass = `tracker-card${urgent && !isCompleted ? ' urgent-card' : ''}${isCompleted && isPinned ? ' delivered-card' : ''}`;
    const etaFullClass = `tracker-eta ${etaClass}${urgent && !isCompleted ? ' urgent-eta' : ''}`;
    const barFillClass = `timeline-bar-fill${isCompleted ? ' completed' : ''}${urgent && !isCompleted ? ' urgent-bar' : ''}`;

    // Urgency toggle button
    const urgencyBtnLabel = urgent ? 'URGENT' : 'Mark Urgent';
    const urgencyBtnClass = urgent ? 'urgency-btn active' : 'urgency-btn';

    return `
        <div class="${cardClass}" data-name="${fullName.replace(/"/g, '&quot;')}">
            <div class="${etaFullClass}">
                <div class="eta-top-row">
                    <div>
                        <div class="eta-label">Estimated Delivery</div>
                        <div class="eta-value">${etaText}</div>
                        <div class="eta-sublabel">${etaSub}</div>
                    </div>
                    <div class="card-actions">
                        <button class="${urgencyBtnClass}" onclick="toggleUrgency('${fullName.replace(/'/g, "\\'")}', this)" title="Toggle urgent tracking - shows countdown in hours/minutes and plays a sound on delivery">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            <span>${urgencyBtnLabel}</span>
                        </button>
                        <button class="info-btn" onclick="showInfoModal()" title="How urgency works">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            <div class="tracker-info">
                <div class="tracker-project-name">${fullName}</div>
                <div class="tracker-project-id">${claimNum || location}</div>
            </div>

            <div class="delivery-vehicle">
                <div class="vehicle-start"></div>
                <div class="vehicle-road${urgent && !isCompleted ? ' urgent-road' : ''}"></div>
                <div class="vehicle-icon" style="left: 0%" data-target="${vehiclePercent}">📋</div>
                <div class="vehicle-end">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#0a0a0a"/></svg>
                    <span class="vehicle-end-label">Delivery</span>
                </div>
            </div>

            <div class="tracker-timeline">
                <div class="timeline-track">
                    <div class="timeline-bar">
                        <div class="${barFillClass}" style="width: 0%" data-target="${barPercent}"></div>
                    </div>
                    ${STAGES.map((stage, i) => {
                        let stepClass = '';
                        if (isCompleted) stepClass = 'done';
                        else if (i < activeStage) stepClass = 'done';
                        else if (i === activeStage && !isDelayed) stepClass = 'active';
                        return `
                            <div class="timeline-step ${stepClass}${urgent && !isCompleted ? ' urgent-step' : ''}">
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
                ${requestedDate ? `
                <div class="detail-row">
                    <span class="detail-row-label">Requested Delivery</span>
                    <span class="detail-row-value" style="color: #F6AE2D;">${formatDate(requestedDate)}</span>
                </div>` : ''}
                ${delayReason ? `
                <div class="detail-row">
                    <span class="detail-row-label">Delay Reason</span>
                    <span class="detail-row-value" style="color: #E54D42;">${delayReason}</span>
                </div>` : ''}
            </div>

            ${!isCompleted ? `
            <div class="card-footer-actions">
                <button class="request-date-btn" onclick="showDeliveryModal('${fullName.replace(/'/g, "\\'")}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Request Delivery Date
                </button>
            </div>` : ''}
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

// --- Toggle urgency ---
function toggleUrgency(name, btn) {
    const nowUrgent = !isUrgent(name);
    setUrgency(name, nowUrgent);
    // Re-render everything
    refreshAll();
}

// --- Info modal ---
function showInfoModal() {
    const modal = document.getElementById('infoModal');
    modal.style.display = 'flex';
}

function closeInfoModal() {
    document.getElementById('infoModal').style.display = 'none';
}

// --- Delivery date request modal ---
let deliveryModalName = '';

function showDeliveryModal(name) {
    deliveryModalName = name;
    const modal = document.getElementById('deliveryModal');
    document.getElementById('deliveryModalName').textContent = name;
    document.getElementById('deliveryDateInput').value = '';
    document.getElementById('deliveryReason').value = '';
    modal.style.display = 'flex';
}

function closeDeliveryModal() {
    document.getElementById('deliveryModal').style.display = 'none';
}

async function submitDeliveryRequest() {
    const date = document.getElementById('deliveryDateInput').value;
    const reason = document.getElementById('deliveryReason').value.trim();
    if (!date) {
        alert('Please select a desired delivery date.');
        return;
    }

    const submitBtn = document.querySelector('#deliveryModal .modal-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
        const res = await fetch('/api/request-delivery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: deliveryModalName,
                requested_date: date,
                reason: reason
            })
        });
        const data = await res.json();
        if (data.success) {
            setDeliveryRequest(deliveryModalName, date);
            closeDeliveryModal();
            refreshAll();
        } else {
            alert(data.error || 'Failed to send request. Please try again.');
        }
    } catch (e) {
        alert('Connection error. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Request';
    }
}

// --- Search ---
async function doSearch(pinAfterSearch) {
    const query = searchInput.value.trim();
    if (!query) {
        resultsContainer.innerHTML = '';
        if (!getPinned().length) emptyState.style.display = '';
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

        // Auto-pin searched names
        if (pinAfterSearch !== false) {
            const orderedKeys = data.headers ? data.headers.map(h => headerToKey(h)) : [];
            const nameKey = orderedKeys.find(k => k === 'name') || orderedKeys.find(k => k.includes('name') && !k.includes('last'));
            const lastNameKey = orderedKeys.find(k => k.includes('last'));
            data.results.forEach(p => {
                const fn = [p[nameKey], p[lastNameKey]].filter(Boolean).join(' ');
                if (fn) addPinned(fn);
            });
        }

        // Filter out results that are already shown in pinned section
        const pinnedNames = getPinned().map(n => n.toLowerCase());
        const orderedKeysForFilter = data.headers ? data.headers.map(h => headerToKey(h)) : [];
        const nameKeyF = orderedKeysForFilter.find(k => k === 'name') || orderedKeysForFilter.find(k => k.includes('name') && !k.includes('last'));
        const lastNameKeyF = orderedKeysForFilter.find(k => k.includes('last'));

        const filteredResults = data.results.filter(p => {
            const fn = [p[nameKeyF], p[lastNameKeyF]].filter(Boolean).join(' ').trim().toLowerCase();
            return !pinnedNames.includes(fn);
        });

        resultsContainer.innerHTML = filteredResults.map(p => renderTracker(p, data.headers)).join('');
        requestAnimationFrame(() => animateCards());
    } catch (e) {
        resultsContainer.innerHTML = '<div class="no-results">Connection error. Please try again.</div>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// --- Pinned cards refresh ---
async function refreshPinned() {
    const pinned = getPinned();
    if (!pinned.length) {
        if (pinnedContainer) pinnedContainer.innerHTML = '';
        return;
    }

    try {
        const delivered = [];
        let html = '';
        for (const name of pinned) {
            const res = await fetch(`/api/search?q=${encodeURIComponent(name)}`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const orderedKeys = data.headers ? data.headers.map(h => headerToKey(h)) : Object.keys(data.results[0]);
                data.results.forEach(p => {
                    const { stageIndex } = deriveStatus(p, orderedKeys);
                    if (stageIndex === 3) {
                        delivered.push(name);
                    }
                    html += renderTracker(p, data.headers, { isPinned: true });
                });
            }
        }

        if (pinnedContainer) {
            if (html) {
                pinnedContainer.innerHTML = '<div class="pinned-header"><span>Your Tracked Inspections</span></div>' + html;
            } else {
                pinnedContainer.innerHTML = '';
            }
        }

        // Remove delivered after 30 seconds with fade
        if (delivered.length) {
            setTimeout(() => {
                delivered.forEach(name => {
                    removePinned(name);
                    setUrgency(name, false);
                });
                refreshPinned();
            }, 30000);
        }

        requestAnimationFrame(() => animateCards());
    } catch (e) {}
}

async function refreshAll() {
    await refreshPinned();
    const query = searchInput.value.trim();
    if (query) await doSearch(false);
    if (!getPinned().length && !query) emptyState.style.display = '';
    else emptyState.style.display = 'none';
}

// --- Event listeners ---
searchBtn.addEventListener('click', () => doSearch(true));
searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(true); });

let debounceTimer;
searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (searchInput.value.trim().length >= 2) doSearch(true);
        else if (searchInput.value.trim().length === 0) {
            resultsContainer.innerHTML = '';
            if (!getPinned().length) emptyState.style.display = '';
        }
    }, 400);
});

// Close modals on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

// Auto-refresh pinned cards on load
document.addEventListener('DOMContentLoaded', () => {
    refreshPinned();
    // Refresh urgent countdowns every minute
    setInterval(() => {
        const urgMap = getUrgency();
        if (Object.keys(urgMap).length > 0) refreshAll();
    }, 60000);
});
