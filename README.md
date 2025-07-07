# BrewGUI

A simple, local web-based GUI for managing your Homebrew packages.

This application provides a clean interface to view all your installed Homebrew formulae and casks, see a brief description for each, and uninstall them easily.

## Features

-   **Categorized View**: Packages are automatically grouped by function (e.g., Image & Graphics, Video & Audio, Development Tools) based on their descriptions.
-   **Enhanced Search (Installed)**: Quickly find installed packages by searching their name, description, or even their assigned category.
-   **Install New Packages**: Search the Homebrew repository for new formulae and casks. Results are displayed concisely with a 'Details' button to view full information before installation.
-   **Update Packages**: View all outdated packages and update them individually or all at once with a single click.
-   **Detailed Information**: Click the "Details" button next to any package (installed or search result) to view its full official information from Homebrew in a modal window.
-   **Uninstall Packages**: Easily uninstall any installed formula or cask directly from the interface.
-   **Dependency Grouping**: Toggle to group installed packages by whether they are core packages or dependencies of other installed packages, aiding safer uninstallation.

## Prerequisites

- [Node.js](https://nodejs.org/) (which includes npm)
- [Homebrew](https://brew.sh/)

## Installation

1.  **Clone or download this repository.**

2.  **Register the `brewgui` alias and install dependencies.**

    Open your terminal, navigate to the `BrewGUI` project root directory (the directory where you cloned or downloaded this project, containing `README.md`, `server`, and `client` folders), and run the setup script:

    ```bash
    ./register_alias.sh
    ```

    This script will:
    -   Add or update the `brewgui` alias in your `~/.zshrc` file, pointing to the correct project location.
    -   Automatically install all necessary Node.js dependencies for both the server and client parts of the application.

    After running the script, you might need to reload your shell configuration for the alias to take effect:

    ```bash
    source ~/.zshrc
    # Or simply open a new terminal window.
    ```

## Usage

Once the alias is registered, simply open your terminal and run:

```bash
brewgui
```

This command will simultaneously start the backend server and the frontend React application. It should also automatically open a new tab in your default web browser and navigate to `http://localhost:3000`.

If the browser tab does not open automatically, you can manually navigate to [http://localhost:3000](http://localhost:3000) after running the command.

To stop the application, go back to the terminal where you ran the command and press `Ctrl+C`.