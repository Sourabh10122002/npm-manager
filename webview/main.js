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

// Global functions for inline onclick
window.switchTab = switchTab;
window.installPackage = installPackage;
window.uninstallPackage = uninstallPackage;
window.updatePackage = updatePackage;
window.updateAll = updateAll;
window.checkUpdates = checkUpdates;

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

// SVG Icons
const icons = {
    search: `<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.2"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
    box: `<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.2"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.97 4.44c-.31.17-.69.17-1 0L3.53 17.38c-.32-.17-.53-.5-.53-.88V7.5c0-.38.21-.71.53-.88l7.97-4.44c.31-.17.69-.17 1 0l7.97 4.44c.32.17.53.5.53.88v9zM12 4.15L5.04 8.02 12 11.89l6.96-3.87L12 4.15z"/></svg>`,
    info: `<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
    sparkle: `<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.2"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5 5.5-2.5-5.5-2.5z"/></svg>`,
    trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`
};

// Rendering Functions
function renderBrowse() {
    if (activeTab !== 'browse') return;

    if (!searchQuery) {
        packageList.innerHTML = `
            <div class="empty-state">
                ${icons.search}
                <p>Find packages in the official NPM registry</p>
            </div>
        `;
        return;
    }

    if (searchResults.length === 0 && !loading) {
        packageList.innerHTML = `
            <div class="empty-state">
                ${icons.info}
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
                    ${pkg.publisher ? `by ${pkg.publisher.username}` : 'unknown publisher'}
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
                ${icons.box}
                <p>Your package.json is empty</p>
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
                <div class="package-actions">
                    <button class="action-button danger" onclick="uninstallPackage('${name}')">
                        ${icons.trash} Uninstall
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
                <div class="package-actions">
                    <button class="action-button danger" onclick="uninstallPackage('${name}')">
                        ${icons.trash} Uninstall
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
                ${icons.sparkle}
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.5"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>
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
