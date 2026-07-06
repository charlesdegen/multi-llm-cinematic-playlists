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

if command -v open >/dev/null; then
  open "http://127.0.0.1:8501"
elif command -v xdg-open >/dev/null; then
  xdg-open "http://127.0.0.1:8501"
fi
exec streamlit run app.py