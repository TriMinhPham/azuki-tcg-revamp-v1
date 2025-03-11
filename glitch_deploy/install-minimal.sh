#!/bin/bash

# This script installs a minimal version of the server compatible with Node.js 10

echo "Installing minimal server compatible with Node.js 10..."

# Copy minimal configuration files
cp minimal-package.json package.json
cp minimal-glitch.json glitch.json

# Install dependencies
npm install

echo "Installation complete! The minimal server is ready to run."
echo "Start the server with: npm start"