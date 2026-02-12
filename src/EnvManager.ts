import * as vscode from 'vscode';
import { Project, Environment, EnvVariable, STORAGE_KEY_PROJECTS } from './types';

export class EnvManager {
    private storage: vscode.Memento;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.storage = context.globalState;
        this.updateEnvironmentVariables(); // Initial sync
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
        return this.storage.get<Project[]>(STORAGE_KEY_PROJECTS, []);
    }

    public async saveProjects(projects: Project[]) {
        await this.storage.update(STORAGE_KEY_PROJECTS, projects);
        this.updateEnvironmentVariables();
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
        await this.saveProjects(projects);
        vscode.window.showInformationMessage(`Active environment for ${project.name} set to ${envId}`);
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

        const projects: Project[] = this.storage.get(STORAGE_KEY_PROJECTS, []);

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
