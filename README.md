# Agent Dialogue

Two AI personas argue a topic of your choice — live, in real time, in your browser.

**The Operator** (skeptical COO, 20 years experience) vs **The Futurist** (Chief AI Officer, systems-first thinker). Both personas are fully editable. Built to show what real-time AI agent interaction looks like in practice.

---

## How the debate works

Each run is unique. Before the first word is spoken, Claude sets the stage:

- generates a **sharp provocation** to spark the opening (agents respond to this, not the raw topic)
- gives each agent a **dynamic stance** — a single-sentence state of mind tied to the specific topic
- picks a **closing arc** — one of 8 styles that shape how agents land their final turn

During the debate:

| Turn | What happens |
|------|-------------|
| ~40% | **Forced concession** — the speaking agent briefly grants one thing the opponent said before pivoting back |
| 50% | **Mid-pivot** — agents stop restating their position and engage with the opponent's strongest argument |
| Final | **Closing arc** injected — shapes the tone of the last message |

An **escalation arc** (one of 4 temperature curves, e.g. calm-to-forceful or skeptical-to-exasperated) drives emotional build-up across all turns. Both the escalation arc and forced concession are skipped for 2-turn runs.

---

## Interface

Dark glassmorphism UI — no component library, plain React with inline styles and CSS custom properties.

- **Configurable personas** — edit name, description, accent color, and voice per agent before running
- **Topic input** — type anything or shuffle from 12 curated C-suite AI topics; capped at 280 characters
- **Turn selector** — 2, 4, 6, or 8 turns
- **Voice narration** — ElevenLabs TTS, word-by-word reveal synced to audio; silently skipped if no key is set
- **Pre-fetched responses** — next agent's API call runs in parallel with TTS playback, no dead time between turns

---

## Stack

| Layer | Detail |
|-------|--------|
| Frontend | React 19 + Vite, no UI library |
| AI — dialogue | Sonnet `claude-sonnet` · `max_tokens: 210` · `temperature: 1` |
| AI — stances | Haiku `claude-haiku` · `max_tokens: 60` |
| Voice | ElevenLabs TTS (optional) · voice list fetched live from API |
| Hosting | Vercel |

The Anthropic API is called directly from the browser (`anthropic-dangerous-direct-browser-access: true`).

---

## Project structure

```
src/
├── App.jsx                  # main app logic and UI
├── api.js                   # Anthropic + ElevenLabs API calls
├── constants.js             # personas, topic pool, arc pools
├── index.css                # design tokens, animations
├── models/
│   └── Persona.js           # Persona class with toSystemPrompt()
└── components/
    ├── AgentCard.jsx         # per-agent display card
    └── PersonaBuilder.jsx    # in-place persona editor
```

---

## Getting started

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```env
VITE_ANTHROPIC_API_KEY=your-key-here
VITE_ELEVENLABS_API_KEY=your-key-here   # optional — enables voice
```

```bash
npm run dev
# → http://localhost:5173
```

---

## Deploying to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new) — Vite is auto-detected
2. Add `VITE_ANTHROPIC_API_KEY` under Settings → Environment Variables
3. Optionally add `VITE_ELEVENLABS_API_KEY` to enable voice
4. Deploy — `vercel.json` handles SPA routing

---

## Testing voices

```bash
pip install elevenlabs
ELEVENLABS_API_KEY=your-key-here python test_voices.py
# saves operator_test.mp3 and futurist_test.mp3
```
