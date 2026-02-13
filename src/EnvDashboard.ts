import * as vscode from 'vscode';
import { EnvManager } from './EnvManager';

export class EnvDashboard {
    public static currentPanel: EnvDashboard | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, private envManager: EnvManager) {
        this._panel = panel;

        // Set the webview's initial html content
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view state changes
        this._panel.onDidChangeViewState(
            e => {
                if (this._panel.visible) {
                    this.update();
                }
            },
            null,
            this._disposables
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'ready':
                        this.update();
                        return;
                    case 'addProject':
                        vscode.commands.executeCommand('env-manager.addProject');
                        return;
                    case 'addEnv':
                        if (message.projectId) {
                            const name = await vscode.window.showInputBox({ prompt: 'Enter Environment Name (e.g. DEV, UAT)' });
                            if (name) {
                                await envManager.addEnvironment(message.projectId, name);
                                this.update();
                            }
                        }
                        return;
                    case 'setActive':
                        if (message.projectId && message.envId) {
                            await envManager.setActiveEnvironment(message.projectId, message.envId);
                            envManager.updateEnvironmentVariables();
                            this.update();
                        }
                        return;
                    case 'addVar':
                        if (message.projectId && message.envId) {
                            const key = await vscode.window.showInputBox({ prompt: 'Variable Key' });
                            if (!key) return;
                            const value = await vscode.window.showInputBox({ prompt: 'Variable Value' });
                            if (value === undefined) return;
                            await envManager.addVariable(message.projectId, message.envId, key, value);
                            envManager.updateEnvironmentVariables();
                            this.update();
                        }
                        return;
                    case 'deleteProject': // New
                        if (message.projectId) {
                            const conf = await vscode.window.showWarningMessage('Delete this project?', { modal: true }, 'Yes');
                            if (conf === 'Yes') {
                                await envManager.deleteProject(message.projectId);
                                this.update();
                            }
                        }
                        return;
                    case 'renameProject': // New
                        if (message.projectId) {
                            const pName = await vscode.window.showInputBox({ prompt: 'New Project Name', value: message.currentName });
                            if (pName) {
                                await envManager.renameProject(message.projectId, pName);
                                this.update();
                            }
                        }
                        return;
                    case 'deleteEnv': // New
                        if (message.projectId && message.envId) {
                            const conf = await vscode.window.showWarningMessage('Delete this environment?', { modal: true }, 'Yes');
                            if (conf === 'Yes') {
                                await envManager.deleteEnvironment(message.projectId, message.envId);
                                this.update();
                            }
                        }
                        return;
                    case 'renameEnv': // New
                        if (message.projectId && message.envId) {
                            const eName = await vscode.window.showInputBox({ prompt: 'New Environment Name', value: message.currentName });
                            if (eName) {
                                await envManager.renameEnvironment(message.projectId, message.envId, eName);
                                this.update();
                            }
                        }
                        return;
                    case 'deleteVar': // New
                        if (message.projectId && message.envId && message.key) {
                            const conf = await vscode.window.showWarningMessage(`Delete variable ${message.key}?`, { modal: true }, 'Yes');
                            if (conf === 'Yes') {
                                await envManager.deleteVariable(message.projectId, message.envId, message.key);
                                envManager.updateEnvironmentVariables();
                                this.update();
                            }
                        }
                        return;
                    case 'editVar': // New
                        if (message.projectId && message.envId && message.key) {
                            const newKey = await vscode.window.showInputBox({ prompt: 'Edit Key', value: message.key });
                            if (!newKey) return;
                            const newValue = await vscode.window.showInputBox({ prompt: 'Edit Value', value: message.value });
                            if (newValue === undefined) return;

                            await envManager.editVariable(message.projectId, message.envId, message.key, newKey, newValue);
                            envManager.updateEnvironmentVariables();
                            this.update();
                        }
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static show(extensionUri: vscode.Uri, envManager: EnvManager) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (EnvDashboard.currentPanel) {
            EnvDashboard.currentPanel._panel.reveal(column);
            EnvDashboard.currentPanel.update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'envManagerDashboard',
            'Env Manager Dashboard',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
            }
        );

        panel.iconPath = vscode.Uri.joinPath(extensionUri, 'resources', 'icon.svg');

        EnvDashboard.currentPanel = new EnvDashboard(panel, extensionUri, envManager);
    }

    public dispose() {
        EnvDashboard.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }

    public update() {
        const projects = this.envManager.getProjects();
        this._panel.webview.postMessage({ command: 'updateData', projects: projects });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Env Manager Dashboard</title>
                <style>
                    :root {
                        --sidebar-width: 260px;
                        --header-height: 50px;
                        --border-color: var(--vscode-panel-border);
                        --bg-sidebar: var(--vscode-sideBar-background);
                        --bg-main: var(--vscode-editor-background);
                        --item-hover: var(--vscode-list-hoverBackground);
                        --item-active: var(--vscode-list-activeSelectionBackground);
                        --text-active: var(--vscode-list-activeSelectionForeground);
                        --color-accent: var(--vscode-activityBarBadge-background);
                        --shadow-sm: 0 1px 3px rgba(0,0,0,0.12);
                        --shadow-md: 0 4px 6px rgba(0,0,0,0.15);
                    }
                    * {
                        box-sizing: border-box;
                    }
                    body {
                        font-family: var(--vscode-font-family);
                        margin: 0;
                        padding: 0;
                        display: flex;
                        height: 100vh;
                        overflow: hidden;
                        color: var(--vscode-editor-foreground);
                        background-color: var(--bg-main);
                    }
                    /* Layout */
                    .container {
                        display: flex;
                        width: 100%;
                        height: 100%;
                    }
                    .sidebar {
                        width: var(--sidebar-width);
                        background-color: var(--bg-sidebar);
                        border-right: 1px solid var(--border-color);
                        display: flex;
                        flex-direction: column;
                    }
                    .main-content {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        background: var(--bg-main);
                    }
                    /* Sidebar */
                    .sidebar-header {
                        padding: 12px 16px;
                        font-weight: 600;
                        text-transform: uppercase;
                        font-size: 0.75em;
                        letter-spacing: 0.5px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1px solid var(--border-color);
                        background: rgba(0,0,0,0.05);
                    }
                    .project-list {
                        flex: 1;
                        overflow-y: auto;
                        padding: 4px 0;
                    }
                    .project-item {
                        padding: 10px 16px;
                        cursor: pointer;
                        display: flex;
                        flex-direction: column;
                        border-bottom: 1px solid transparent;
                        transition: all 0.15s ease;
                        margin: 2px 8px;
                        border-radius: 4px;
                    }
                    .project-item:hover {
                        background-color: var(--item-hover);
                    }
                    .project-item.selected {
                        background-color: var(--item-active);
                        color: var(--text-active);
                        box-shadow: var(--shadow-sm);
                    }
                    .project-name { 
                        font-weight: 600; 
                        font-size: 0.95em;
                        margin-bottom: 4px;
                    }
                    .project-path { 
                        font-size: 0.7em; 
                        opacity: 0.6; 
                        white-space: nowrap; 
                        overflow: hidden; 
                        text-overflow: ellipsis; 
                        font-family: monospace;
                    }

                    /* Main Header */
                    .main-header {
                        padding: 20px 24px;
                        border-bottom: 1px solid var(--border-color);
                        background: rgba(0,0,0,0.02);
                    }
                    .main-title { 
                        font-size: 1.4em; 
                        font-weight: 600; 
                        margin-bottom: 6px;
                    }
                    .main-subtitle { 
                        font-size: 0.85em; 
                        opacity: 0.7;
                        font-family: monospace;
                    }
                    
                    /* Tabs */
                    .tabs {
                        display: flex;
                        padding: 0 24px;
                        margin-top: 0;
                        border-bottom: 1px solid var(--border-color);
                        gap: 4px;
                        background: rgba(0,0,0,0.02);
                    }
                    .tab {
                        padding: 10px 16px;
                        cursor: pointer;
                        border-bottom: 2px solid transparent;
                        opacity: 0.65;
                        transition: all 0.2s ease;
                        font-size: 0.9em;
                        position: relative;
                    }
                    .tab:hover { 
                        opacity: 0.9; 
                        background: var(--item-hover);
                    }
                    .tab.active {
                        border-bottom-color: var(--color-accent);
                        opacity: 1;
                        font-weight: 600;
                        background: rgba(0,0,0,0.03);
                    }

                    /* Content Area */
                    .content-area {
                        padding: 24px;
                        flex: 1;
                        overflow-y: auto;
                    }

                    /* Variable Table */
                    .var-table-container {
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        border-radius: 6px;
                        overflow: hidden;
                        box-shadow: var(--shadow-sm);
                        border: 1px solid var(--border-color);
                    }
                    .var-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 0.9em;
                    }
                    .var-table th, .var-table td {
                        padding: 12px 16px;
                        text-align: left;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    .var-table th { 
                        background: rgba(0,0,0,0.15); 
                        font-weight: 600;
                        font-size: 0.85em;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .var-table tr:last-child td {
                        border-bottom: none;
                    }
                    .var-table tr:hover {
                        background: rgba(0,0,0,0.05);
                    }
                    .var-key { 
                        font-family: 'Consolas', 'Monaco', monospace; 
                        font-weight: 600; 
                        color: var(--vscode-textPreformat-foreground);
                    }
                    .var-value { 
                        font-family: 'Consolas', 'Monaco', monospace;
                        opacity: 0.9;
                    }
                    .var-actions { 
                        text-align: right; 
                        width: 100px;
                    }
                    .icon-btn { 
                        background: none; 
                        border: none; 
                        color: var(--vscode-icon-foreground); 
                        cursor: pointer; 
                        padding: 4px 6px;
                        opacity: 0.6;
                        transition: all 0.15s ease;
                        border-radius: 3px;
                    }
                    .icon-btn:hover { 
                        opacity: 1; 
                        background: var(--item-hover);
                        color: var(--vscode-textLink-foreground);
                    }
                    
                    /* Project List Item Actions */
                    .project-header-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .proj-actions {
                         display: none;
                    }
                    .project-item:hover .proj-actions {
                        display: flex;
                        gap: 2px;
                    }
                    
                    /* Actions */
                    .action-bar {
                        display: flex;
                        gap: 12px;
                        margin-bottom: 20px;
                        align-items: center;
                    }
                    button {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        cursor: pointer;
                        border-radius: 4px;
                        font-size: 0.9em;
                        font-weight: 500;
                        transition: all 0.15s ease;
                    }
                    button:hover { 
                        background: var(--vscode-button-hoverBackground);
                        box-shadow: var(--shadow-sm);
                    }
                    button:active {
                        transform: translateY(1px);
                    }
                    button.secondary {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    button.secondary:hover { 
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    
                    .soft-override-banner {
                        margin-top: 16px;
                        padding: 12px 16px;
                        background: rgba(255, 193, 7, 0.1);
                        border-left: 3px solid var(--vscode-charts-yellow);
                        font-size: 0.85em;
                        border-radius: 4px;
                        line-height: 1.5;
                    }
                    .soft-override-banner code {
                        background: rgba(0,0,0,0.2);
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-family: monospace;
                    }
                    .empty-state {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100%;
                        opacity: 0.5;
                        font-size: 1.1em;
                    }
                    .btn-icon { 
                        padding: 4px 8px; 
                        font-size: 1.1em;
                        min-width: 28px;
                    }
                    .badge {
                        background: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 0.65em;
                        margin-left: 8px;
                        font-weight: 600;
                        letter-spacing: 0.3px;
                    }
                    
                    /* Scrollbar Styling */
                    ::-webkit-scrollbar {
                        width: 10px;
                        height: 10px;
                    }
                    ::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: var(--vscode-scrollbarSlider-background);
                        border-radius: 5px;
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background: var(--vscode-scrollbarSlider-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <!-- Sidebar -->
                    <div class="sidebar">
                        <div class="sidebar-header">
                            Projects
                            <button class="btn-icon" onclick="addProject()">+</button>
                        </div>
                        <div id="project-list" class="project-list">
                            <!-- JS injected -->
                        </div>
                    </div>

                    <!-- Main Content -->
                    <div class="main-content">
                        <div id="no-selection" class="empty-state">
                            <p>Select a project to view details</p>
                        </div>
                        
                        <div id="selection-view" style="display: none; height: 100%; flex-direction: column;">
                            <div class="main-header">
                                <div id="header-title" class="main-title">Project Name</div>
                                <div id="header-path" class="main-subtitle">/path/to/project</div>
                                <div class="soft-override-banner">
                                    <strong>Soft Override:</strong> Variables defined here are injected by the extension and do NOT modify your ACTUAL <code>.env</code> files.
                                </div>
                            </div>
                            
                            <div id="tabs-container" class="tabs">
                                <!-- JS injected tabs -->
                            </div>
                            
                            <div class="content-area">
                                <div class="action-bar">
                                    <button id="btn-set-active" onclick="setActive()">Set Active</button>
                                    <button class="secondary" onclick="addVar()">Add Variable</button>
                                </div>
                                
                                <div class="var-table-container">
                                    <table class="var-table">
                                        <thead>
                                            <tr>
                                                <th>Key</th>
                                                <th>Value</th>
                                            </tr>
                                        </thead>
                                        <tbody id="vars-body">
                                            <!-- JS injected vars -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    let projects = [];
                    let state = {
                        selectedProjectId: null,
                        selectedEnvId: null
                    }; // Simple local state

                    // Restore state if possible (optional, maybe later)

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'updateData':
                                projects = message.projects;
                                render();
                                break;
                        }
                    });

                    // Initial ready signal
                    vscode.postMessage({ command: 'ready' });

                    function render() {
                        renderProjects();
                        renderMainContent();
                    }

                    function renderProjects() {
                        const list = document.getElementById('project-list');
                        list.innerHTML = '';
                        
                        if (projects.length === 0) {
                            list.innerHTML = '<div style="padding:15px; opacity:0.6; text-align:center">No projects found.</div>';
                            return;
                        }

                        projects.forEach(p => {
                            const div = document.createElement('div');
                            div.className = \`project-item \${state.selectedProjectId === p.id ? 'selected' : ''}\`;
                            
                            // Header Row
                            const header = document.createElement('div');
                            header.className = 'project-header-row';
                            
                            const nameInfo = document.createElement('div');
                            nameInfo.style.flex = '1';
                            
                            const name = document.createElement('div');
                            name.className = 'project-name';
                            name.textContent = p.name;
                            name.onclick = () => selectProject(p.id); // Click name to select
                            
                            const path = document.createElement('div');
                            path.className = 'project-path';
                            path.textContent = p.path;
                            path.onclick = () => selectProject(p.id);
                            
                            nameInfo.appendChild(name);
                            nameInfo.appendChild(path);
                            
                            // Actions
                            const actions = document.createElement('div');
                            actions.className = 'proj-actions';
                            
                            const btnEdit = document.createElement('button');
                            btnEdit.className = 'icon-btn';
                            btnEdit.innerHTML = '&#9998;'; // Pencil
                            btnEdit.title = 'Rename Project';
                            btnEdit.onclick = (e) => { e.stopPropagation(); renameProject(p.id, p.name); };
                            
                            const btnDel = document.createElement('button');
                            btnDel.className = 'icon-btn';
                            btnDel.innerHTML = '&#128465;'; // Trash
                            btnDel.title = 'Delete Project';
                            btnDel.onclick = (e) => { e.stopPropagation(); deleteProject(p.id); };
                            
                            actions.appendChild(btnEdit);
                            actions.appendChild(btnDel);
                            
                            header.appendChild(nameInfo);
                            header.appendChild(actions);
                            
                            div.appendChild(header);
                            
                            if (p.activeEnvId) {
                                const badge = document.createElement('span');
                                badge.className = 'badge';
                                badge.innerText = p.environments.find(e => e.id === p.activeEnvId)?.name || '';
                                name.appendChild(badge);
                            }
                            
                            list.appendChild(div);
                        });
                    }

                    function renderMainContent() {
                        const noSel = document.getElementById('no-selection');
                        const view = document.getElementById('selection-view');
                        
                        if (!state.selectedProjectId) {
                            noSel.style.display = 'flex';
                            view.style.display = 'none';
                            return;
                        }

                        const project = projects.find(p => p.id === state.selectedProjectId);
                        if (!project) {
                            // Project might have been deleted
                            state.selectedProjectId = null;
                            render();
                            return;
                        }

                        noSel.style.display = 'none';
                        view.style.display = 'flex';

                        // Header
                        document.getElementById('header-title').textContent = project.name;
                        document.getElementById('header-path').textContent = project.path;

                        // Tabs
                        const tabsContainer = document.getElementById('tabs-container');
                        tabsContainer.innerHTML = '';
                        
                        // "Add Env" fake tab
                        const addEnvTab = document.createElement('div');
                        addEnvTab.className = 'tab';
                        addEnvTab.textContent = '+';
                        addEnvTab.onclick = () => addEnv();
                        tabsContainer.appendChild(addEnvTab);

                        if (!state.selectedEnvId && project.environments.length > 0) {
                            // Default select first or active
                            state.selectedEnvId = project.activeEnvId || project.environments[0].id;
                        } else if (project.environments.length === 0) {
                            state.selectedEnvId = null;
                        }
                        
                        project.environments.forEach(e => {
                            const tab = document.createElement('div');
                            tab.className = \`tab \${state.selectedEnvId === e.id ? 'active' : ''}\`;
                            tab.textContent = e.name;
                            if (project.activeEnvId === e.id) {
                                tab.textContent += '  (Active)';
                            }
                            tab.onclick = () => selectEnv(e.id);
                            
                             // Env Actions (only if active tab?) 
                             // Let's add simple double click to rename, or just a small context menu?
                             // Keep it simple: Add small controls if active, or just next to name
                             if (state.selectedEnvId === e.id) {
                                 const spanActions = document.createElement('span');
                                 spanActions.style.marginLeft = '10px';
                                 
                                 const btnRen = document.createElement('button');
                                 btnRen.className = 'icon-btn';
                                 btnRen.innerHTML = '&#9998;';
                                 btnRen.onclick = (evt) => { evt.stopPropagation(); renameEnv(project.id, e.id, e.name); };
                                 
                                 const btnDel = document.createElement('button');
                                 btnDel.className = 'icon-btn';
                                 btnDel.innerHTML = '&#128465;';
                                 btnDel.onclick = (evt) => { evt.stopPropagation(); deleteEnv(project.id, e.id); };
                                 
                                 spanActions.appendChild(btnRen);
                                 spanActions.appendChild(btnDel);
                                 tab.appendChild(spanActions);
                             }

                            tabsContainer.appendChild(tab);
                        });

                        // Active Env Details
                        renderEnvDetails(project);
                    }

                    function renderEnvDetails(project) {
                        const btnSetActive = document.getElementById('btn-set-active');
                        const tbody = document.getElementById('vars-body');
                        tbody.innerHTML = '';
                        
                        if (!state.selectedEnvId) {
                            // Show request to add env
                            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; opacity:0.6">No environment selected. Add one to start.</td></tr>';
                            btnSetActive.disabled = true;
                            return;
                        }

                        const env = project.environments.find(e => e.id === state.selectedEnvId);
                        if (!env) return;

                        // Update Set Active Button
                        if (project.activeEnvId === env.id) {
                            btnSetActive.textContent = 'Current Active';
                            btnSetActive.disabled = true;
                            btnSetActive.style.opacity = '0.7';
                        } else {
                            btnSetActive.textContent = 'Set as Active';
                            btnSetActive.disabled = false;
                            btnSetActive.style.opacity = '1';
                        }
                        
                        if (env.variables.length === 0) {
                             tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; opacity:0.6">No variables defined.</td></tr>';
                        } else {
                            env.variables.forEach(v => {
                                const tr = document.createElement('tr');
                                
                                const tdKey = document.createElement('td');
                                tdKey.className = 'var-key';
                                tdKey.textContent = v.key;
                                
                                const tdVal = document.createElement('td');
                                tdVal.className = 'var-value';
                                tdVal.textContent = v.value;
                                
                                const tdActs = document.createElement('td');
                                tdActs.className = 'var-actions';
                                
                                const btnEdit = document.createElement('button');
                                btnEdit.className = 'icon-btn';
                                btnEdit.innerHTML = '&#9998;';
                                btnEdit.onclick = () => editVar(project.id, env.id, v.key, v.value);
                                
                                const btnDel = document.createElement('button');
                                btnDel.className = 'icon-btn';
                                btnDel.innerHTML = '&#128465;';
                                btnDel.onclick = () => deleteVar(project.id, env.id, v.key);
                                
                                tdActs.appendChild(btnEdit);
                                tdActs.appendChild(btnDel);
                                
                                tr.appendChild(tdKey);
                                tr.appendChild(tdVal);
                                tr.appendChild(tdActs);
                                
                                tbody.appendChild(tr);
                            });
                        }
                    }

                    function selectProject(id) {
                        state.selectedProjectId = id;
                        state.selectedEnvId = null; // Reset env selection
                        render();
                    }

                    function selectEnv(id) {
                        state.selectedEnvId = id;
                        render();
                    }

                    function addProject() {
                        vscode.postMessage({ command: 'addProject' });
                    }

                    function addEnv() {
                        if (state.selectedProjectId) {
                            vscode.postMessage({ command: 'addEnv', projectId: state.selectedProjectId });
                        }
                    }
                    
                    function setActive() {
                         if (state.selectedProjectId && state.selectedEnvId) {
                            vscode.postMessage({ command: 'setActive', projectId: state.selectedProjectId, envId: state.selectedEnvId });
                        }
                    }
                    
                    function addVar() {
                        if (state.selectedProjectId && state.selectedEnvId) {
                            vscode.postMessage({ command: 'addVar', projectId: state.selectedProjectId, envId: state.selectedEnvId });
                        }
                    }

                    function deleteProject(id) {
                        vscode.postMessage({ command: 'deleteProject', projectId: id });
                    }
                    function renameProject(id, currentName) {
                        vscode.postMessage({ command: 'renameProject', projectId: id, currentName: currentName });
                    }
                    
                    function deleteEnv(pid, eid) {
                         vscode.postMessage({ command: 'deleteEnv', projectId: pid, envId: eid });
                    }
                    function renameEnv(pid, eid, currentName) {
                        vscode.postMessage({ command: 'renameEnv', projectId: pid, envId: eid, currentName: currentName });
                    }
                    
                    function deleteVar(pid, eid, key) {
                        vscode.postMessage({ command: 'deleteVar', projectId: pid, envId: eid, key: key });
                    }
                    function editVar(pid, eid, key, value) {
                        vscode.postMessage({ command: 'editVar', projectId: pid, envId: eid, key: key, value: value });
                    }

                </script>
            </body>
            </html>`;
    }
}
