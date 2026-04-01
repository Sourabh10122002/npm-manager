import * as vscode from 'vscode';
import { NpmManager } from './manager/NpmManager';
import { NPMManagerViewProvider } from './providers/NPMManagerViewProvider';

export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const npmManager = new NpmManager(workspaceRoot);
    const provider = new NPMManagerViewProvider(context.extensionUri, npmManager);

    // Register Webview View
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(NPMManagerViewProvider.viewType, provider)
    );

    // Command to open the manager explicitly if needed
    context.subscriptions.push(
        vscode.commands.registerCommand('npm-manager.open', () => {
             vscode.commands.executeCommand('npm-manager-view.focus');
        })
    );
}

export function deactivate() {}
