import * as vscode from 'vscode';
import { NpmManager } from '../manager/NpmManager';

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export class NPMManagerPanel {
    public static currentPanel: NPMManagerPanel | undefined;
    private static readonly viewType = 'npmManagerPanel';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _npmManager: NpmManager;
    private readonly _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, npmManager: NpmManager) {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

        if (NPMManagerPanel.currentPanel) {
            NPMManagerPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            NPMManagerPanel.viewType,
            'NPM Manager',
            column,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true
            }
        );

        NPMManagerPanel.currentPanel = new NPMManagerPanel(panel, extensionUri, npmManager);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, npmManager: NpmManager) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._npmManager = npmManager;

        this._panel.webview.html = this._getHtml(this._panel.webview);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'getPackages': {
                    const pkgJson = npmManager.readPackageJson();
                    const outdated = await npmManager.getOutdatedPackages();
                    this._panel.webview.postMessage({ type: 'packagesData', value: { pkgJson, outdated } });
                    break;
                }
                case 'install': {
                    await npmManager.installPackage(data.value, data.isDev);
                    const pkgJson = npmManager.readPackageJson();
                    const outdated = await npmManager.getOutdatedPackages();
                    this._panel.webview.postMessage({ type: 'packagesData', value: { pkgJson, outdated } });
                    break;
                }
                case 'uninstall': {
                    await npmManager.uninstallPackage(data.value);
                    break;
                }
                case 'update': {
                    await npmManager.updatePackage(data.value);
                    break;
                }
                case 'search': {
                    const results = await npmManager.searchPackages(data.value);
                    this._panel.webview.postMessage({ type: 'searchResults', value: results });
                    break;
                }
                case 'getAudit': {
                    const audit = await npmManager.getAuditReport();
                    this._panel.webview.postMessage({ type: 'auditData', value: audit });
                    break;
                }
                case 'getSizes': {
                    const packages = data.value as string[];
                    const sizes: any = {};
                    // Fetch sizes sequentially or with small concurrency to avoid rate limiting
                    for (const pkg of packages) {
                        const sizeInfo = await npmManager.getBundleSize(pkg);
                        if (sizeInfo) sizes[pkg] = sizeInfo;
                    }
                    this._panel.webview.postMessage({ type: 'sizesData', value: sizes });
                    break;
                }
                case 'getTree': {
                    const tree = await npmManager.getDependencyTree();
                    this._panel.webview.postMessage({ type: 'treeData', value: tree });
                    break;
                }
                case 'getUnused': {
                    const unused = await npmManager.getUnusedDependencies();
                    this._panel.webview.postMessage({ type: 'unusedData', value: unused });
                    break;
                }
            }
        }, null, this._disposables);
    }

    public dispose() {
        NPMManagerPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) d.dispose();
        }
    }

    private _getHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'panel.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'panel-style.css'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link rel="stylesheet" href="${styleUri}">
    <title>NPM Manager</title>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <span class="app-icon">⬡</span>
            <h1 class="app-title">NPM Visual Manager</h1>
        </div>
        <div class="header-right" id="header-actions" style="display:none;">
            <button class="btn btn-secondary" id="rollback-btn">⎌ Rollback</button>
            <button class="btn btn-primary" id="update-selected-btn" disabled>↑ Update Selected (<span id="selected-count">0</span>)</button>
        </div>
    </div>

    <div class="tabs-bar">
        <button class="tab-btn active" data-tab="installed">Installed</button>
        <button class="tab-btn" data-tab="updates">Updates</button>
        <button class="tab-btn" data-tab="browse">Browse Registry</button>
        <button class="tab-btn" data-tab="security">Security Audit</button>
        <button class="tab-btn" data-tab="health">Package Health</button>
        <button class="tab-btn" data-tab="graph">Dependency Graph</button>
    </div>

    <div class="toolbar" id="main-toolbar">
        <div class="toolbar-left">
            <div class="search-wrapper">
                <svg class="search-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input type="text" id="filter-input" class="filter-input" placeholder="Filter packages...">
            </div>
            <span class="pkg-info" id="pkg-info"></span>
        </div>
        <div class="toolbar-right">
            <label class="toggle-label"><input type="checkbox" id="show-all-toggle"> Show All Packages</label>
        </div>
    </div>

    <div class="table-wrapper" id="table-view">
        <div class="loading-state" id="loading-state"><div class="spinner"></div><span>Loading packages...</span></div>
        <div class="empty-state" id="empty-state" style="display:none;"><div class="empty-icon">📦</div><p>No packages found</p></div>
        <table class="pkg-table" id="pkg-table" style="display:none;">
            <thead>
                <tr>
                    <th class="col-check"><input type="checkbox" id="select-all"></th>
                    <th class="col-name sortable" data-col="name">Package <span class="sort-icon">↕</span></th>
                    <th class="col-ver sortable" data-col="installed">Installed <span class="sort-icon">↕</span></th>
                    <th class="col-ver sortable" data-col="latest">Latest <span class="sort-icon">↕</span></th>
                    <th class="col-type">Update</th>
                    <th class="col-action">Action</th>
                </tr>
            </thead>
            <tbody id="pkg-tbody"></tbody>
        </table>
    </div>

    <div class="browse-view" id="browse-view" style="display:none;">
        <div class="browse-header">
            <div class="search-wrapper large">
                <svg class="search-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input type="text" id="browse-input" class="filter-input" placeholder="Search the NPM registry...">
            </div>
        </div>
        <div id="browse-results" class="browse-results"><p class="placeholder-text">Start typing to search packages...</p></div>
    </div>

    <div class="security-view" id="security-view" style="display:none;">
        <div class="view-header">
            <h2>NPM Audit Security Report</h2>
            <button class="btn btn-primary" id="refresh-audit-btn">Run New Audit</button>
        </div>
        <div id="audit-results" class="audit-results"><div class="loading-state"><div class="spinner"></div><span>Running security audit...</span></div></div>
    </div>

    <div class="health-view" id="health-view" style="display:none;">
        <div class="view-header">
            <h2>Package Health & Performance</h2>
            <button class="btn btn-primary" id="refresh-health-btn">Refresh Analysis</button>
        </div>
        <div class="health-grid">
            <div class="health-card">
                <h3>Bundle Size Impact</h3>
                <div id="size-analysis" class="analysis-content"><div class="loading-state"><div class="spinner"></div><span>Fetching package sizes...</span></div></div>
            </div>
            <div class="health-card">
                <h3>Unused Dependencies</h3>
                <div id="unused-analysis" class="analysis-content"><div class="loading-state"><div class="spinner"></div><span>Scanning workspace...</span></div></div>
            </div>
        </div>
    </div>

    <div class="graph-view" id="graph-view" style="display:none;">
        <div class="view-header">
            <h2>Dependency Relationship Graph</h2>
            <button class="btn btn-primary" id="refresh-graph-btn">Refresh Graph</button>
        </div>
        <div class="graph-container" id="graph-container">
            <div class="loading-state"><div class="spinner"></div><span>Generating dependency tree...</span></div>
        </div>
    </div>

    <div class="install-bar" id="install-bar">
        <span class="install-label">INSTALL</span>
        <div class="search-wrapper">
            <input type="text" id="install-input" class="filter-input" placeholder="Package name...">
        </div>
        <label class="toggle-label"><input type="checkbox" id="install-dev"> --save-dev</label>
        <button class="btn btn-primary" id="install-btn">Install</button>
    </div>

    <div class="dialog-overlay" id="dialog-overlay" style="display:none;">
        <div class="dialog">
            <h2 class="dialog-title">Update Selected Packages</h2>
            <p class="dialog-desc">Are you sure you want to update <strong id="dialog-count">0</strong> selected packages?</p>
            <div id="dialog-list" class="dialog-list"></div>
            <div class="dialog-actions">
                <button class="btn btn-secondary" id="dialog-cancel">Cancel</button>
                <button class="btn btn-primary" id="dialog-confirm">Update Selected</button>
            </div>
        </div>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}
