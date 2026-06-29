# Changelog

All notable changes to this project are documented here.

## [0.2.0] — 2026-06-28

End-to-end local dev session: got Spotify OAuth working, fixed playlist creation against Spotify's 2026 API, and shipped a real private playlist ([LAMINAR — Phase Zero](https://open.spotify.com/playlist/1UVFi8NbNmr4JghKnR7z3y)).

### Added

- **Streamlit-native Spotify OAuth flow** — detects `?code=` on redirect, exchanges it for a token, clears query params, and marks the session connected. Replaces spotipy's CLI/local-server flow, which does not work inside a Streamlit web app.
- **Connect to Spotify** link button in the sidebar — separate from saving credentials; opens Spotify authorize in the browser and returns to the app automatically.
- **Local credential prefill** via `app/.streamlit/secrets.toml` (gitignored) with fallback to `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REDIRECT_URI` environment variables.
- **`app/.streamlit/secrets.toml.example`** — template for new clones; copy to `secrets.toml` and fill in your Spotify app credentials.
- **`app/start.sh`** — one-command local launch: ensures venv, kills anything on port 8501, opens `http://127.0.0.1:8501`, and starts Streamlit.
- **Sidebar auth debugging** — shows the exact redirect URI sent to Spotify (`Auth will send: …`) and surfaces OAuth callback errors in plain language.
- **In-app HTTP reminder** — banner noting local dev must use `http://127.0.0.1:8501`, not `https://`.

### Changed

- **Default redirect URI** → `http://127.0.0.1:8501` (loopback, no trailing slash).
- **Streamlit server binding** → `127.0.0.1:8501` in `app/.streamlit/config.toml`.
- **Spotify credentials UX** — "Save Credentials & Test" split into **Save Credentials** + **Connect to Spotify** so OAuth does not fire before credentials are persisted in session state.
- **Playlist creation endpoint** — `user_playlist_create()` → `current_user_playlist_create()` (`POST /me/playlists`). Required after Spotify's February 2026 Development Mode changes; the old `POST /users/{id}/playlists` route returns 403 Forbidden.
- **Streamlit widget API** — `use_container_width=True` → `width="stretch"` on `st.data_editor` and `st.link_button` (deprecation warnings in Streamlit 1.58).
- **`.gitignore`** — broadened to `**/.streamlit/secrets.toml` and `**/.streamlit/spotify_cache` so local secrets and OAuth tokens under `app/.streamlit/` are never committed.

### Fixed

- **`redirect_uri: Not matching configuration`** — Spotify requires the authorize-request URI to match the dashboard entry character-for-character. Resolved by aligning on `http://127.0.0.1:8501` (scheme, host, port, and trailing-slash must all match).
- **OAuth loop / "start again" after Agree** — credentials were saved but the auth code in the URL was never exchanged; page reload appeared to reset state. Fixed with `handle_oauth_callback()` at app startup.
- **403 Forbidden on playlist create** — `https://api.spotify.com/v1/users/{id}/playlists` blocked in Development Mode; switched to `/me/playlists`.
- **`Unable to preload CSS for …/DataFrame.*.css`** — self-signed HTTPS caused the browser to block Streamlit static assets after Import (track table would not render). Reverted local dev to plain HTTP; Spotify explicitly allows HTTP for loopback addresses (`127.0.0.1`).
- **Credentials lost on OAuth return** — `ensure_spotify_defaults()` loads from `secrets.toml` before callback handling so Client ID/Secret survive the Spotify redirect.

### Removed

- **Local HTTPS / self-signed certs** for Streamlit — attempted to satisfy Spotify dashboard "insecure URI" warnings, but broke the DataFrame UI. HTTP loopback is the supported local-dev path per [Spotify redirect URI docs](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).

### Local dev checklist (as of this release)

1. Spotify Dashboard → Redirect URI: `http://127.0.0.1:8501` → **Save**
2. Copy `app/.streamlit/secrets.toml.example` → `app/.streamlit/secrets.toml` and add credentials
3. Run `cd app && ./start.sh` (or `streamlit run app.py`)
4. Open **`http://127.0.0.1:8501`** — not `https://`, not `localhost`
5. **Save Credentials** → **Connect to Spotify** → Agree
6. Paste LLM JSON → **Import** → **Create Private Playlist on Spotify**

---

## [0.1.1] — 2026-06-28

Intermediate commit while debugging Spotify redirect requirements.

### Changed

- Default redirect URI moved from `http://localhost:8501` to `https://127.0.0.1:8501/` (later revised in 0.2.0).
- Streamlit bound to `127.0.0.1:8501` with optional self-signed SSL cert paths in config.

### Added

- Self-signed cert generation instructions in `.gitignore` for `app/.streamlit/certs/`.

---

## [0.1.0] — 2026-06-28

Initial working release.

### Added

- Universal LLM prompt (`prompts/universal_movie_soundtrack_prompt.txt`) for strict JSON soundtrack output.
- Streamlit app (`app/app.py`) — multi-model JSON import, deduplicated master tracklist with source tags and vote counts, editable data grid, Spotify playlist creation.
- Sample Claude response (`docs/sample_claude_response.json`).
- Dependencies: Streamlit, spotipy, pandas, rapidfuzz.
- README with user flow, Spotify setup notes, and roadmap.