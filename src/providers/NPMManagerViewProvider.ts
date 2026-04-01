import * as vscode from 'vscode';
import * as path from 'path';
import { NpmManager } from '../manager/NpmManager';

export class NPMManagerViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'npm-manager-view';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _npmManager: NpmManager
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'onInstalled': {
                    const packageJson = this._npmManager.readPackageJson();
                    webviewView.webview.postMessage({ type: 'packages', value: packageJson });
                    break;
                }
                case 'search': {
                    const results = await this._npmManager.searchPackages(data.value);
                    webviewView.webview.postMessage({ type: 'searchResults', value: results });
                    break;
                }
                case 'install': {
                    await this._npmManager.installPackage(data.value, data.isDev);
                    break;
                }
                case 'uninstall': {
                    await this._npmManager.uninstallPackage(data.value);
                    break;
                }
                case 'getUpdates': {
                    const updates = await this._npmManager.getOutdatedPackages();
                    webviewView.webview.postMessage({ type: 'updates', value: updates });
                    break;
                }
                case 'update': {
                    await this._npmManager.updatePackage(data.value);
                    break;
                }
            }
        });

        // Set up file watcher for package.json
        const watcher = vscode.workspace.createFileSystemWatcher('**/package.json');
        watcher.onDidChange(() => this.refresh());
        watcher.onDidCreate(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
    }

    public refresh() {
        if (this._view) {
            const packageJson = this._npmManager.readPackageJson();
            this._view.webview.postMessage({ type: 'packages', value: packageJson });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview', 'style.css'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <link href="${styleUri}" rel="stylesheet">
                <title>NPM Manager</title>
            </head>
            <body>
                <div class="app-container">
                    <div class="tabs-header">
                        <div id="tab-browse" class="tab-item active" onclick="switchTab('browse')">🔍 Browse</div>
                        <div id="tab-installed" class="tab-item" onclick="switchTab('installed')">📦 Installed</div>
                        <div id="tab-updates" class="tab-item" onclick="switchTab('updates')">
                            <div class="tab-icon-wrapper">
                                ⬆️ <span id="update-badge" class="notification-badge" style="display: none;"></span>
                            </div>
                            Updates
                        </div>
                    </div>
                    <div class="content-area">
                        <div id="loading-bar" class="loading-bar" style="display: none;">
                            <div class="loading-progress"></div>
                        </div>
                        <div id="browse-search" class="search-bar-sticky">
                            <div class="search-input-wrapper">
                                <span class="search-icon">🔍</span>
                                <input type="text" id="package-search-input" class="search-input" placeholder="Search packages..." autofocus>
                            </div>
                        </div>
                        <div id="updates-header" class="search-bar-sticky" style="display: none;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span id="updates-info" class="section-info">0 updates found</span>
                                <div style="display: flex; gap: 8px;">
                                    <button class="action-button secondary" id="refresh-btn">🔄 Refresh</button>
                                    <button id="update-all-btn" class="action-button primary" style="display: none;">Update All</button>
                                </div>
                            </div>
                        </div>
                        <div id="package-list" class="package-list-scrollable"></div>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

