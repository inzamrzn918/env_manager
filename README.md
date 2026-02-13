# Environment Manager

Manage environment variables across multiple projects and environments with ease. Switch between DEV, UAT, PROD, and custom environments instantly.

## Features

### 📁 Multi-Project Support
- Manage environment variables for multiple projects in one place
- Import existing `.env` files
- Organize variables by environment (DEV, UAT, PROD, etc.)

### 🔄 Dual Sync Modes
- **Terminal Injection**: Variables injected into VS Code integrated terminal
- **File Sync**: Automatically update `.env` files with backup protection

### 🎯 Quick Environment Switching
- Switch between environments with one click
- Visual indicators show active environment
- TreeView sidebar for easy navigation

### 🔐 Secure Storage
- Environment variables encrypted using VS Code SecretStorage
- Sensitive data protected with OS-level encryption

### 🎨 Modern UI
- Clean TreeView with colored icons
- Full-featured Dashboard for detailed management
- Responsive design that adapts to your theme

## Usage

### Getting Started

1. **Open the Sidebar**: Click the Environment Manager icon in the Activity Bar
2. **Add a Project**: Click the `+` button in the sidebar
3. **Import or Create**: Choose to import an existing `.env` file or start fresh
4. **Add Environments**: Create multiple environments (DEV, UAT, PROD)
5. **Add Variables**: Define your environment variables
6. **Set Active**: Click "Set Active" to apply an environment

### Sync Modes

**Terminal Injection Mode** (Default)
- Variables are injected into new terminal sessions
- Your `.env` files remain unchanged
- Perfect for development

**File Sync Mode**
- Automatically updates `.env` files
- Creates backups before modifying
- Ideal for deployment workflows

Toggle between modes using the sync button in the toolbar.

### Commands

- `Env Manager: Add Project` - Add a new project
- `Env Manager: Open Dashboard` - Open the full dashboard
- `Env Manager: Toggle Sync Mode` - Switch between terminal/file sync
- `Env Manager: Refresh` - Refresh the view

## Requirements

- VS Code 1.80.0 or higher

## Extension Settings

This extension stores data securely using VS Code's SecretStorage API. No additional configuration required.

## Known Issues

- Sync mode toggle requires window reload to take full effect
- Large `.env` files (>1000 lines) may experience slight delays

## Release Notes

### 0.0.1

Initial release:
- Multi-project environment management
- Dual sync modes (terminal/file)
- Secure encrypted storage
- Modern UI with TreeView and Dashboard
- Import from existing `.env` files

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Setting up your development environment
- Coding standards and best practices
- How to submit pull requests
- Areas where we need help

Found a bug or have a feature request? Please [open an issue](https://github.com/yourusername/env-manager/issues).

## License

MIT

---

**Enjoy managing your environment variables!** 🚀
