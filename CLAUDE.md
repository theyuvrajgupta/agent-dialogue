# Agent Dialogue — Project Context

## What this is
A two-agent AI debate interface built with React + Vite. Two AI personas with opposing viewpoints debate a user-defined topic in real time, with optional voice narration via ElevenLabs.

## Stack
- React 19 + Vite (no UI library — plain inline styles + CSS custom properties)
- Anthropic API called directly from the browser (`anthropic-dangerous-direct-browser-access: true`)
- ElevenLabs TTS (optional — silently skipped if `VITE_ELEVENLABS_API_KEY` is not set)
- Deployed on Vercel

## Project structure
- `agent-dialogue/src/App.jsx` — main app logic and UI
- `agent-dialogue/src/api.js` — all Claude and ElevenLabs API calls
- `agent-dialogue/src/constants.js` — personas, topic pool, arc pools
- `agent-dialogue/src/models/Persona.js` — Persona class with `toSystemPrompt()`
- `agent-dialogue/src/components/AgentCard.jsx` — per-agent display card
- `agent-dialogue/src/components/PersonaBuilder.jsx` — in-place persona editor
- `agent-dialogue/src/index.css` — CSS tokens and global styles
- `agent-dialogue/vercel.json` — rewrites all routes to `/` for SPA routing

## The two agents (defaults — both are user-editable)
- **The Operator** — COO, 20 yrs experience, pragmatic, skeptical of AI hype. Voice: Alice (ElevenLabs `Xb7hH8MSUJpSbSDYk0k2`)
- **The Futurist** — Chief AI Officer, systems-first, believes AI reshapes everything. Voice: Charlie (ElevenLabs `IKne3meq5aSn9XLyUdCD`)
- Users can edit name, description, accent color, and voice per agent before running

## How the dialogue works (key design decisions)
1. **Stances** — at dialogue start, Claude Haiku generates a single-sentence topic-aware "state of mind" per persona; injected into the system prompt for every turn
2. **Provocation** — a separate Claude call generates a sharp one-sentence statement to spark the opening; the first agent responds to that, not the abstract topic
3. **Escalation arc** — one of 4 temperature curves picked per run (e.g. calm-to-forceful, skeptical-to-exasperated); a per-turn phase signal is injected into the prompt based on position in the conversation; skipped for 2-turn runs
4. **Forced concession** — at ~40% through the debate, the speaking agent is prompted to briefly acknowledge one specific thing the opponent said before pivoting back; skipped for runs under 4 turns
5. **Mid-conversation pivot** — at the halfway point, agents are instructed to stop restating their position and engage with the opponent's strongest point specifically
6. **Closing arc** — a random closing style (e.g. "land one question they'll sit with", "close on pragmatism") picked at run start, injected at last 2 turns; skipped for 2-turn runs
7. **Randomized default topic** — picked from a pool of 12 curated C-suite AI topics on every load/refresh
8. **Voice sequencing** — the loop awaits audio playback before calling the next agent, so it feels like a real back-and-forth

## Env vars
```
VITE_ANTHROPIC_API_KEY=   # required
VITE_ELEVENLABS_API_KEY=  # optional, enables voice
```

## Models
- **Sonnet** (`claude-sonnet-4-6`) — dialogue turns, provocation, topic reframe; `max_tokens: 210`, `temperature: 1`
- **Haiku** (`claude-haiku-4-5-20251001`) — stance generation only; `max_tokens: 60`

## Turn options
2 / 4 / 6 / 8 turns (user-selectable). Narrative mechanics (escalation arc, forced concession, mid-pivot, closing arc) are skipped or adjusted for 2-turn runs.

## What has been built (commit history summary)
- Initial scaffold: agents, stances, debate loop, dark UI
- Naturalness: 2-3 sentence responses, final turn signal, thinking/speaking phase states
- Voice: ElevenLabs TTS, per-agent voices, special char stripping, audio sequencing
- Provocation: auto-generated opening spark via separate Claude call
- Mid-pivot: halfway prompt injection to force genuine engagement
- Closing arc: randomized closing style pool (8 options), injected at last 2 turns, skipped for 2-turn runs
- Randomized topic: 12 curated C-suite AI topics, one picked randomly on every load
- Pre-fetch: next agent's API call runs in parallel with TTS playback
- Persona system: Persona model class, PersonaBuilder UI, dynamic stance generation via Haiku
- Escalation arc: per-turn emotional temperature curve, 4 pools, skipped for 2-turn runs
- Forced concession: acknowledgment prompt at ~40% through, skipped under 4 turns
- Turn options expanded to 2/4/6/8; max_tokens tightened to 210
