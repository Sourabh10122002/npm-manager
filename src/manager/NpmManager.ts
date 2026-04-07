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

    public async getAuditReport(): Promise<any> {
        try {
            const { stdout } = await execAsync('npm audit --json', { cwd: this.workspaceRoot });
            return JSON.parse(stdout);
        } catch (e: any) {
            if (e.stdout) {
                try {
                    return JSON.parse(e.stdout);
                } catch (pe) {
                    return { error: 'Failed to parse audit report' };
                }
            }
            return { error: 'No audit vulnerabilities found or error occurred' };
        }
    }

    public async getBundleSize(name: string): Promise<any> {
        const url = `https://bundlephobia.com/api/size?package=${encodeURIComponent(name)}`;
        try {
            const response = await axios.get(url, { timeout: 5000 });
            return {
                size: response.data.size,
                gzip: response.data.gzip,
                dependencyCount: response.data.dependencyCount
            };
        } catch (e) {
            return null;
        }
    }

    public async getDependencyTree(): Promise<any> {
        try {
            const { stdout } = await execAsync('npm list --depth=2 --json', { cwd: this.workspaceRoot });
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

    public async getUnusedDependencies(): Promise<string[]> {
        const pkgJson = this.readPackageJson();
        if (!pkgJson) return [];

        const deps = Object.keys(pkgJson.dependencies || {});
        const unused: string[] = [];

        // Basic scan for 'import ... from "package"' or 'require("package")'
        // This is a simple heuristic approach
        for (const dep of deps) {
            try {
                // Search in src directory if it exists, otherwise workspaceRoot
                const searchDir = fs.existsSync(path.join(this.workspaceRoot, 'src')) 
                    ? path.join(this.workspaceRoot, 'src') 
                    : this.workspaceRoot;

                // ripgrep or simple grep would be faster, but let's use a safe fallback
                // For VS Code extension, we can use the 'find' or similar, 
                // but let's try a simple recursive search for now or just assume it's used if we can't find it easily.
                // Alternatively, I'll use a small script to check this.
                const { stdout } = await execAsync(`grep -r "${dep}" "${searchDir}" --exclude-dir=node_modules --exclude=package.json`, { cwd: this.workspaceRoot });
                if (!stdout || stdout.trim().length === 0) {
                    unused.push(dep);
                }
            } catch (e) {
                // If grep fails (no matches found), it might mean it's unused
                unused.push(dep);
            }
        }
        return unused;
    }
}
