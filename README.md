# NPM Manager - Visual Package Explorer

[![Version](https://img.shields.io/visual-studio-marketplace/v/sourabhr10122002.npm-manager-v2)](https://marketplace.visualstudio.com/items?itemName=sourabhr10122002.npm-manager-v2)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/sourabhr10122002.npm-manager-v2)](https://marketplace.visualstudio.com/items?itemName=sourabhr10122002.npm-manager-v2)
[![Open VSX](https://img.shields.io/open-vsx/v/sourabhr10122002/npm-manager)](https://open-vsx.org/extension/sourabhr10122002/npm-manager)

**NPM Manager** provides a modern, high-performance visual interface for managing your Node.js project's dependencies directly within VS Code. Say goodbye to terminal-only package management and hello to a beautiful, dashboard-driven workflow.

![NPM Manager Hero](icon.png)

## 🚀 Features

-   **📦 Visual Dependency Management:** A dedicated full-editor panel to view, sort, and manage all your project's dependencies.
-   **✨ Batch Updates:** Select multiple outdated packages and update them all at once with a single click.
-   **🔍 Live Registry Search:** Search the entire NPM registry from within VS Code and install packages (including dev dependencies) instantly.
-   **🛡️ Version Insights:** Clearly see installed vs. latest versions with color-coded badges (**PATCH**, **MINOR**, **MAJOR**).
-   **🎨 Premium UI:** A custom design system matched to the NPM brand colors, featuring glassmorphism, smooth transitions, and a dark mode optimized experience.
-   **⚡ Sidebar Welcome Widget:** A compact sidebar view for quick access, tips, and status at a glance.

## 🛠 Usage

### 1. Opening the Manager
There are three ways to launch the NPM Manager:
-   **Sidebar:** Click the **NPM** icon in the Activity Bar and press "Open Package Manager".
-   **Command Palette:** Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) and type **"Open NPM Manager"**.
-   **Shortcut:** Right-click your `package.json` file in the explorer (coming soon).

### 2. Managing Packages
-   **Installed Tab:** View all your current dependencies. Click "Update" on any individual package or use the checkboxes for batch actions.
-   **Updates Tab:** A focused view showing only packages that have newer versions available.
-   **Browse Tab:** Search the registry. Each result comes with a description and quick "Install" or "+ Dev" buttons.

## ⌨️ Command Palette

| Command | Description |
| :--- | :--- |
| `npm-manager.open` | Launch the main Visual Package Explorer panel |

## ⚙️ Requirements

-   **Node.js & NPM/Yarn/PNPM:** The extension automatically detects your package manager based on your lockfiles.
-   **VS Code:** Version 1.80.0 or higher.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---
Developed with ❤️ by [sourabhr10122002](https://github.com/sourabh10122002).
