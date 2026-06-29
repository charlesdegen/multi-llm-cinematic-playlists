#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
else
  source .venv/bin/activate
fi

lsof -ti:8501 | xargs kill 2>/dev/null || true
sleep 1

open "http://127.0.0.1:8501"
exec streamlit run app.py