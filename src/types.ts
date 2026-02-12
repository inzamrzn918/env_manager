
// Interface Definitions

export interface EnvVariable {
    key: string;
    value: string;
    enabled: boolean;
}

export interface Environment {
    id: string;
    name: string;
    variables: EnvVariable[];
}

export interface Project {
    id: string;
    name: string;
    path: string;
    environments: Environment[];
    activeEnvId?: string;
}

// Global State Keys
export const STORAGE_KEY_PROJECTS = 'envManager.projects';
export const WORKSPACE_KEY_ENV_OVERRIDES = 'envManager.overrides';
