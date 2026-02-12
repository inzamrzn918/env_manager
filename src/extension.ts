import * as vscode from 'vscode';
import { EnvManager } from './EnvManager';
import { EnvTreeDataProvider, EnvNode } from './EnvTreeDataProvider';
import { EnvDashboard } from './EnvDashboard';

export function activate(context: vscode.ExtensionContext) {
    const envManager = new EnvManager(context);
    const treeDataProvider = new EnvTreeDataProvider(envManager);

    vscode.window.registerTreeDataProvider('env-manager-view', treeDataProvider);

    vscode.window.showInformationMessage('Env Manager Active!');

    // Command: Open Dashboard
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.openDashboard', () => {
        EnvDashboard.show(context.extensionUri, envManager);
    }));

    // Command: Add Project
    // Command: Add Project
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.addProject', async () => {
        let envFilePath: string | undefined;
        let projectRoot: string | undefined;
        let defaultName: string | undefined;

        const items: (vscode.QuickPickItem & { filePath?: string })[] = [];

        // 1. Discover .env files
        const envFiles = await vscode.workspace.findFiles('**/*.env', '**/node_modules/**', 50);

        for (const file of envFiles) {
            const folder = vscode.workspace.getWorkspaceFolder(file);
            const relativePath = folder ? vscode.workspace.asRelativePath(file, false) : file.fsPath;
            const root = vscode.Uri.joinPath(file, '..').fsPath;

            items.push({
                label: `$(file) ${relativePath}`,
                description: root,
                detail: 'Discovered .env file',
                filePath: file.fsPath
            });
        }

        // 2. Add Manual Selection Option
        items.push({
            label: '$(folder-opened) Select .env file manually...',
            alwaysShow: true
        });

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an .env file to identify the Project Root',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selection) return;

        if (selection.label.includes('Select .env file manually')) {
            const files = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: { 'Env Files': ['env', '*'] },
                openLabel: 'Select .env File'
            });

            if (files && files.length > 0) {
                envFilePath = files[0].fsPath;
                projectRoot = vscode.Uri.joinPath(files[0], '..').fsPath;
                defaultName = vscode.Uri.joinPath(files[0], '..').path.split('/').pop();
            }
        } else {
            envFilePath = selection.filePath;
            projectRoot = selection.description;
            if (projectRoot) {
                defaultName = projectRoot.split(/\/|\\/).pop();
            }
        }

        if (!projectRoot) return; // envFilePath is optional if we allowed manual root selection without env file, but here we require strict selection. 
        // Actually, logic allows manual folder selection? No, my manual option forces selecting a .env file.
        // So envFilePath should be set.

        const name = await vscode.window.showInputBox({
            prompt: 'Enter Project Name',
            value: defaultName
        });

        if (!name) return;

        await envManager.addProject(name, projectRoot, envFilePath);
        treeDataProvider.refresh();
        if (EnvDashboard.currentPanel) {
            EnvDashboard.currentPanel.update();
        }
    }));

    // Command: Add Environment
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.addEnv', async (node?: EnvNode) => {
        let projectId: string | undefined;

        if (node && node.type === 'project') {
            projectId = node.data.id;
        } else {
            // Fallback: Pick a project if not triggered from tree item
            const projects = envManager.getProjects();
            if (projects.length === 0) {
                vscode.window.showErrorMessage('No projects found. Add a project first.');
                return;
            }
            const selected = await vscode.window.showQuickPick(projects.map(p => ({ label: p.name, id: p.id })));
            if (selected) projectId = selected.id;
        }

        if (!projectId) return;

        const name = await vscode.window.showInputBox({ prompt: 'Enter Environment Name (e.g., Dev, Prod)' });
        if (!name) return;

        await envManager.addEnvironment(projectId, name);
        treeDataProvider.refresh();
        if (EnvDashboard.currentPanel) EnvDashboard.currentPanel.update();
    }));

    // Command: Set Active Environment
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.setActive', async (node: EnvNode) => {
        if (node && node.type === 'environment' && node.parentId) {
            await envManager.setActiveEnvironment(node.parentId, node.data.id);
            envManager.updateEnvironmentVariables(); // Apply changes
            treeDataProvider.refresh();
            if (EnvDashboard.currentPanel) EnvDashboard.currentPanel.update();
        }
    }));

    // Command: Refresh
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.refresh', () => {
        treeDataProvider.refresh();
        if (EnvDashboard.currentPanel) EnvDashboard.currentPanel.update();
    }));

    // Command: Add Variable
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.addVar', async (node: EnvNode) => {
        if (node && node.type === 'environment' && node.parentId) {
            const key = await vscode.window.showInputBox({ prompt: 'Variable Key (e.g. API_URL)' });
            if (!key) return;
            const value = await vscode.window.showInputBox({ prompt: 'Variable Value' });
            if (value === undefined) return; // Allow empty string

            await envManager.addVariable(node.parentId, node.data.id, key, value);
            envManager.updateEnvironmentVariables();
            treeDataProvider.refresh();
            if (EnvDashboard.currentPanel) EnvDashboard.currentPanel.update();
        }
    }));

    // Command: Add Workspace Variable
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.addWorkspaceVar', async (node?: EnvNode) => {
        const key = await vscode.window.showInputBox({ prompt: 'Workspace Variable Key' });
        if (!key) return;
        const value = await vscode.window.showInputBox({ prompt: 'Variable Value' });
        if (value === undefined) return;

        await envManager.addWorkspaceVariable(key, value);
        treeDataProvider.refresh();
        if (EnvDashboard.currentPanel) EnvDashboard.currentPanel.update();
    }));
    // Command: Rename Project
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.renameProject', async (node?: EnvNode) => {
        if (!node || node.type !== 'project') return;
        const project = node.data as any; // Cast to avoid type issues if needed, or import Project type

        const newName = await vscode.window.showInputBox({
            prompt: 'Enter New Project Name',
            value: project.name
        });
        if (!newName) return;

        await envManager.renameProject(project.id, newName);
        treeDataProvider.refresh();
        if (EnvDashboard.currentPanel) EnvDashboard.currentPanel.update();
    }));

    // Command: Delete Project
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.deleteProject', async (node?: EnvNode) => {
        if (!node || node.type !== 'project') return;
        const project = node.data as any;

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete project "${project.name}"?`,
            { modal: true },
            'Delete'
        );
        if (confirm !== 'Delete') return;

        await envManager.deleteProject(project.id);
        treeDataProvider.refresh();
        if (EnvDashboard.currentPanel) EnvDashboard.currentPanel.update();
    }));

    // Command: Rename Environment
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.renameEnv', async (node?: EnvNode) => {
        if (!node || node.type !== 'environment' || !node.parentId) return;
        const env = node.data as any;

        const newName = await vscode.window.showInputBox({
            prompt: 'Enter New Environment Name',
            value: env.name
        });
        if (!newName) return;

        await envManager.renameEnvironment(node.parentId, env.id, newName);
        treeDataProvider.refresh();
        if (EnvDashboard.currentPanel) EnvDashboard.currentPanel.update();
    }));

    // Command: Delete Environment
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.deleteEnv', async (node?: EnvNode) => {
        if (!node || node.type !== 'environment' || !node.parentId) return;
        const env = node.data as any;

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete environment "${env.name}"?`,
            { modal: true },
            'Delete'
        );
        if (confirm !== 'Delete') return;

        await envManager.deleteEnvironment(node.parentId, env.id);
        treeDataProvider.refresh();
        if (EnvDashboard.currentPanel) EnvDashboard.currentPanel.update();
    }));

    // Command: Edit Variable
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.editVar', async (node?: EnvNode) => {
        if (!node || node.type !== 'variable' || !node.parentId) return;

        // Data now contains envId thanks to TreeDataProvider update
        const variableData = node.data as { key: string, value: string, enabled: boolean, envId: string };
        const envId = variableData.envId;

        const newKey = await vscode.window.showInputBox({
            prompt: 'Edit Variable Key',
            value: variableData.key
        });
        if (!newKey) return;

        const newValue = await vscode.window.showInputBox({
            prompt: 'Edit Variable Value',
            value: variableData.value
        });
        if (newValue === undefined) return;

        await envManager.editVariable(node.parentId, envId, variableData.key, newKey, newValue);
        envManager.updateEnvironmentVariables();
        treeDataProvider.refresh();
        if (EnvDashboard.currentPanel) EnvDashboard.currentPanel.update();
    }));

    // Command: Delete Variable
    context.subscriptions.push(vscode.commands.registerCommand('env-manager.deleteVar', async (node?: EnvNode) => {
        if (!node || node.type !== 'variable' || !node.parentId) return;

        const variableData = node.data as { key: string, value: string, enabled: boolean, envId: string };
        const envId = variableData.envId;

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete variable "${variableData.key}"?`,
            { modal: true },
            'Delete'
        );
        if (confirm !== 'Delete') return;

        await envManager.deleteVariable(node.parentId, envId, variableData.key);
        envManager.updateEnvironmentVariables();
        treeDataProvider.refresh();
        if (EnvDashboard.currentPanel) EnvDashboard.currentPanel.update();
    }));
}
