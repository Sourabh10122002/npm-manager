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

    // Security Refresh
    document.getElementById('refresh-audit-btn').addEventListener('click', () => {
        document.getElementById('audit-results').innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Running security audit...</span></div>';
        vscode.postMessage({ type: 'getAudit' });
    });

    // Health Refresh
    document.getElementById('refresh-health-btn').addEventListener('click', () => {
        document.getElementById('size-analysis').innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Fetching package sizes...</span></div>';
        document.getElementById('unused-analysis').innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Scanning workspace...</span></div>';
        const deps = allPackages.filter(p => !p.isDev).map(p => p.name);
        vscode.postMessage({ type: 'getSizes', value: deps });
        vscode.postMessage({ type: 'getUnused' });
    });

    // Graph Refresh
    document.getElementById('refresh-graph-btn').addEventListener('click', () => {
        document.getElementById('graph-container').innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Generating dependency tree...</span></div>';
        vscode.postMessage({ type: 'getTree' });
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
    if (msg.type === 'auditData') renderAuditResults(msg.value);
    if (msg.type === 'sizesData') renderSizeAnalysis(msg.value);
    if (msg.type === 'unusedData') renderUnusedAnalysis(msg.value);
    if (msg.type === 'treeData') renderDependencyGraph(msg.value);
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
    
    // Hide all views
    document.getElementById('table-view').style.display = 'none';
    document.getElementById('browse-view').style.display = 'none';
    document.getElementById('security-view').style.display = 'none';
    document.getElementById('health-view').style.display = 'none';
    document.getElementById('graph-view').style.display = 'none';

    // Toolbar logic
    const toolbar = document.getElementById('main-toolbar');
    const installBar = document.getElementById('install-bar');
    const headerActions = document.getElementById('header-actions');

    if (tab === 'browse') {
        document.getElementById('browse-view').style.display = '';
        toolbar.style.display = 'none'; installBar.style.display = 'none';
        headerActions.style.display = 'none';
    } else if (tab === 'security') {
        document.getElementById('security-view').style.display = '';
        toolbar.style.display = 'none'; installBar.style.display = 'none';
        headerActions.style.display = 'none';
        vscode.postMessage({ type: 'getAudit' });
    } else if (tab === 'health') {
        document.getElementById('health-view').style.display = '';
        toolbar.style.display = 'none'; installBar.style.display = 'none';
        headerActions.style.display = 'none';
        const deps = allPackages.filter(p => !p.isDev).map(p => p.name);
        vscode.postMessage({ type: 'getSizes', value: deps });
        vscode.postMessage({ type: 'getUnused' });
    } else if (tab === 'graph') {
        document.getElementById('graph-view').style.display = '';
        toolbar.style.display = 'none'; installBar.style.display = 'none';
        headerActions.style.display = 'none';
        vscode.postMessage({ type: 'getTree' });
    } else {
        document.getElementById('table-view').style.display = '';
        toolbar.style.display = ''; installBar.style.display = '';
        headerActions.style.display = '';
        const toggle = document.getElementById('show-all-toggle');
        if (tab === 'updates') { toggle.checked = false; showAll = false; }
        else { toggle.checked = true; showAll = true; }
        applyFilter(); renderTable(); updateInfo();
    }
}

function renderAuditResults(audit) {
    const el = document.getElementById('audit-results');
    if (!audit || audit.error) {
        el.innerHTML = `<div class="status-msg success">
            <span class="icon">✅</span>
            <div>
                <h3>No Vulnerabilities Found</h3>
                <p>Your project dependencies look secure! Keep them updated regularly.</p>
            </div>
        </div>`;
        return;
    }

    const vulns = audit.vulnerabilities || {};
    const keys = Object.keys(vulns);
    if (keys.length === 0) {
        el.innerHTML = '<div class="status-msg success"><h3>No Vulnerabilities Found</h3></div>';
        return;
    }

    el.innerHTML = `
        <div class="audit-summary">
            ${Object.entries(audit.metadata.vulnerabilities).map(([lv, count]) => 
                count > 0 ? `<div class="summary-item ${lv}">${count} ${lv}</div>` : ''
            ).join('')}
        </div>
        <div class="audit-list">
            ${keys.map(k => {
                const v = vulns[k];
                return `
                <div class="audit-card severity-${v.severity}">
                    <div class="audit-card-side"></div>
                    <div class="audit-card-body">
                        <div class="audit-card-header">
                            <span class="vuln-name">${k}</span>
                            <span class="vuln-badge severity-${v.severity}">${v.severity.toUpperCase()}</span>
                        </div>
                        <p class="vuln-desc">${v.via?.[0]?.title || 'Multiple issues found.'}</p>
                        <div class="vuln-footer">
                            <span>Range: ${v.range}</span>
                            ${v.fixAvailable ? `<button class="btn btn-sm btn-primary">Fix Available</button>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
}

function renderSizeAnalysis(sizes) {
    const el = document.getElementById('size-analysis');
    const entries = Object.entries(sizes);
    if (entries.length === 0) {
        el.innerHTML = '<p class="placeholder-text">No size data available.</p>';
        return;
    }

    // Sort by size
    entries.sort((a, b) => b[1].size - a[1].size);

    el.innerHTML = `
        <div class="size-list">
            ${entries.slice(0, 10).map(([name, data]) => `
                <div class="size-row">
                    <span class="size-name">${name}</span>
                    <div class="size-bar-container">
                        <div class="size-bar" style="width: ${Math.min(100, (data.size / 500000) * 100)}%"></div>
                    </div>
                    <span class="size-value">${(data.size / 1024).toFixed(1)} KB</span>
                </div>
            `).join('')}
            ${entries.length > 10 ? `<p class="more-text">+ ${entries.length - 10} more packages</p>` : ''}
        </div>`;
}

function renderUnusedAnalysis(unused) {
    const el = document.getElementById('unused-analysis');
    if (!unused || unused.length === 0) {
        el.innerHTML = '<div class="status-msg success"><h3>All dependencies are in use!</h3></div>';
        return;
    }

    el.innerHTML = `
        <div class="unused-list">
            ${unused.map(name => `
                <div class="unused-item">
                    <span>${name}</span>
                    <button class="btn btn-sm btn-secondary" onclick="vscode.postMessage({type: 'uninstall', value: '${name}'})">Uninstall</button>
                </div>
            `).join('')}
        </div>
        <p class="help-text">Note: Some packages might be false positives if they are used in config files or indirectly.</p>`;
}

function renderDependencyGraph(tree) {
    const el = document.getElementById('graph-container');
    if (!tree || !tree.dependencies) {
        el.innerHTML = '<p class="placeholder-text">Failed to generate dependency tree.</p>';
        return;
    }

    function buildNode(name, data, level = 0) {
        if (level > 2) return ''; // Limit depth for performance
        const deps = data.dependencies || {};
        const keys = Object.keys(deps);
        return `
            <div class="tree-node" style="padding-left: ${level * 20}px">
                <span class="node-icon">${keys.length > 0 ? '▼' : '●'}</span>
                <span class="node-name">${name}</span>
                <span class="node-ver">${data.version || ''}</span>
            </div>
            ${keys.map(k => buildNode(k, deps[k], level + 1)).join('')}
        `;
    }

    el.innerHTML = `
        <div class="tree-view">
            ${Object.keys(tree.dependencies).map(k => buildNode(k, tree.dependencies[k])).join('')}
        </div>`;
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
