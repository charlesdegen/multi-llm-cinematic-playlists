# Multi-LLM Cinematic Playlists

**Turn every frontier LLM's understanding of you into one killer Spotify soundtrack.**

Paste responses from Claude, GPT, Gemini, Grok, or any other model into this tool. Merge, curate, and ship a real private Spotify playlist in minutes.

## The Core Idea (First Principles)

Every major LLM has a slightly different "read" on your personality, values, current chapter, and aesthetic because of its training, system prompt, and your conversation history with it.

Instead of picking one, we **aggregate the directors' cuts**.

The result is a richer, more truthful "movie of your life right now" soundtrack than any single model could produce.

## How It Works (User Flow)

1. **Copy the universal prompt** (`prompts/universal_movie_soundtrack_prompt.txt`)
2. Paste it into an existing long conversation thread with Claude / ChatGPT / Gemini / Grok (the longer the history, the better the signal).
3. Let the model output the strict JSON.
4. Come back here → paste (or upload) each JSON response.
5. Compare each model's **director's cut** — film title, logline, mood tags, narrative arc — side by side.
6. Review the unified tracklist. Toggle between **Narrative** order (the 4-act arc) and **Consensus** order (tracks multiple models agree on first). Edit, reorder, or delete tracks.
7. Connect Spotify → **preview every match** (album art + confidence score, swap alternates) → create the private playlist.

## The App

The primary app is a thin, fully client-side **Next.js/React** app in [`web/`](web/), designed around Apple's Human Interface Guidelines with a Liquid Glass aesthetic — translucent panels, an SF Pro type ramp, one restrained accent color, light and dark appearance, and reduced-motion/contrast accessibility guards.

Everything runs in your browser:

- **Spotify auth is Authorization Code + PKCE** — no client secret, no server, tokens never leave your browser.
- **Track matching** searches Spotify per track, scores candidates with fuzzy matching, and lets you review/override before anything is created.
- **Sessions persist locally** (and can be exported/restored as JSON). The tracklist also exports to JSON/CSV without connecting Spotify at all.

### Quick Start

```bash
cd web
npm install
npm run dev
```

Then open **http://127.0.0.1:3000**.

### Spotify App Setup (required for playlist creation)

1. Go to https://developer.spotify.com/dashboard and create an app.
2. Add a **Redirect URI**: `http://127.0.0.1:3000/callback` for local dev, or `https://your-domain/callback` when deployed.
3. Copy the **Client ID** into the app's "Ship to Spotify" step (no client secret needed — PKCE).

The tool uses the official Spotify Web API, only creates **private** playlists, and never stores your data anywhere but your own browser.

### Deploy (free)

`npm run build` produces a fully static site in `web/out/` — host it on GitHub Pages, Cloudflare Pages, Vercel, Netlify, or any static file server. Just register `https://<your-host>/callback` as the redirect URI in the Spotify dashboard.

### Tests

```bash
cd web
npm test          # vitest unit tests (parsing, merging, fuzzy matching)
npm run typecheck
```

## Legacy Streamlit App

The original Streamlit implementation lives in [`app/`](app/) and still works for local single-user use:

```bash
cd app
cp .streamlit/secrets.toml.example .streamlit/secrets.toml  # add your Spotify credentials
./start.sh
```

See [CHANGELOG.md](CHANGELOG.md) for its setup details. New features land in `web/`.

## File Structure

```
multi-llm-cinematic-playlists/
├── README.md
├── CHANGELOG.md
├── LICENSE
├── prompts/
│   └── universal_movie_soundtrack_prompt.txt   # The one prompt that works across all frontier models
├── web/                        # Primary app — Next.js/React, client-side only
│   ├── app/                    # Pages (main flow + OAuth callback) and design system CSS
│   ├── components/             # Import, concepts, tracklist, Spotify shipping, toasts
│   ├── lib/                    # Parsing, merging, fuzzy matching, PKCE Spotify client
│   └── lib/__tests__/          # Vitest unit tests
├── app/                        # Legacy Streamlit app (local single-user)
│   ├── app.py
│   ├── requirements.txt
│   ├── start.sh
│   └── .streamlit/
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

- [x] Fuzzy track matching + manual match override
- [x] Export as JSON/CSV for other tools (Playlist Push, Soundiiz, etc.)
- [x] Batch mode: upload multiple files at once
- [x] Consensus ordering (cross-model agreement first)
- [ ] One-click "boost track from all models"
- [ ] Auto-generate playlist cover (via user-provided key)
- [ ] Public "share concept" mode (strip PII)
- [ ] Support for Apple Music / YouTube Music via adapters

## License

MIT — see [LICENSE](LICENSE). Build whatever you want with it. Just don't sell the exact prompt as a service without credit.

## Credits

Built as a first-principles collaboration between human operator and frontier models. The goal is maximum leverage from existing frontier models with minimal new infrastructure.

If this saves you time or gives you a better soundtrack for your current chapter, star the repo and tell your friends.

Now go make the movie.
