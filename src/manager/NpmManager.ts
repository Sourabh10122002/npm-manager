import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class NpmManager {
    constructor(private workspaceRoot: string) {}

    public getPackageJsonPath(): string {
        return path.join(this.workspaceRoot, 'package.json');
    }

    public readPackageJson(): any {
        const pPath = this.getPackageJsonPath();
        if (fs.existsSync(pPath)) {
            try {
                const content = fs.readFileSync(pPath, 'utf8');
                return JSON.parse(content);
            } catch (e) {
                console.error('Error reading package.json', e);
                return null;
            }
        }
        return null;
    }

    public async runCommand(command: string) {
        const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('NPM Manager');
        terminal.show();
        terminal.sendText(command);
    }

    public detectPackageManager(): 'npm' | 'yarn' | 'pnpm' {
        if (fs.existsSync(path.join(this.workspaceRoot, 'yarn.lock'))) {
            return 'yarn';
        }
        if (fs.existsSync(path.join(this.workspaceRoot, 'pnpm-lock.yaml'))) {
            return 'pnpm';
        }
        return 'npm';
    }

    public async installPackage(name: string, isDev: boolean = false) {
        const pm = this.detectPackageManager();
        const devFlag = isDev ? (pm === 'npm' ? '--save-dev' : '-D') : '';
        const cmd = `${pm} install ${name} ${devFlag}`;
        await this.runCommand(cmd);
    }

    public async uninstallPackage(name: string) {
        const pm = this.detectPackageManager();
        const uninstallCmd = pm === 'yarn' ? 'remove' : 'uninstall';
        const cmd = `${pm} ${uninstallCmd} ${name}`;
        await this.runCommand(cmd);
    }

    public async searchPackages(query: string): Promise<any[]> {
        const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=25`;
        try {
            const response = await axios.get(url);
            return response.data.objects.map((obj: any) => obj.package);
        } catch (e) {
            console.error('Error searching packages', e);
            return [];
        }
    }

    public async getOutdatedPackages(): Promise<any> {
        const pm = this.detectPackageManager();
        if (pm !== 'npm') {
             // Basic support for yarn/pnpm might need different flags
             // For now, let's keep it simple or implement for npm first
             return {};
        }

        try {
            const { stdout } = await execAsync('npm outdated --json', { cwd: this.workspaceRoot });
            return JSON.parse(stdout);
        } catch (e: any) {
            if (e.stdout) {
                try {
                    return JSON.parse(e.stdout);
                } catch (pe) {
                    return {};
                }
            }
            return {};
        }
    }

    public async updatePackage(name: string) {
        const pm = this.detectPackageManager();
        const cmd = `${pm} update ${name}`;
        await this.runCommand(cmd);
    }
}
