#!/usr/bin/env bash

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate

if [ ! -f ".venv/.installed" ]; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
    touch .venv/.installed
fi

export PYTHONPATH="$PWD"

echo "Initializing database..."
python -m app.init_db

echo "Starting backend server on port 8108..."
uvicorn app.main:app --host 0.0.0.0 --port 8108 --reload
