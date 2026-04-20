// === Floating Mini Widget ===

const STAGES_FW = ['Scheduled', 'Inspection', 'Report Writing', 'Delivered'];
const STAGE_ICONS_FW = {
    'Scheduled': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>',
    'Inspection': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    'Report Writing': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    'Delivered': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};

// Reuse localStorage helpers from tracker.js (already loaded)

function fwDeriveStatus(project, keys) {
    const now = new Date(); now.setHours(0,0,0,0);
    const iKey = keys.find(k => k.includes('inspection'));
    const dKey = keys.find(k => k.includes('delivery') || k.includes('expected'));
    const dlKey = keys.find(k => k.includes('delay'));
    const iDate = iKey ? parseLocalDate(project[iKey]) : null;
    const dDate = dKey ? parseLocalDate(project[dKey]) : null;
    const hasDelay = dlKey && project[dlKey] && project[dlKey].trim() !== '';
    if (iDate) iDate.setHours(0,0,0,0);
    if (dDate) dDate.setHours(0,0,0,0);
    if (hasDelay) return { status: 'Delayed', stageIndex: -1 };
    if (dDate && now > dDate) return { status: 'Delivered', stageIndex: 3 };
    if (iDate && now >= iDate) return { status: 'Report Writing', stageIndex: 2 };
    if (iDate && now < iDate) return { status: 'Scheduled', stageIndex: 0 };
    return { status: 'Scheduled', stageIndex: 0 };
}

function fwGetCountdown(delivery, urgent) {
    if (!delivery) return '?';
    const d = parseLocalDate(delivery); if (!d) return '?';
    if (urgent) {
        d.setHours(17,0,0,0);
        const diff = d - new Date();
        if (diff <= 0) return 'Overdue';
        const days = Math.floor(diff / 86400000);
        const hrs = Math.floor((diff % 86400000) / 3600000);
        return days > 0 ? `${days}d ${hrs}h` : `${hrs}h`;
    }
    const now = new Date(); now.setHours(0,0,0,0);
    const days = Math.round((d - now) / 86400000);
    if (days < 0) return `${Math.abs(days)}d late`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days} days`;
}

function fwRenderCard(project, headers, expanded) {
    const keys = headers ? headers.map(h => headerToKey(h)) : Object.keys(project);
    const nameKey = keys.find(k => k === 'name') || keys.find(k => k.includes('name') && !k.includes('last'));
    const lastKey = keys.find(k => k.includes('last'));
    const cityKey = keys.find(k => k === 'city');
    const stateKey = keys.find(k => k === 'state');
    const inspKey = keys.find(k => k.includes('inspection'));
    const delKey = keys.find(k => k.includes('delivery') || k.includes('expected'));

    const name = [project[nameKey], project[lastKey]].filter(Boolean).join(' ') || 'Client';
    const location = [project[cityKey], project[stateKey]].filter(Boolean).join(', ');
    const { status, stageIndex } = fwDeriveStatus(project, keys);
    const delivery = delKey ? project[delKey] : '';
    const inspection = inspKey ? project[inspKey] : '';
    const urgent = isUrgent(name);
    const eta = fwGetCountdown(delivery, urgent);
    const isCompleted = stageIndex === 3;
    const isDelayed = stageIndex === -1;
    const activeStage = isDelayed ? 2 : stageIndex;

    const etaClass = isCompleted ? 'delivered' : (urgent || isDelayed) ? 'urgent' : '';
    const cardClass = `fw-card${urgent && !isCompleted ? ' urgent' : ''}${expanded ? ' expanded' : ''}`;

    const fmtDate = (d) => {
        if (!d) return '-';
        const dt = parseLocalDate(d);
        return dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : d;
    };

    const stepsHtml = STAGES_FW.map((s, i) => {
        let cls = '';
        if (isCompleted) cls = 'done';
        else if (i < activeStage) cls = 'done';
        else if (i === activeStage && !isDelayed) cls = 'active' + (urgent ? ' urgent-s' : '');
        return `<div class="fw-step ${cls}"><div class="fw-step-dot">${STAGE_ICONS_FW[s]}</div><span class="fw-step-label">${s}</span></div>`;
    }).join('');

    const urgBtnClass = urgent ? 'fw-urgent-btn active' : 'fw-urgent-btn';
    const urgLabel = urgent ? 'URGENT' : 'Mark Urgent';

    return `<div class="${cardClass}" data-name="${name.replace(/"/g, '&quot;')}">
        <div class="fw-row" onclick="fwToggleCard(this)">
            <span class="fw-name">${name}</span>
            <span class="fw-eta ${etaClass}">${eta}</span>
            <svg class="fw-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="fw-detail">
            <div class="fw-steps">${stepsHtml}</div>
            <div class="fw-info-row"><span class="fw-info-label">Status</span><span class="fw-info-value">${status}</span></div>
            ${location ? `<div class="fw-info-row"><span class="fw-info-label">Location</span><span class="fw-info-value">${location}</span></div>` : ''}
            <div class="fw-info-row"><span class="fw-info-label">Inspection</span><span class="fw-info-value">${fmtDate(inspection)}</span></div>
            <div class="fw-info-row"><span class="fw-info-label">Delivery</span><span class="fw-info-value">${fmtDate(delivery)}</span></div>
            ${!isCompleted ? `<button class="${urgBtnClass}" onclick="event.stopPropagation(); fwToggleUrgency('${name.replace(/'/g, "\\'")}', this)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                ${urgLabel}
            </button>` : ''}
        </div>
    </div>`;
}

function fwToggleCard(row) {
    row.closest('.fw-card').classList.toggle('expanded');
}

function fwToggleUrgency(name, btn) {
    const nowUrg = !isUrgent(name);
    setUrgency(name, nowUrg);
    const card = btn.closest('.fw-card');
    if (nowUrg) {
        btn.classList.add('active');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg> URGENT';
        card.classList.add('urgent');
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg> Mark Urgent';
        card.classList.remove('urgent');
    }
    fetch('/api/notify-urgent', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name, urgent: nowUrg}) }).catch(()=>{});
    setTimeout(() => fwDoSearch(false), 300);
}

let fwCurrentSearchNames = [];

async function fwDoSearch(pin) {
    const q = document.getElementById('fwSearchInput').value.trim();
    const results = document.getElementById('fwResults');
    const empty = document.getElementById('fwEmpty');

    if (!q) {
        results.innerHTML = '';
        if (empty) { results.appendChild(empty); empty.style.display = ''; }
        fwCurrentSearchNames = [];
        await fwRefreshPinned();
        return;
    }
    if (empty) empty.style.display = 'none';

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();

        if (!data.results || !data.results.length) {
            fwCurrentSearchNames = [];
            let html = '<div class="fw-not-found">Not found</div>';
            html += await fwGetPinnedHtml();
            results.innerHTML = html;
            return;
        }

        const keys = data.headers ? data.headers.map(h => headerToKey(h)) : [];
        const nk = keys.find(k => k === 'name') || keys.find(k => k.includes('name') && !k.includes('last'));
        const lk = keys.find(k => k.includes('last'));
        fwCurrentSearchNames = data.results.map(p => [p[nk], p[lk]].filter(Boolean).join(' ').trim().toLowerCase());

        let html = data.results.map(p => fwRenderCard(p, data.headers, true)).join('');

        if (pin !== false) {
            data.results.forEach(p => {
                const fn = [p[nk], p[lk]].filter(Boolean).join(' ');
                if (fn) addPinned(fn);
            });
        }

        html += await fwGetPinnedHtml();
        results.innerHTML = html;
    } catch(e) {
        results.innerHTML = '<div class="fw-not-found">Connection error</div>';
    }
}

async function fwGetPinnedHtml() {
    const pinned = getPinned().filter(n => !fwCurrentSearchNames.includes(n.toLowerCase()));
    if (!pinned.length) return '';
    let html = '<div class="fw-history-label">History</div>';
    for (const name of pinned) {
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(name)}`);
            const data = await res.json();
            if (data.results && data.results.length) {
                html += data.results.map(p => fwRenderCard(p, data.headers, false)).join('');
            }
        } catch(e) {}
    }
    return html;
}

