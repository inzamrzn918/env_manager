import * as vscode from 'vscode';
import { Project, Environment, EnvVariable, STORAGE_KEY_PROJECTS, STORAGE_KEY_SYNC_MODE, SyncMode } from './types';
import * as path from 'path';

export class EnvManager {
    private storage: vscode.Memento;
    private context: vscode.ExtensionContext;
    private secrets: vscode.SecretStorage;
    private projectsCache: Project[] | undefined;
    private _syncMode: SyncMode = 'terminal';

    public get syncMode(): SyncMode {
        return this._syncMode;
    }

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.storage = context.globalState;
        this.secrets = context.secrets;
        this._syncMode = this.storage.get<SyncMode>(STORAGE_KEY_SYNC_MODE, 'terminal');
    }

    public async init() {
        await this.loadProjects();
        this.updateEnvironmentVariables(); // Initial sync
    }

    private async loadProjects() {
        const secretData = await this.secrets.get(STORAGE_KEY_PROJECTS);
        if (secretData) {
            try {
                this.projectsCache = JSON.parse(secretData);
            } catch {
                this.projectsCache = [];
            }
        } else {
            // Migration: Check globalState
            const legacyData = this.storage.get<Project[]>(STORAGE_KEY_PROJECTS);
            if (legacyData && legacyData.length > 0) {
                this.projectsCache = legacyData;
                // Save to secrets
                await this.secrets.store(STORAGE_KEY_PROJECTS, JSON.stringify(this.projectsCache));
                // Clear legacy
                await this.storage.update(STORAGE_KEY_PROJECTS, undefined);
                vscode.window.showInformationMessage('Migrated Env Manager data to Secure Storage.');
            } else {
                this.projectsCache = [];
            }
        }
    }

    public async toggleSyncMode() {
        this._syncMode = this._syncMode === 'terminal' ? 'file' : 'terminal';
        await this.storage.update(STORAGE_KEY_SYNC_MODE, this._syncMode);

        if (this._syncMode === 'file') {
            await this.syncAllActiveProjectsToFile();
            vscode.window.showInformationMessage('Sync Mode: .env File Sync (Backups created)');
        } else {
            await this.revertAllActiveProjectsFromFile();
            this.updateEnvironmentVariables(); // Re-inject terminal vars
            vscode.window.showInformationMessage('Sync Mode: Terminal Injection (Original .env restored)');
        }
    }

    private async syncAllActiveProjectsToFile() {
        const projects = this.getProjects();
        for (const project of projects) {
            if (project.activeEnvId) {
                await this.writeEnvFile(project);
            }
        }
        // Create an empty collection effectively
        this.context.environmentVariableCollection.clear();
    }

    private async revertAllActiveProjectsFromFile() {
        const projects = this.getProjects();
        for (const project of projects) {
            await this.restoreEnvFile(project);
        }
    }

    private async restoreEnvFile(project: Project) {
        // Restore .env from .env.bak
        const envPath = path.join(project.path, '.env');
        const bakPath = path.join(project.path, '.env.bak');

        try {
            // Check if backup exists
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(bakPath));
            } catch {
                return; // No backup, nothing to restore
            }

            // Restore
            await vscode.workspace.fs.copy(vscode.Uri.file(bakPath), vscode.Uri.file(envPath), { overwrite: true });
            // Delete backup
            await vscode.workspace.fs.delete(vscode.Uri.file(bakPath));
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to restore .env file for ${project.name}: ${err}`);
        }
    }

    private async writeEnvFile(project: Project) {
        if (!project.activeEnvId) return;
        const env = project.environments.find(e => e.id === project.activeEnvId);
        if (!env) return;

        const envPath = path.join(project.path, '.env');
        const bakPath = path.join(project.path, '.env.bak');
        const envUri = vscode.Uri.file(envPath);
        const bakUri = vscode.Uri.file(bakPath);

        try {
            // 1. Create Backup if not exists
            let existingContent = '';
            try {
                const existingData = await vscode.workspace.fs.readFile(envUri);
                existingContent = new TextDecoder().decode(existingData);

                // Check backup existence
                try {
                    await vscode.workspace.fs.stat(bakUri);
                } catch {
                    // Create backup
                    await vscode.workspace.fs.copy(envUri, bakUri, { overwrite: false });
                }
            } catch {
                // .env doesn't exist, start fresh
                existingContent = '';
            }

            // 2. Parse and Update
            const lines = existingContent.split(/\r?\n/);
            const newLines: string[] = [];
            const envVars = env.variables.filter(v => v.enabled);
            const processedKeys = new Set<string>();

            // Regex needed to handle existing lines
            for (const line of lines) {
                const trimmed = line.trim();
                const match = trimmed.match(/^([^=]+)=(.*)$/);

                if (match && !trimmed.startsWith('#')) {
                    const key = match[1].trim();
                    // Check if this key is managed by us
                    const managedVar = envVars.find(v => v.key === key);

                    if (managedVar) {
                        // Replace value, escape quotes
                        const escapedValue = managedVar.value.replace(/"/g, '\\"');
                        newLines.push(`${key}="${escapedValue}"`);
                        processedKeys.add(key);
                    } else {
                        // Keep original
                        newLines.push(line);
                    }
                } else {
                    // Comments or empty lines, keep them
                    newLines.push(line);
                }
            }

            // 3. Append new keys
            for (const v of envVars) {
                if (!processedKeys.has(v.key)) {
                    // Ensure newline separation if file wasn't empty
                    if (newLines.length > 0 && newLines[newLines.length - 1] !== '') {
                        // Optional: could check if last line is empty
                    }
                    const escapedValue = v.value.replace(/"/g, '\\"');
                    newLines.push(`${v.key}="${escapedValue}"`);
                }
            }

            // 4. Write back
            const newContent = newLines.join('\n');
            await vscode.workspace.fs.writeFile(envUri, new TextEncoder().encode(newContent));

        } catch (err) {
            vscode.window.showErrorMessage(`Failed to update .env file for ${project.name}: ${err}`);
        }
    }

    // --- Workspace Overrides ---
    public getWorkspaceVariables(): EnvVariable[] {
        return this.context.workspaceState.get<EnvVariable[]>('envManager.workspaceVars', []);
    }

    public async addWorkspaceVariable(key: string, value: string) {
        const vars = this.getWorkspaceVariables();
        // Check if exists and update, or push new
        const existing = vars.find(v => v.key === key);
        if (existing) {
            existing.value = value;
            existing.enabled = true;
        } else {
            vars.push({ key, value, enabled: true });
        }
        await this.context.workspaceState.update('envManager.workspaceVars', vars);
        this.updateEnvironmentVariables();
    }

    // --- Projects ---

    public getProjects(): Project[] {
        if (!this.projectsCache) {
            // Sync call can't await, but we should have awaited init().
            // Ideally getProjects shouldn't contain async logic.
            // If cache is empty, return empty or throw error if not init?
            // Assuming init call in activate ensures this is populated.
            return [];
        }
        return this.projectsCache!;
    }

    public async saveProjects(projects: Project[]) {
        this.projectsCache = projects;
        await this.secrets.store(STORAGE_KEY_PROJECTS, JSON.stringify(projects));

        if (this._syncMode === 'file') {
            await this.syncAllActiveProjectsToFile();
        } else {
            this.updateEnvironmentVariables();
        }
    }

    public async addProject(name: string, projectPath: string, envFilePath?: string) {
        const projects = this.getProjects();
        if (projects.find(p => p.path === projectPath)) {
            vscode.window.showErrorMessage('Project already exists for this path.');
            return;
        }

        const newProject: Project = {
            id: Date.now().toString(),
            name: name,
            path: projectPath,
            environments: []
        };

        if (envFilePath) {
            try {
                // Read and parse .env file
                const content = await vscode.workspace.fs.readFile(vscode.Uri.file(envFilePath));
                const text = new TextDecoder().decode(content);
                const variables: EnvVariable[] = [];

                // More robust parsing regex
                // Matches KEY='VAL', KEY="VAL", KEY=VAL, ignoring comments
                const parseLine = (line: string) => {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) return;

                    const match = trimmed.match(/^([^=]+)=(.*)$/);
                    if (match) {
                        let key = match[1].trim();
                        let value = match[2].trim();

                        // Remove surrounding quotes if present
                        if ((value.startsWith('"') && value.endsWith('"')) ||
                            (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.substring(1, value.length - 1);
                        }

                        variables.push({ key, value, enabled: true });
                    }
                };

                text.split(/\r?\n/).forEach(parseLine);

                // Create environment even if empty, so user sees the result
                const newEnv: Environment = {
                    id: Date.now().toString(),
                    name: 'Check-in',
                    variables: variables
                };
                newProject.environments.push(newEnv);
                newProject.activeEnvId = newEnv.id;

                if (variables.length === 0) {
                    vscode.window.showWarningMessage(`Imported project from ${envFilePath} but found no variables. Check file format.`);
                } else {
                    vscode.window.showInformationMessage(`Imported ${variables.length} variables from ${envFilePath}`);
                }

            } catch (error) {
                vscode.window.showErrorMessage(`Failed to read .env file: ${error}`);
            }
        }

        projects.push(newProject);
        await this.saveProjects(projects);
    }

    public async deleteProject(projectId: string) {
        let projects = this.getProjects();
        projects = projects.filter(p => p.id !== projectId);
        await this.saveProjects(projects);
    }

    public async renameProject(projectId: string, newName: string) {
        const projects = this.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (project) {
            project.name = newName;
            await this.saveProjects(projects);
        }
    }

    public async addEnvironment(projectId: string, name: string) {
        const projects = this.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const newEnv: Environment = {
            id: Date.now().toString(),
            name: name,
            variables: []
        };

        project.environments.push(newEnv);
        await this.saveProjects(projects);
    }

    public async deleteEnvironment(projectId: string, envId: string) {
        const projects = this.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (project) {
            project.environments = project.environments.filter(e => e.id !== envId);
            if (project.activeEnvId === envId) {
                project.activeEnvId = undefined;
            }
            await this.saveProjects(projects);
        }
    }

    public async renameEnvironment(projectId: string, envId: string, newName: string) {
        const projects = this.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (project) {
            const env = project.environments.find(e => e.id === envId);
            if (env) {
                env.name = newName;
                await this.saveProjects(projects);
            }
        }
    }

    public async setActiveEnvironment(projectId: string, envId: string) {
        const projects = this.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        project.activeEnvId = envId;

        // Important: Save calls saveProjects which handles sync based on mode.
        // But for feedback, we might want to know.

        await this.saveProjects(projects);

        const modeMsg = this._syncMode === 'file' ? 'Updated .env file' : 'Updated Terminal Environment';
        vscode.window.showInformationMessage(`Active environment set to ${envId}. (${modeMsg})`);
    }

    public async addVariable(projectId: string, envId: string, key: string, value: string) {
        const projects = this.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const env = project.environments.find(e => e.id === envId);
        if (!env) return;

        env.variables.push({ key, value, enabled: true });
        await this.saveProjects(projects);
    }

    public async deleteVariable(projectId: string, envId: string, key: string) {
        const projects = this.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const env = project.environments.find(e => e.id === envId);
        if (!env) return;

        env.variables = env.variables.filter(v => v.key !== key);
        await this.saveProjects(projects);
    }

    public async editVariable(projectId: string, envId: string, originalKey: string, newKey: string, newValue: string) {
        const projects = this.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const env = project.environments.find(e => e.id === envId);
        if (!env) return;

        const variable = env.variables.find(v => v.key === originalKey);
        if (variable) {
            variable.key = newKey;
            variable.value = newValue;
            await this.saveProjects(projects);
        }
    }

    // Logic to update VS Code's environment variable collection
    public updateEnvironmentVariables() {
        // Clear all previously set variables by this extension
        this.context.environmentVariableCollection.clear();

        // If in FILE mode, we do NOT inject into terminal collection globally.
        if (this._syncMode === 'file') {
            return;
        }

        // Use cached projects directly here for speed
        const projects: Project[] = this.getProjects();

        if (!vscode.workspace.workspaceFolders) {
            return;
        }

        // Iterate over all workspace folders to find matching projects
        for (const folder of vscode.workspace.workspaceFolders) {
            const workspacePath = folder.uri.fsPath;
            // Match project by path. 
            // TODO: Robust path matching (normalization, case sensitivity on Windows)
            const matchedProject = projects.find(p => p.path.toLowerCase() === workspacePath.toLowerCase());

            if (matchedProject && matchedProject.activeEnvId) {
                const activeEnv = matchedProject.environments.find(e => e.id === matchedProject.activeEnvId);
                if (activeEnv) {
                    activeEnv.variables.forEach(v => {
                        if (v.enabled) {
                            // This sets the variable for the collection, effectively injecting it
                            this.context.environmentVariableCollection.replace(v.key, v.value);
                        }
                    });
                }
            }
        }

        // Apply Workspace Overrides (Last wins)
        const workspaceVars = this.getWorkspaceVariables();
        if (workspaceVars.length > 0) {
            workspaceVars.forEach(v => {
                if (v.enabled) {
                    this.context.environmentVariableCollection.replace(v.key, v.value);
                }
            });
        }
    }
}
