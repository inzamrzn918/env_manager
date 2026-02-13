# Contributing to Environment Manager

Thank you for your interest in contributing to Environment Manager! This guide will help you get started.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)

## Code of Conduct

This project follows a simple code of conduct:
- Be respectful and inclusive
- Provide constructive feedback
- Focus on what's best for the community

## Getting Started

### Prerequisites
- Node.js 16.x or higher
- VS Code 1.80.0 or higher
- Git

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/env-manager.git
   cd env-manager
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Compile TypeScript**
   ```bash
   npm run compile
   ```

4. **Run the Extension**
   - Press `F5` in VS Code to open Extension Development Host
   - The extension will be loaded and ready for testing

## Making Changes

### Project Structure
```
env-manager/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── EnvManager.ts          # Core logic and storage
│   ├── EnvTreeDataProvider.ts # Sidebar TreeView
│   ├── EnvDashboard.ts        # Dashboard webview
│   └── types.ts               # Type definitions
├── resources/                 # Icons and assets
└── package.json              # Extension manifest
```

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages
Follow conventional commits:
```
feat: add workspace variable export
fix: resolve quote escaping in .env files
docs: update README with new features
refactor: extract file sync logic
```

## Submitting Changes

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clean, documented code
   - Follow existing code style
   - Add comments for complex logic

3. **Test Your Changes**
   - Run the extension in debug mode (F5)
   - Test all affected features
   - Verify no regressions

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

5. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Provide a clear description of changes
   - Reference any related issues

## Coding Standards

### TypeScript
- Use TypeScript strict mode
- Prefer `const` over `let`
- Use async/await over promises
- Add type annotations for public APIs

### Naming Conventions
- Classes: `PascalCase`
- Functions/Methods: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Private members: prefix with `_`

### Code Style
```typescript
// Good
async function saveProjects(projects: Project[]): Promise<void> {
    await this.secrets.store(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
}

// Avoid
function saveProjects(projects) {
    this.secrets.store(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
}
```

### Comments
- Use JSDoc for public APIs
- Add inline comments for complex logic
- Keep comments up-to-date with code

## Testing

### Manual Testing Checklist
- [ ] Add/delete projects
- [ ] Add/delete environments
- [ ] Add/edit/delete variables
- [ ] Switch between environments
- [ ] Toggle sync modes
- [ ] Import .env files
- [ ] Verify SecretStorage encryption
- [ ] Test with multiple workspaces

### Testing Different Scenarios
1. **Empty State**: Test with no projects
2. **Large Data**: Test with 10+ projects, 100+ variables
3. **Special Characters**: Test variables with quotes, newlines
4. **Theme Compatibility**: Test with light and dark themes

## Areas for Contribution

### High Priority
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Improve error handling
- [ ] Add telemetry (opt-in)

### Features
- [ ] Export/import project configurations
- [ ] Environment variable templates
- [ ] Variable validation rules
- [ ] Search/filter functionality
- [ ] Bulk edit operations

### Documentation
- [ ] Add screenshots to README
- [ ] Create video tutorial
- [ ] Add troubleshooting guide
- [ ] Improve inline documentation

### UI/UX
- [ ] Add keyboard shortcuts
- [ ] Improve accessibility
- [ ] Add context menus
- [ ] Enhance visual feedback

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
