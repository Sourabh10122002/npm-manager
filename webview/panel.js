const vscode = acquireVsCodeApi();

let allPackages = [];
let filteredPackages = [];
let selectedPackages = new Set();
let filterQuery = '';
let sortCol = 'name';
let sortDir = 'asc';
let activeTab = 'installed';
let showAll = true;
let browseTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });

    // Filter
    document.getElementById('filter-input').addEventListener('input', e => {
        filterQuery = e.target.value.toLowerCase();
        applyFilter(); renderTable();
    });

    // Show all toggle
    document.getElementById('show-all-toggle').addEventListener('change', e => {
        showAll = e.target.checked;
        applyFilter(); renderTable(); updateInfo();
    });

    // Select all
    document.getElementById('select-all').addEventListener('change', e => {
        const updatable = filteredPackages.filter(p => p.hasUpdate);
        if (e.target.checked) updatable.forEach(p => selectedPackages.add(p.name));
        else selectedPackages.clear();
        renderTable(); updateSelectedCount();
    });

    // Update selected btn
    document.getElementById('update-selected-btn').addEventListener('click', () => {
        if (selectedPackages.size > 0) showDialog();
    });

    // Dialog
    document.getElementById('dialog-cancel').addEventListener('click', hideDialog);
    document.getElementById('dialog-confirm').addEventListener('click', confirmUpdate);
    document.getElementById('dialog-overlay').addEventListener('click', e => {
        if (e.target.id === 'dialog-overlay') hideDialog();
    });

    // Sort
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            if (sortCol === th.dataset.col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            else { sortCol = th.dataset.col; sortDir = 'asc'; }
            applyFilter(); renderTable(); updateSortIcons();
        });
    });

    // Browse
    document.getElementById('browse-input').addEventListener('input', e => {
        clearTimeout(browseTimer);
        const q = e.target.value.trim();
        if (!q) { document.getElementById('browse-results').innerHTML = '<p class="placeholder-text">Start typing to search packages...</p>'; return; }
        document.getElementById('browse-results').innerHTML = '<div class="browse-loading"><div class="spinner"></div></div>';
        browseTimer = setTimeout(() => vscode.postMessage({ type: 'search', value: q }), 400);
    });

    // Install
    document.getElementById('install-btn').addEventListener('click', doInstall);
    document.getElementById('install-input').addEventListener('keydown', e => { if (e.key === 'Enter') doInstall(); });

    // Initialize
    document.getElementById('show-all-toggle').checked = true;
    vscode.postMessage({ type: 'getPackages' });
});

function doInstall() {
    const name = document.getElementById('install-input').value.trim();
    const isDev = document.getElementById('install-dev').checked;
    if (!name) return;
    vscode.postMessage({ type: 'install', value: name, isDev });
    document.getElementById('install-input').value = '';
}

window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'packagesData') onPackagesData(msg.value);
    if (msg.type === 'searchResults') renderBrowseResults(msg.value);
});

function onPackagesData({ pkgJson, outdated }) {
    const deps = pkgJson?.dependencies || {};
    const devDeps = pkgJson?.devDependencies || {};
    const all = [
        ...Object.entries(deps).map(([n, v]) => ({ name: n, version: String(v).replace(/[\^~>=<]*/,''), isDev: false })),
        ...Object.entries(devDeps).map(([n, v]) => ({ name: n, version: String(v).replace(/[\^~>=<]*/,''), isDev: true }))
    ];
    allPackages = all.map(p => {
        const out = outdated[p.name];
        return {
            name: p.name, installed: p.version,
            latest: out?.latest || p.version,
            isDev: p.isDev, hasUpdate: !!out,
            updateType: out ? getUpdateType(p.version, out.latest) : null
        };
    });
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('pkg-table').style.display = '';
    applyFilter(); renderTable(); updateInfo();
}

function getUpdateType(cur, lat) {
    const c = ver(cur), l = ver(lat);
    if (!c || !l) return 'PATCH';
    if (l[0] > c[0]) return 'MAJOR';
    if (l[1] > c[1]) return 'MINOR';
    return 'PATCH';
}
function ver(v) {
    if (!v) return null;
    const p = String(v).replace(/[^\d.]/g,'').split('.').map(Number);
    return p.length >= 2 ? p : null;
}

