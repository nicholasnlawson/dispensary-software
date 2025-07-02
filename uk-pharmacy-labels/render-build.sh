#!/bin/bash
# Render build script for pharmacy dispensing system

echo "Starting Render build process..."

# Install dependencies
npm install

# Ensure SQLite directory exists
mkdir -p server/db/sqlite

# Remove any pre-built SQLite3 binaries
rm -rf node_modules/sqlite3/build

# Force rebuild of SQLite3 from source
npm rebuild sqlite3 --build-from-source

echo "Build process completed successfully"
