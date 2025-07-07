#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BREWGUI_PATH="$SCRIPT_DIR"

ALIAS_COMMAND="alias brewgui='"$BREWGUI_PATH/install_deps.sh" && cd "$BREWGUI_PATH/server" && npm start'"

# Check if the alias already exists in ~/.zshrc
if grep -q "alias brewgui=" ~/.zshrc; then
    echo "Updating existing 'brewgui' alias in ~/.zshrc..."
    sed -i '' "/alias brewgui=/c\n# Alias for BrewGUI application\n$ALIAS_COMMAND" ~/.zshrc
else
    echo "Adding 'brewgui' alias to ~/.zshrc..."
    echo "\n# Alias for BrewGUI application\n$ALIAS_COMMAND" >> ~/.zshrc
fi

echo "Alias registered. Please run 'source ~/.zshrc' or open a new terminal to apply changes."
