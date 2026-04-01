// VS Code API
const vscode = acquireVsCodeApi();

// State
let activeTab = 'browse';
let searchQuery = '';
let searchResults = [];
let installedPackages = { dependencies: {}, devDependencies: {} };
let outdatedPackages = {};
let loading = false;
let searchTimeout;

// DOM Elements
const packageList = document.getElementById('package-list');
const loadingBar = document.getElementById('loading-bar');
const browseSearch = document.getElementById('browse-search');
const updatesHeader = document.getElementById('updates-header');
const updatesInfo = document.getElementById('updates-info');
const updateBadge = document.getElementById('update-badge');
const updateAllBtn = document.getElementById('update-all-btn');
const searchInput = document.getElementById('package-search-input');

// Initial Setup
window.addEventListener('load', () => {
    switchTab('browse');
    
    // Event Listeners
    searchInput.addEventListener('input', handleSearchInput);
    
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', checkUpdates);

    if (updateAllBtn) updateAllBtn.addEventListener('click', updateAll);
});

// Message Handling from VS Code
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'packages':
            installedPackages = {
                dependencies: message.value?.dependencies || {},
                devDependencies: message.value?.devDependencies || {}
            };
            setLoading(false);
            if (activeTab === 'installed') renderInstalled();
            break;
        case 'searchResults':
            searchResults = message.value || [];
            setLoading(false);
            if (activeTab === 'browse') renderBrowse();
            break;
        case 'updates':
            outdatedPackages = message.value || {};
            setLoading(false);
            updateBadge.style.display = Object.keys(outdatedPackages).length > 0 ? 'block' : 'none';
            if (activeTab === 'updates') renderUpdates();
            break;
    }
});

// Global functions for inline onclick (if still used) or just use listeners
window.switchTab = switchTab;
window.installPackage = installPackage;
window.uninstallPackage = uninstallPackage;
window.updatePackage = updatePackage;

// UI Actions
function switchTab(tab) {
    activeTab = tab;
    
    // Update Tab UI
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Update Header Visibility
    browseSearch.style.display = tab === 'browse' ? 'block' : 'none';
    updatesHeader.style.display = tab === 'updates' ? 'block' : 'none';

    // Reset Scroll
    packageList.scrollTop = 0;

    // Fetch Data
    if (tab === 'installed') {
        setLoading(true);
        vscode.postMessage({ type: 'onInstalled' });
        renderInstalled();
    } else if (tab === 'updates') {
        setLoading(true);
        vscode.postMessage({ type: 'getUpdates' });
        renderUpdates();
    } else {
        renderBrowse();
    }
}

function handleSearchInput(event) {
    searchQuery = event.target.value;
    clearTimeout(searchTimeout);

    if (!searchQuery) {
        searchResults = [];
        renderBrowse();
        return;
    }

    searchTimeout = setTimeout(() => {
        setLoading(true);
        vscode.postMessage({ type: 'search', value: searchQuery });
    }, 500);
}

function setLoading(isLoading) {
    loading = isLoading;
    loadingBar.style.display = isLoading ? 'block' : 'none';
    const refreshIcon = document.getElementById('refresh-icon');
    if (refreshIcon) {
        if (isLoading) refreshIcon.classList.add('spinning');
        else refreshIcon.classList.remove('spinning');
    }
}

// Rendering Functions
function renderBrowse() {
    if (activeTab !== 'browse') return;

    if (!searchQuery) {
        packageList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; opacity: 0.2;">🔍</div>
                <p>Search for packages in the NPM registry</p>
            </div>
        `;
        return;
    }

    if (searchResults.length === 0 && !loading) {
        packageList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; opacity: 0.2;">ℹ️</div>
                <p>No results found for "${searchQuery}"</p>
            </div>
        `;
        return;
    }

    packageList.innerHTML = searchResults.map(pkg => `
        <div class="package-card">
            <div class="package-header">
                <span class="package-name">${pkg.name}</span>
                <span class="package-version">v${pkg.version}</span>
            </div>
            <p class="package-desc">${pkg.description || 'No description available.'}</p>
            <div class="package-footer">
                <div class="package-meta">
                    ${pkg.publisher ? `by ${pkg.publisher.username}` : ''}
                </div>
                <div class="package-actions">
                    <button class="action-button primary" onclick="installPackage('${pkg.name}', false)">
                        Install
                    </button>
                    <button class="action-button secondary" title="Install as devDependency" onclick="installPackage('${pkg.name}', true)">
                        + Dev
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderInstalled() {
    if (activeTab !== 'installed') return;

    const hasDeps = Object.keys(installedPackages.dependencies).length > 0;
    const hasDevDeps = Object.keys(installedPackages.devDependencies).length > 0;

    if (!hasDeps && !hasDevDeps && !loading) {
        packageList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; opacity: 0.2;">📚</div>
                <p>No packages found in package.json</p>
            </div>
        `;
        return;
    }

    let html = '';
    
    if (hasDeps) {
        html += `<h3 class="section-title">Dependencies</h3>`;
        html += Object.entries(installedPackages.dependencies).map(([name, version]) => `
            <div class="package-card">
                <div class="package-header">
                    <span class="package-name">${name}</span>
                    <span class="package-version">${version}</span>
                </div>
                <div class="package-actions-installed">
                    <button class="action-button danger" onclick="uninstallPackage('${name}')">
                        🗑️ Uninstall
                    </button>
                </div>
            </div>
        `).join('');
    }

    if (hasDevDeps) {
        html += `<h3 class="section-title">Dev Dependencies</h3>`;
        html += Object.entries(installedPackages.devDependencies).map(([name, version]) => `
            <div class="package-card">
                <div class="package-header">
                    <span class="package-name">${name}</span>
                    <span class="package-version">${version}</span>
                </div>
                <div class="package-actions-installed">
                    <button class="action-button danger" onclick="uninstallPackage('${name}')">
                        🗑️ Uninstall
                    </button>
                </div>
            </div>
        `).join('');
    }

    packageList.innerHTML = html;
}

function renderUpdates() {
    if (activeTab !== 'updates') return;

    const count = Object.keys(outdatedPackages).length;
    updatesInfo.innerText = `${count} update${count === 1 ? '' : 's'} found`;
    updateAllBtn.style.display = count > 0 ? 'flex' : 'none';

    if (count === 0 && !loading) {
        packageList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; opacity: 0.2;">✨</div>
                <p>Everything is up to date!</p>
            </div>
        `;
        return;
    }

    packageList.innerHTML = Object.entries(outdatedPackages).map(([name, info]) => `
        <div class="package-card">
            <div class="package-header">
                <span class="package-name">${name}</span>
                <div class="version-diff">
                    <span class="package-version old">${info.current}</span>
                    → 
                    <span class="package-version new">${info.latest}</span>
                </div>
            </div>
            <div class="package-footer">
                <span class="package-meta">Wanted: ${info.wanted}</span>
                <button class="action-button primary" onclick="updatePackage('${name}')">
                    Update
                </button>
            </div>
        </div>
    `).join('');
}

// Extension API Wrappers
function installPackage(name, isDev) {
    vscode.postMessage({ type: 'install', value: name, isDev });
}

function uninstallPackage(name) {
    vscode.postMessage({ type: 'uninstall', value: name });
}

function updatePackage(name) {
    vscode.postMessage({ type: 'update', value: name });
}

function updateAll() {
    vscode.postMessage({ type: 'update', value: '' });
}

function checkUpdates() {
    setLoading(true);
    vscode.postMessage({ type: 'getUpdates' });
}
