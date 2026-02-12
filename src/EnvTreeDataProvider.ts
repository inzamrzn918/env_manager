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
            this.iconPath = new vscode.ThemeIcon('project');
        } else if (type === 'environment') {
            this.iconPath = new vscode.ThemeIcon('server-environment');
            const isActive = data?.isActive;
            if (isActive) {
                this.description = '(Active)';
                this.iconPath = new vscode.ThemeIcon('check');
            }
        } else {
            this.iconPath = new vscode.ThemeIcon('symbol-variable');
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
            const projectNodes = projects.map(p =>
                new EnvNode(p.name, vscode.TreeItemCollapsibleState.Collapsed, 'project', undefined, 'project', p)
            );

            // Workspace Overrides Node
            const workspaceVars = this.envManager.getWorkspaceVariables();
            const workspaceNode = new EnvNode(
                'Workspace Overrides',
                vscode.TreeItemCollapsibleState.Collapsed,
                'project', // Reusing 'project' type for icon, or create a new one
                undefined,
                'workspace-root',
                { isWorkspace: true }
            );
            workspaceNode.description = workspaceVars.length > 0 ? `(${workspaceVars.length})` : '(Empty)';
            workspaceNode.iconPath = new vscode.ThemeIcon('wrench');

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
            return Promise.resolve(project.environments.map(e =>
                new EnvNode(
                    e.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'environment',
                    project.id,
                    'environment',
                    { ...e, isActive: project.activeEnvId === e.id }
                )
            ));
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
