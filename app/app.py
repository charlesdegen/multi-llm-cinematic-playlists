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
DEFAULT_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "https://127.0.0.1:8501/")

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
        if not all(k in t for k in ["position", "title", "artist", "why_this_track", "cinematic_moment"]):
            continue
        key = normalize_key(t["title"], t["artist"])
        tracks.append({
            "key": key,
            "position": int(t.get("position", 99)),
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

def get_spotify_client():
    client_id = st.session_state.get("spotify_client_id") or os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = st.session_state.get("spotify_client_secret") or os.getenv("SPOTIFY_CLIENT_SECRET")
    redirect_uri = st.session_state.get("spotify_redirect_uri", DEFAULT_REDIRECT_URI)
    if not client_id or not client_secret: return None
    try:
        auth_manager = SpotifyOAuth(client_id=client_id, client_secret=client_secret, redirect_uri=redirect_uri,
            scope="playlist-modify-private playlist-modify-public", cache_path=".streamlit/spotify_cache", show_dialog=True)
        sp = spotipy.Spotify(auth_manager=auth_manager)
        sp.current_user()
        return sp
    except Exception as e:
        st.error(f"Spotify auth failed: {e}")
        return None

def search_track(sp, title, artist):
    try:
        results = sp.search(q=f'track:"{title}" artist:"{artist}"', limit=5, type="track")
        if results["tracks"]["items"]:
            return results["tracks"]["items"][0]["uri"]
    except:
        pass
    return None

def create_playlist_from_df(sp, df, name, description):
    user = sp.current_user()
    try:
        playlist = sp.user_playlist_create(user=user["id"], name=name, public=False, description=description[:300])
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

# UI
st.title("🎬 Multi-LLM Cinematic Playlists")
st.caption("Aggregate. Curate. Ship. — One soundtrack, many directors' cuts.")

with st.sidebar:
    st.header("Spotify Connection")
    client_id = st.text_input("Spotify Client ID", value=st.session_state.get("spotify_client_id", ""), type="password")
    client_secret = st.text_input("Spotify Client Secret", value=st.session_state.get("spotify_client_secret", ""), type="password")
    redirect = st.text_input(
        "Redirect URI",
        value=st.session_state.get("spotify_redirect_uri", DEFAULT_REDIRECT_URI),
        help="Must match your Spotify dashboard character-for-character (https vs http, trailing slash, port).",
    )
    if st.button("Save Credentials & Test"):
        st.session_state.spotify_client_id = client_id
        st.session_state.spotify_client_secret = client_secret
        st.session_state.spotify_redirect_uri = redirect.strip()
        if get_spotify_client():
            st.success("✅ Connected")
            st.session_state.spotify_connected = True
        else:
            st.error("Failed — check that Redirect URI matches Spotify dashboard exactly.")
    saved_redirect = st.session_state.get("spotify_redirect_uri", redirect.strip())
    if saved_redirect:
        st.caption(f"Auth will send: `{saved_redirect}`")
    if st.session_state.get("spotify_connected"): st.success("Spotify connected")
    else: st.info("Enter credentials to enable playlist creation.")

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
        display = display.rename(columns={"final_position": "Pos", "title": "Track", "artist": "Artist", "album": "Album", "why": "Why it fits", "sources": "Recommended by", "count": "Votes"})
        edited = st.data_editor(display, hide_index=True, use_container_width=True, num_rows="dynamic")
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