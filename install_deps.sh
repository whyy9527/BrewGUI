#!/bin/bash

# Get the directory where this script is located
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Install server dependencies
if [ ! -d "$PROJECT_ROOT/server/node_modules" ]; then
  echo "Installing server dependencies..."
  (cd "$PROJECT_ROOT/server" && npm install)
else
  echo "Server dependencies already installed."
fi

# Install client dependencies
if [ ! -d "$PROJECT_ROOT/client/node_modules" ]; then
  echo "Installing client dependencies..."
  (cd "$PROJECT_ROOT/client" && npm install)
else
  echo "Client dependencies already installed."
fi