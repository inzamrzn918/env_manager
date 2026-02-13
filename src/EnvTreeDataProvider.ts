import * as vscode from 'vscode';
import { EnvManager } from './EnvManager';
import { Project, Environment } from './types';

export class EnvNode extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'project' | 'environment' | 'variable',
        public readonly parentId?: string, // projectId for envs, envId for vars
        public readonly contextValue: string = type,
        public readonly data?: any
    ) {
        super(label, collapsibleState);

        if (type === 'project') {
            this.iconPath = new vscode.ThemeIcon('folder-library', new vscode.ThemeColor('charts.blue'));
            this.tooltip = `Project: ${label}`;
        } else if (type === 'environment') {
            const isActive = data?.isActive;
            if (isActive) {
                this.description = '✓ Active';
                this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
                this.tooltip = `Active Environment: ${label}`;
            } else {
                this.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.gray'));
                this.tooltip = `Environment: ${label}`;
            }
        } else {
            this.iconPath = new vscode.ThemeIcon('key', new vscode.ThemeColor('charts.yellow'));
            // Extract key and value for better tooltip
            const parts = label.split('=');
            if (parts.length === 2) {
                this.tooltip = `${parts[0]}\n${parts[1]}`;
            } else {
                this.tooltip = label;
            }
        }
    }
}

export class EnvTreeDataProvider implements vscode.TreeDataProvider<EnvNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<EnvNode | undefined | void> = new vscode.EventEmitter<EnvNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<EnvNode | undefined | void> = this._onDidChangeTreeData.event;

    constructor(private envManager: EnvManager) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: EnvNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: EnvNode): Thenable<EnvNode[]> {
        if (!element) {
            // Root: Projects + Workspace Overrides
            const projects = this.envManager.getProjects();
            const projectNodes = projects.map(p => {
                const node = new EnvNode(p.name, vscode.TreeItemCollapsibleState.Collapsed, 'project', undefined, 'project', p);
                const envCount = p.environments.length;
                const activeEnv = p.environments.find(e => e.id === p.activeEnvId);
                if (activeEnv) {
                    node.description = `${activeEnv.name} • ${envCount} env${envCount !== 1 ? 's' : ''}`;
                } else {
                    node.description = `${envCount} environment${envCount !== 1 ? 's' : ''}`;
                }
                return node;
            });

            // Workspace Overrides Node
            const workspaceVars = this.envManager.getWorkspaceVariables();
            const workspaceNode = new EnvNode(
                'Workspace Overrides',
                vscode.TreeItemCollapsibleState.Collapsed,
                'project',
                undefined,
                'workspace-root',
                { isWorkspace: true }
            );
            const varCount = workspaceVars.length;
            workspaceNode.description = varCount > 0 ? `${varCount} variable${varCount !== 1 ? 's' : ''}` : 'Empty';
            workspaceNode.iconPath = new vscode.ThemeIcon('wrench', new vscode.ThemeColor('charts.purple'));
            workspaceNode.tooltip = `Workspace-level environment variables (${varCount})`;

            return Promise.resolve([...projectNodes, workspaceNode]);
        }

        if (element.contextValue === 'workspace-root') {
            const workspaceVars = this.envManager.getWorkspaceVariables();
            return Promise.resolve(workspaceVars.map(v =>
                new EnvNode(
                    `${v.key}=${v.value}`,
                    vscode.TreeItemCollapsibleState.None,
                    'variable',
                    'workspace-root',
                    'variable',
                    v
                )
            ));
        }

        if (element.type === 'project') {
            // Children: Environments
            const project = element.data as Project;
            return Promise.resolve(project.environments.map(e => {
                const node = new EnvNode(
                    e.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'environment',
                    project.id,
                    'environment',
                    { ...e, isActive: project.activeEnvId === e.id }
                );
                const varCount = e.variables.filter(v => v.enabled).length;
                const totalVars = e.variables.length;
                if (varCount < totalVars) {
                    node.description = (node.description || '') + ` • ${varCount}/${totalVars} vars`;
                } else {
                    node.description = (node.description || '') + ` • ${varCount} var${varCount !== 1 ? 's' : ''}`;
                }
                return node;
            }));
        }

        if (element.type === 'environment') {
            // Children: Variables
            const env = element.data as Environment;
            return Promise.resolve(env.variables.map(v =>
                new EnvNode(
                    `${v.key}=${v.value}`,
                    vscode.TreeItemCollapsibleState.None,
                    'variable',
                    element.parentId,
                    'variable',
                    { ...v, envId: env.id }
                )
            ));
        }

        return Promise.resolve([]);
    }
}