function applyFilter() {
    let list = [...allPackages];
    if (!showAll && activeTab === 'updates') list = list.filter(p => p.hasUpdate);
    if (activeTab === 'updates' && showAll === false) list = list.filter(p => p.hasUpdate);
    if (filterQuery) list = list.filter(p => p.name.toLowerCase().includes(filterQuery));
    list.sort((a, b) => {
        const va = (a[sortCol] || '').toString().toLowerCase();
        const vb = (b[sortCol] || '').toString().toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    filteredPackages = list;
}

function renderTable() {
    const tbody = document.getElementById('pkg-tbody');
    const empty = document.getElementById('empty-state');
    if (filteredPackages.length === 0) { tbody.innerHTML = ''; empty.style.display = 'flex'; return; }
    empty.style.display = 'none';

    tbody.innerHTML = filteredPackages.map(p => {
        const sel = selectedPackages.has(p.name);
        const badgeCls = p.updateType ? `badge-${p.updateType.toLowerCase()}` : '';
        return `<tr class="pkg-row${sel ? ' selected' : ''}" data-name="${p.name}">
            <td class="col-check">${p.hasUpdate ? `<input type="checkbox" class="row-cb" data-name="${p.name}"${sel ? ' checked' : ''}>` : '<span class="dot"></span>'}</td>
            <td class="col-name">
                <div class="name-cell">
                    <span class="pkg-name">${p.name}</span>
                    ${p.isDev ? '<span class="dev-tag">dev</span>' : ''}
                </div>
            </td>
            <td class="col-ver"><span class="vtag v-installed">${p.installed}</span></td>
            <td class="col-ver"><span class="vtag ${p.hasUpdate ? 'v-latest' : 'v-installed'}">${p.latest}</span></td>
            <td class="col-type">${p.updateType ? `<span class="ubadge ${badgeCls}">${p.updateType}</span>` : '<span class="ok-mark">✓</span>'}</td>
            <td class="col-action">${p.hasUpdate ? `<button class="btn btn-update" data-name="${p.name}">Update</button>` : '<span class="up-to-date">Up to date</span>'}</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.row-cb').forEach(cb => {
        cb.addEventListener('change', e => {
            const n = e.target.dataset.name;
            if (e.target.checked) selectedPackages.add(n); else selectedPackages.delete(n);
            e.target.closest('.pkg-row').classList.toggle('selected', e.target.checked);
            updateSelectedCount();
        });
    });
    tbody.querySelectorAll('.btn-update').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.textContent = 'Updating...'; btn.disabled = true;
            vscode.postMessage({ type: 'update', value: btn.dataset.name });
        });
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const count = selectedPackages.size;
    document.getElementById('selected-count').textContent = count;
    document.getElementById('update-selected-btn').disabled = count === 0;
    const sa = document.getElementById('select-all');
    const upd = filteredPackages.filter(p => p.hasUpdate);
    sa.indeterminate = count > 0 && count < upd.length;
    sa.checked = upd.length > 0 && count === upd.length;
}

function updateInfo() {
    const total = allPackages.length;
    const outdated = allPackages.filter(p => p.hasUpdate).length;
    document.getElementById('pkg-info').innerHTML =
        `<strong>${filteredPackages.length}</strong> of <strong>${total}</strong> packages${outdated ? ` &bull; <span class="oi">${outdated} update${outdated !== 1 ? 's' : ''} available</span>` : ''}`;
}

function updateSortIcons() {
    document.querySelectorAll('.sortable').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        th.classList.toggle('sorted', th.dataset.col === sortCol);
        icon.textContent = th.dataset.col === sortCol ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';
    });
}

function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const tableView = document.getElementById('table-view');
    const browseView = document.getElementById('browse-view');
    const toolbar = document.getElementById('main-toolbar');
    const installBar = document.getElementById('install-bar');
    const headerActions = document.getElementById('header-actions');

    if (tab === 'browse') {
        tableView.style.display = 'none'; browseView.style.display = '';
        toolbar.style.display = 'none'; installBar.style.display = 'none';
        headerActions.style.display = 'none';
    } else {
        tableView.style.display = ''; browseView.style.display = 'none';
        toolbar.style.display = ''; installBar.style.display = '';
        headerActions.style.display = '';
        const toggle = document.getElementById('show-all-toggle');
        if (tab === 'updates') { toggle.checked = false; showAll = false; }
        else { toggle.checked = true; showAll = true; }
        applyFilter(); renderTable(); updateInfo();
    }
}

function renderBrowseResults(results) {
    const el = document.getElementById('browse-results');
    if (!results || results.length === 0) { el.innerHTML = '<p class="placeholder-text">No packages found.</p>'; return; }
    el.innerHTML = `<div class="browse-grid">${results.map(p => `
        <div class="bcard">
            <div class="bcard-header">
                <span class="bcard-name">${p.name}</span>
                <span class="bcard-ver">v${p.version}</span>
            </div>
            <p class="bcard-desc">${p.description || 'No description available.'}</p>
            <div class="bcard-footer">
                <span class="bcard-author">${p.publisher?.username ? 'by ' + p.publisher.username : ''}</span>
                <div class="bcard-actions">
                    <button class="btn btn-sm btn-primary binst" data-name="${p.name}">Install</button>
                    <button class="btn btn-sm btn-secondary binstdev" data-name="${p.name}">+ Dev</button>
                </div>
            </div>
        </div>`).join('')}</div>`;
    el.querySelectorAll('.binst').forEach(b => b.addEventListener('click', () => vscode.postMessage({ type: 'install', value: b.dataset.name, isDev: false })));
    el.querySelectorAll('.binstdev').forEach(b => b.addEventListener('click', () => vscode.postMessage({ type: 'install', value: b.dataset.name, isDev: true })));
}

function showDialog() {
    document.getElementById('dialog-count').textContent = selectedPackages.size;
    document.getElementById('dialog-list').innerHTML = [...selectedPackages].map(n => {
        const p = allPackages.find(x => x.name === n);
        return `<div class="drow"><span class="dname">${n}</span><span class="darrow">${p?.installed} → ${p?.latest}</span></div>`;
    }).join('');
    document.getElementById('dialog-overlay').style.display = 'flex';
}

function hideDialog() { document.getElementById('dialog-overlay').style.display = 'none'; }

function confirmUpdate() {
    [...selectedPackages].forEach(n => vscode.postMessage({ type: 'update', value: n }));
    selectedPackages.clear(); updateSelectedCount(); hideDialog();
    setTimeout(() => vscode.postMessage({ type: 'getPackages' }), 3000);
}
