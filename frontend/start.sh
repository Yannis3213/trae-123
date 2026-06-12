#!/usr/bin/env bash

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "Starting frontend dev server on port 3108..."
npm run dev
