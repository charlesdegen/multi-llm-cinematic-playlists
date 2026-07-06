#!/usr/bin/env python3
"""
Multi-LLM Cinematic Playlists — Streamlit App
Aggregate soundtrack recommendations from Claude, GPT, Gemini, Grok, etc.
Curate → Create real Spotify playlist.
"""

import streamlit as st
import pandas as pd
import json
import re
from typing import Dict, List, Any, Optional
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from spotipy.cache_handler import CacheHandler
from spotipy.exceptions import SpotifyException
import os
from datetime import datetime

st.set_page_config(
    page_title="Multi-LLM Cinematic Playlists",
    page_icon="🎬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ----------------------------- CONSTANTS & HELPERS -----------------------------
REQUIRED_FIELDS = ["position", "title", "artist", "why_this_track", "cinematic_moment"]
DEFAULT_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8501")

def _spotify_secret(key: str, default: str = "") -> str:
    env_keys = {
        "client_id": "SPOTIFY_CLIENT_ID",
        "client_secret": "SPOTIFY_CLIENT_SECRET",
        "redirect_uri": "SPOTIFY_REDIRECT_URI",
    }
    env_val = os.getenv(env_keys.get(key, ""), "")
    if env_val:
        return env_val
    try:
        return st.secrets["spotify"][key]
    except (KeyError, FileNotFoundError, AttributeError, TypeError):
        return default

def ensure_spotify_defaults():
    if not st.session_state.get("spotify_client_id"):
        st.session_state.spotify_client_id = _spotify_secret("client_id")
    if not st.session_state.get("spotify_client_secret"):
        st.session_state.spotify_client_secret = _spotify_secret("client_secret")
    secret_redirect = _spotify_secret("redirect_uri", DEFAULT_REDIRECT_URI)
    if secret_redirect:
        st.session_state.spotify_redirect_uri = secret_redirect
    elif not st.session_state.get("spotify_redirect_uri"):
        st.session_state.spotify_redirect_uri = DEFAULT_REDIRECT_URI

def normalize_key(title: str, artist: str) -> str:
    """Create stable key for deduplication."""
    t = re.sub(r'[^\w\s]', '', title.lower().strip())
    a = re.sub(r'[^\w\s]', '', artist.lower().strip())
    return f"{t}::{a}"

def extract_json_from_text(text: str) -> Optional[Dict]:
    """Try to extract the first valid JSON object from messy LLM output."""
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    fence_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if fence_match:
        try:
            return json.loads(fence_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    return None

def parse_llm_response(raw_text: str, source_name: str) -> Dict[str, Any]:
    data = extract_json_from_text(raw_text)
    if not data or "tracks" not in data:
        st.error(f"Could not parse valid JSON from {source_name}. Make sure the model followed the strict JSON instruction.")
        return {"error": True, "source": source_name}

    tracks = []
    for t in data.get("tracks", []):
        if not isinstance(t, dict) or not all(k in t for k in REQUIRED_FIELDS):
            continue
        key = normalize_key(t["title"], t["artist"])
        try:
            position = int(float(t.get("position", 99)))
        except (TypeError, ValueError):
            position = len(tracks) + 1
        tracks.append({
            "key": key,
            "position": position,
            "title": t["title"].strip(),
            "artist": t["artist"].strip(),
            "album": t.get("album", "").strip(),
            "why_this_track": t.get("why_this_track", ""),
            "cinematic_moment": t.get("cinematic_moment", ""),
            "energy": t.get("energy", "medium"),
            "source": source_name
        })

    concept = {
        "playlist_title": data.get("playlist_title", f"{source_name} Soundtrack"),
        "playlist_description": data.get("playlist_description", ""),
        "movie_concept": data.get("movie_concept", {}),
        "mood_tags": data.get("mood_tags", []),
        "narrative_arc": data.get("narrative_arc", "")
    }

    return {
        "error": False,
        "source": source_name,
        "concept": concept,
        "tracks": tracks,
        "raw": data
    }

def merge_tracks(all_imports: List[Dict]) -> pd.DataFrame:
    merged = {}
    for imp in all_imports:
        if imp.get("error"): continue
        src = imp["source"]
        for t in imp["tracks"]:
            key = t["key"]
            if key not in merged:
                merged[key] = {
                    "key": key, "title": t["title"], "artist": t["artist"], "album": t.get("album", ""),
                    "why": t.get("why_this_track", ""), "cinematic_moment": t.get("cinematic_moment", ""),
                    "energy": t.get("energy", "medium"), "sources": [src], "positions": [t["position"]], "count": 1
                }
            else:
                if src not in merged[key]["sources"]:
                    merged[key]["sources"].append(src)
                    merged[key]["count"] += 1
                if not merged[key]["why"] and t.get("why_this_track"):
                    merged[key]["why"] = t["why_this_track"]
                if not merged[key]["cinematic_moment"] and t.get("cinematic_moment"):
                    merged[key]["cinematic_moment"] = t["cinematic_moment"]

    if not merged: return pd.DataFrame()
    df = pd.DataFrame(list(merged.values()))
    df["avg_position"] = df["positions"].apply(lambda x: sum(x) / len(x) if x else 99)
    df = df.sort_values("avg_position").reset_index(drop=True)
    df["final_position"] = range(1, len(df) + 1)
    return df

def get_spotify_credentials():
    ensure_spotify_defaults()
    client_id = st.session_state.get("spotify_client_id") or _spotify_secret("client_id")
    client_secret = st.session_state.get("spotify_client_secret") or _spotify_secret("client_secret")
    redirect_uri = st.session_state.get("spotify_redirect_uri") or _spotify_secret("redirect_uri", DEFAULT_REDIRECT_URI)
    return client_id, client_secret, redirect_uri

class SessionCacheHandler(CacheHandler):
    """Keep the OAuth token in Streamlit session state so concurrent users
    never share a token (a single cache file on disk would leak sessions)."""

    def get_cached_token(self):
        return st.session_state.get("spotify_token_info")

    def save_token_to_cache(self, token_info):
        st.session_state.spotify_token_info = token_info

def make_auth_manager(client_id: str, client_secret: str, redirect_uri: str) -> SpotifyOAuth:
    return SpotifyOAuth(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope="playlist-modify-private playlist-modify-public",
        cache_handler=SessionCacheHandler(),
        show_dialog=True,
        open_browser=False,
    )

def handle_oauth_callback():
    """Complete Spotify OAuth when the user returns with ?code= in the URL."""
    error = st.query_params.get("error")
    if error:
        st.session_state.spotify_auth_error = f"Spotify authorization denied: {error}"
        st.query_params.clear()
        return

    code = st.query_params.get("code")
    if not code:
        return

    client_id, client_secret, redirect_uri = get_spotify_credentials()
    if not client_id or not client_secret:
        st.session_state.spotify_auth_error = (
            "Spotify authorized you, but credentials were lost. "
            "Re-enter Client ID and Secret, save, then click Connect to Spotify again."
        )
        st.query_params.clear()
        return

    try:
        auth_manager = make_auth_manager(client_id, client_secret, redirect_uri)
        auth_manager.get_access_token(code=code, as_dict=False, check_cache=False)
        st.session_state.spotify_connected = True
        st.session_state.pop("spotify_auth_error", None)
        st.query_params.clear()
        st.rerun()
    except Exception as e:
        st.session_state.spotify_auth_error = f"Spotify auth failed: {e}"
        st.query_params.clear()

def get_spotify_client():
    client_id, client_secret, redirect_uri = get_spotify_credentials()
    if not client_id or not client_secret:
        return None
    try:
        auth_manager = make_auth_manager(client_id, client_secret, redirect_uri)
        token_info = auth_manager.validate_token(auth_manager.cache_handler.get_cached_token())
        if not token_info:
            st.session_state.spotify_connected = False
            return None
        st.session_state.spotify_connected = True
        return spotipy.Spotify(auth_manager=auth_manager)
    except Exception as e:
        st.session_state.spotify_connected = False
        st.error(f"Spotify auth failed: {e}")
        return None

def search_track(sp, title, artist):
    try:
        results = sp.search(q=f'track:"{title}" artist:"{artist}"', limit=5, type="track")
        if results["tracks"]["items"]:
            return results["tracks"]["items"][0]["uri"]
    except SpotifyException as e:
        st.warning(f"Spotify search failed for {title} — {artist}: {e}")
    return None

def create_playlist_from_df(sp, df, name, description):
    try:
        playlist = sp.current_user_playlist_create(name=name, public=False, description=description[:300])
        playlist_id = playlist["id"]
        playlist_url = playlist["external_urls"]["spotify"]
        uris, failed = [], []
        for _, row in df.iterrows():
            uri = search_track(sp, row["title"], row["artist"])
            if uri: uris.append(uri)
            else: failed.append(f"{row['title']} — {row['artist']}")
        for i in range(0, len(uris), 100):
            sp.playlist_add_items(playlist_id, uris[i:i+100])
        if failed:
            st.warning("Some tracks not found on Spotify (add manually):\n" + "\n".join(failed[:10]))
        return playlist_url
    except Exception as e:
        st.error(f"Failed to create playlist: {e}")
        return None

ensure_spotify_defaults()
handle_oauth_callback()

# UI
st.title("🎬 Multi-LLM Cinematic Playlists")
st.caption("Aggregate. Curate. Ship. — One soundtrack, many directors' cuts.")
st.info("Local URL: **http://127.0.0.1:8501** — do not use `https://` or the track table will fail to load.")

with st.sidebar:
    st.header("Spotify Connection")
    client_id = st.text_input("Spotify Client ID", value=st.session_state.get("spotify_client_id", ""), type="password", key="spotify_client_id_input")
    client_secret = st.text_input("Spotify Client Secret", value=st.session_state.get("spotify_client_secret", ""), type="password", key="spotify_client_secret_input")
    redirect = st.text_input(
        "Redirect URI",
        value=st.session_state.get("spotify_redirect_uri", DEFAULT_REDIRECT_URI),
        help="Must match Spotify dashboard exactly. Local dev: http://127.0.0.1:8501",
    )
    if st.button("Save Credentials"):
        st.session_state.spotify_client_id = client_id
        st.session_state.spotify_client_secret = client_secret
        st.session_state.spotify_redirect_uri = redirect.strip()
        st.session_state.spotify_connected = False
        st.session_state.pop("spotify_auth_error", None)
        st.success("Credentials saved")
        st.rerun()

    saved_redirect = st.session_state.get("spotify_redirect_uri", redirect.strip())
    if saved_redirect:
        st.caption(f"Auth will send: `{saved_redirect}`")

    if st.session_state.get("spotify_auth_error"):
        st.error(st.session_state.spotify_auth_error)

    sp = get_spotify_client()
    if sp:
        st.success("✅ Spotify connected")
    elif st.session_state.get("spotify_client_id") and st.session_state.get("spotify_client_secret"):
        auth_manager = make_auth_manager(
            st.session_state.spotify_client_id,
            st.session_state.spotify_client_secret,
            st.session_state.get("spotify_redirect_uri", DEFAULT_REDIRECT_URI),
        )
        st.link_button("Connect to Spotify", auth_manager.get_authorize_url(), width="stretch")
        st.caption("Click to authorize — you'll return here automatically.")
    else:
        st.info("Enter credentials and save to enable playlist creation.")

st.header("1. Import LLM Responses")
col1, col2 = st.columns([1, 2])
with col1:
    source_name = st.selectbox("LLM / Model", ["Claude 3.5/4", "GPT-4o / o3", "Gemini 1.5/2.5", "Grok 3/4", "Llama 4 / Other", "Custom"])
    if source_name == "Custom": source_name = st.text_input("Custom label", value="Custom LLM")
    raw_input = st.text_area(f"Paste full JSON from {source_name}", height=280)
    if st.button("Import", type="primary"):
        if raw_input.strip():
            parsed = parse_llm_response(raw_input, source_name)
            if not parsed.get("error"):
                if "imports" not in st.session_state: st.session_state.imports = []
                # Re-importing the same model replaces it instead of double-counting votes
                st.session_state.imports = [i for i in st.session_state.imports if i["source"] != source_name]
                st.session_state.imports.append(parsed)
                st.success(f"Imported {len(parsed.get('tracks', []))} tracks")
                st.rerun()
with col2:
    if "imports" in st.session_state and st.session_state.imports:
        for i, imp in enumerate(st.session_state.imports):
            if imp.get("error"): continue
            with st.expander(f"**{imp['source']}** — {len(imp.get('tracks', []))} tracks"):
                if st.button(f"Remove {imp['source']}", key=f"rm_{i}"):
                    st.session_state.imports.pop(i)
                    st.rerun()

st.header("2. Master Soundtrack")
if "imports" in st.session_state and st.session_state.imports:
    df = merge_tracks(st.session_state.imports)
    if not df.empty:
        first = st.session_state.imports[0].get("concept", {})
        if first.get("movie_concept"):
            mc = first["movie_concept"]
            st.markdown(f"**Primary Concept:** *{mc.get('title')}* — {mc.get('logline', '')}")
        display = df[["final_position", "title", "artist", "album", "why", "sources", "count"]].copy()
        display["sources"] = display["sources"].apply(lambda x: ", ".join(x))
        # Keep canonical column names so edited rows still work for playlist creation;
        # column_config only relabels the UI.
        edited = st.data_editor(
            display, hide_index=True, width="stretch", num_rows="dynamic",
            column_config={
                "final_position": st.column_config.NumberColumn("Pos"),
                "title": st.column_config.TextColumn("Track"),
                "artist": st.column_config.TextColumn("Artist"),
                "album": st.column_config.TextColumn("Album"),
                "why": st.column_config.TextColumn("Why it fits"),
                "sources": st.column_config.TextColumn("Recommended by"),
                "count": st.column_config.NumberColumn("Votes"),
            },
        )
        if st.button("Apply Edits"):
            st.session_state.master_df = edited
            st.success("Edits saved")
            st.rerun()
        final_df = st.session_state.get("master_df", df)
        st.subheader("3. Create Spotify Playlist")
        pname = st.text_input("Playlist Name", value=first.get("playlist_title", "Multi-LLM Cinematic Soundtrack"))
        pdesc = st.text_area("Description", value=first.get("playlist_description", "Aggregated from multiple frontier LLMs."), height=80)
        if st.button("🎵 Create Private Playlist on Spotify", type="primary"):
            sp = get_spotify_client()
            if sp:
                url = create_playlist_from_df(sp, final_df, pname, pdesc)
                if url:
                    st.success("Created!")
                    st.markdown(f"[Open in Spotify]({url})")
                    st.balloons()
            else:
                st.error("Connect Spotify in sidebar first.")
else:
    st.info("Import at least one LLM JSON response to begin.")

st.caption("Built for operators. MIT licensed. Iterate on GitHub.")