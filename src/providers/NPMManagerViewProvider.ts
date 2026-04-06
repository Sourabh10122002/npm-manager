import * as vscode from 'vscode';
import { NpmManager } from '../manager/NpmManager';
import { NPMManagerPanel } from '../panels/NPMManagerPanel';

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export class NPMManagerViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'npm-manager-view';
    private _view?: vscode.WebviewView;
    private readonly _npmManager: NpmManager;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        npmManager: NpmManager
    ) {
        this._npmManager = npmManager;
    }

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

        webviewView.webview.html = this._getSidebarHtml(webviewView.webview);

        webviewView.webview.onDidReceiveMessage((data) => {
            if (data.type === 'openPanel') {
                NPMManagerPanel.createOrShow(this._extensionUri, this._npmManager);
            }
        });
    }

    public refresh() {}

    private _getSidebarHtml(webview: vscode.Webview): string {
        const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'icon.png'));
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--vscode-font-family);
            font-size: 12px;
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            padding: 16px;
            overflow-x: hidden;
        }
        .center { text-align: center; }
        .icon-wrap { display: flex; justify-content: center; margin-bottom: 14px; }
        .ext-icon { width: 72px; height: 72px; border-radius: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        .ext-name { font-size: 13px; font-weight: 700; text-align: center; margin-bottom: 6px; }
        .version { display: inline-block; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 10px; padding: 2px 9px; font-size: 10px; }
        .desc { color: var(--vscode-descriptionForeground); line-height: 1.55; text-align: center; margin: 14px 0; font-size: 11px; }
        .open-btn {
            display: flex; align-items: center; justify-content: center; gap: 7px;
            width: 100%; padding: 9px 14px; margin-bottom: 8px;
            background: var(--vscode-button-background); color: var(--vscode-button-foreground);
            border: none; border-radius: 6px; font-size: 12px; font-weight: 600;
            cursor: pointer; transition: background 0.15s;
        }
        .open-btn:hover { background: var(--vscode-button-hoverBackground); }
        .shortcut { color: var(--vscode-descriptionForeground); text-align: center; font-size: 10px; margin-bottom: 20px; line-height: 1.5; }
        kbd { background: var(--vscode-keybindingLabel-background, rgba(128,128,128,0.17)); border: 1px solid var(--vscode-keybindingLabel-border, rgba(128,128,128,0.4)); border-radius: 3px; padding: 1px 5px; font-size: 10px; }
        hr { border: none; border-top: 1px solid var(--vscode-editorGroup-border, rgba(128,128,128,0.2)); margin: 14px 0; }
        .section-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: var(--vscode-descriptionForeground); text-transform: uppercase; margin-bottom: 8px; }
        .link { display: flex; align-items: center; gap: 7px; color: var(--vscode-textLink-foreground); text-decoration: none; padding: 5px 0; font-size: 11px; }
        .link:hover { text-decoration: underline; }
        .tip { color: var(--vscode-descriptionForeground); padding: 4px 0; font-size: 11px; line-height: 1.45; display: flex; gap: 6px; }
        .tip::before { content: "→"; opacity: 0.5; flex-shrink: 0; }
    </style>
</head>
<body>
    <div class="icon-wrap">
        <img class="ext-icon" src="${iconUri}" alt="NPM Manager Icon">
    </div>
    <p class="ext-name">NPM Visual Manager</p>
    <div class="center" style="margin-bottom:14px;">
        <span class="version">v0.1.0</span>
    </div>
    <p class="desc">Manage your dependencies with a visual interface. View updates, check versions, and update packages easily.</p>

    <button class="open-btn" id="open-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
        Open Package Manager
    </button>
    <p class="shortcut">Or use <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → "Open NPM Manager"</p>

    <hr>
    <p class="section-label">Quick Links</p>
    <a class="link" href="https://github.com/sourabh10122002/npm-manager">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
        Documentation
    </a>
    <a class="link" href="https://github.com/sourabh10122002/npm-manager/issues">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
        Report Issue
    </a>

    <hr>
    <p class="section-label">Tips</p>
    <p class="tip">Right-click package.json to open</p>
    <p class="tip">Use Updates tab to see what needs updating</p>
    <p class="tip">Use Browse tab to search & install new packages</p>

    <script nonce="${nonce}">
        document.getElementById('open-btn').addEventListener('click', () => {
            const vscode = acquireVsCodeApi();
            vscode.postMessage({ type: 'openPanel' });
        });
    </script>
</body>
</html>`;
    }
}