async function fwRefreshPinned() {
    const results = document.getElementById('fwResults');
    const existing = results.querySelector('.fw-history-label');
    if (existing) {
        while (existing.nextSibling) existing.nextSibling.remove();
        existing.remove();
    }
    const html = await fwGetPinnedHtml();
    results.insertAdjacentHTML('beforeend', html);
}

// === Toggle floating widget mode ===
function toggleFloatingWidget() {
    const fw = document.getElementById('floatingWidget');
    const bubble = document.getElementById('fwBubble');
    const body = document.body;

    if (fw.style.display === 'none' || !fw.style.display) {
        fw.style.display = 'flex';
        bubble.style.display = 'none';
        body.classList.add('widget-mode-active');
        document.getElementById('fwSearchInput').focus();
        fwRefreshPinned();
    } else {
        fw.style.display = 'none';
        bubble.style.display = 'none';
        body.classList.remove('widget-mode-active');
    }
}

function minimizeWidget() {
    document.getElementById('floatingWidget').style.display = 'none';
    document.getElementById('fwBubble').style.display = 'flex';
}

function restoreWidget() {
    document.getElementById('floatingWidget').style.display = 'flex';
    document.getElementById('fwBubble').style.display = 'none';
    document.getElementById('fwSearchInput').focus();
}

// === Dragging ===
(function() {
    const handle = document.getElementById('fwDragHandle');
    const widget = document.getElementById('floatingWidget');
    let isDragging = false, startX, startY, origX, origY;

    if (!handle || !widget) return;

    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = widget.getBoundingClientRect();
        origX = rect.left;
        origY = rect.top;
        widget.style.transition = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        widget.style.left = (origX + dx) + 'px';
        widget.style.top = (origY + dy) + 'px';
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        widget.style.transition = '';
    });

    // Touch support
    handle.addEventListener('touchstart', (e) => {
        if (e.target.closest('button')) return;
        isDragging = true;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        const rect = widget.getBoundingClientRect();
        origX = rect.left;
        origY = rect.top;
        widget.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        widget.style.left = (origX + dx) + 'px';
        widget.style.top = (origY + dy) + 'px';
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
    }, { passive: true });

    document.addEventListener('touchend', () => { isDragging = false; widget.style.transition = ''; });
})();

// === Search event listeners ===
document.getElementById('fwSearchBtn')?.addEventListener('click', () => fwDoSearch(true));
document.getElementById('fwSearchInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') fwDoSearch(true); });

let fwDebounce;
document.getElementById('fwSearchInput')?.addEventListener('input', () => {
    clearTimeout(fwDebounce);
    fwDebounce = setTimeout(() => {
        if (document.getElementById('fwSearchInput').value.trim().length >= 2) fwDoSearch(true);
    }, 400);
});
