import * as vscode from 'vscode';
import { NpmManager } from './manager/NpmManager';
import { NPMManagerViewProvider } from './providers/NPMManagerViewProvider';
import { NPMManagerPanel } from './panels/NPMManagerPanel';

export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const npmManager = new NpmManager(workspaceRoot);
    const provider = new NPMManagerViewProvider(context.extensionUri, npmManager);

    // Register Sidebar Welcome Widget
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(NPMManagerViewProvider.viewType, provider)
    );

    // Command: Open NPM Manager Panel (main editor panel)
    context.subscriptions.push(
        vscode.commands.registerCommand('npm-manager.open', () => {
            NPMManagerPanel.createOrShow(context.extensionUri, npmManager);
        })
    );
}

export function deactivate() {}
