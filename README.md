# Multi-LLM Cinematic Playlists

**Turn every frontier LLM's understanding of you into one killer Spotify soundtrack.**

Paste responses from Claude, GPT-4o, Gemini, Grok, or any other model into this tool. Merge, curate, and ship a real private Spotify playlist in under 60 seconds.

## The Core Idea (First Principles)

Every major LLM has a slightly different "read" on your personality, values, current chapter, and aesthetic because of its training, system prompt, and your conversation history with it. 

Instead of picking one, we **aggregate the directors' cuts**.

The result is a richer, more truthful "movie of your life right now" soundtrack than any single model could produce.

## How It Works (User Flow)

1. **Copy the universal prompt** (`prompts/universal_movie_soundtrack_prompt.txt`)
2. Paste it into an existing long conversation thread with Claude / ChatGPT / Gemini / Grok (the longer the history, the better the signal).
3. Let the model output the strict JSON.
4. Come back here → paste each JSON response into the corresponding slot.
5. Review the unified tracklist (tracks are tagged with which models recommended them).
6. Edit, reorder, delete, or boost favorites.
7. Hit **Create Spotify Playlist** → authenticate once → done. Private playlist appears in your library with the cinematic description.

## Why This Beats Single-LLM Playlists

- **Signal amplification**: Different models surface different tracks and different "why it fits" angles.
- **Error correction**: One model hallucinates a bad match → the others usually don't.
- **Narrative depth**: You get multiple cinematic interpretations of the same life chapter.
- **Zero lock-in**: You stay in control. No black-box "AI playlist" you can't edit.

## Quick Start (Local)

```bash
cd app
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
streamlit run app.py
```

Then open http://localhost:8501

## Deploy (Free)

### Option A — Streamlit Community Cloud (easiest)
1. Push this repo to GitHub.
2. Go to share.streamlit.io → deploy from repo.
3. Add your Spotify Client ID + Secret as secrets (see below).

### Option B — Hugging Face Spaces
Even simpler for public demos.

## Spotify App Setup (Required for Playlist Creation)

1. Go to https://developer.spotify.com/dashboard
2. Create a new app.
3. Set **Redirect URI** to: `http://localhost:8501` (for local) or your deployed URL.
4. Copy Client ID and Client Secret.
5. In the app, you will be prompted to enter them on first use (or set as env vars / Streamlit secrets).

The tool uses the official Spotify Web API + spotipy. It only creates **private** playlists and never stores your data.

## File Structure

```
multi-llm-cinematic-playlists/
├── README.md
├── prompts/
│   └── universal_movie_soundtrack_prompt.txt   # The one prompt that works across all frontier models
├── app/
│   ├── app.py                  # Main Streamlit application
│   ├── requirements.txt
│   └── .streamlit/
│       └── config.toml
└── docs/
    └── sample_claude_response.json
```

## Prompt Philosophy (Why It Is Written This Way)

- Forces **strict JSON** → zero parsing ambiguity across models.
- Makes the LLM do deep context work first (silent step) before composing.
- Explicitly asks for real, searchable tracks + cinematic "why".
- Narrative arc instruction prevents random shuffle.
- Works in ongoing threads (leverages full history) or with pasted bio summary.
- Tuned to elicit the unique strengths of each model (Claude's nuance, Grok's directness, GPT's structure, Gemini's breadth).

## Roadmap / Iteration Ideas (GitHub Issues Welcome)

- [ ] Fuzzy track matching + manual URI override
- [ ] One-click "boost track from all models" 
- [ ] Auto-generate playlist cover using Grok Imagine or DALL·E (via user-provided key)
- [ ] Export as JSON for other tools (Playlist Push, Soundiiz, etc.)
- [ ] Public "share concept" mode (strip PII)
- [ ] Support for Apple Music / YouTube Music via adapters
- [ ] Batch mode: upload multiple .txt files at once

## License

MIT — build whatever you want with it. Just don't sell the exact prompt as a service without credit.

## Credits

Built as a first-principles collaboration between human operator and Grok (xAI). The goal is maximum leverage from existing frontier models with minimal new infrastructure.

If this saves you time or gives you a better soundtrack for your current chapter, star the repo and tell your friends. 

Now go make the movie.