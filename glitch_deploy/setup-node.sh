#!/bin/bash

# This script helps set up the right Node.js version on Glitch

# Check current Node.js version
echo "Current Node.js version:"
node -v

# Install Node.js 18 if not already installed
echo "Installing Node.js 18..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 18
nvm use 18

# Verify the version
echo "New Node.js version:"
node -v

# Install dependencies
echo "Installing dependencies..."
npm install --no-package-lock

echo "Setup complete! Please refresh your Glitch project."