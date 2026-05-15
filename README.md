# Agent Dialogue

A two-agent AI debate interface powered by Claude. Two personas with opposing viewpoints — **The Operator** (skeptical COO, 20 years experience) and **The Futurist** (Chief AI Officer, systems-first thinker) — argue a topic of your choice in real time, with optional voice narration.

Built to show what real-time AI agent interaction looks like in practice.

## Features

- **Configurable topic and turn count** — type any topic or pick from 12 curated C-suite AI topics loaded at random on every refresh; choose 2, 4, or 6 turns
- **Randomised stances** — each agent draws a "state of mind" from a pool of 8 per run, so the same topic plays out differently every time
- **Provocation** — a separate Claude call generates a sharp one-sentence statement before the debate starts; the first agent responds to that, not just the topic in the abstract
- **Mid-conversation pivot** — at the halfway point, agents are instructed to stop restating their position and engage directly with the opponent's strongest argument
- **Closing arc** — a random closing style (e.g. "land one question they'll sit with", "close on pragmatism") is picked at the start and injected at the last two turns; skipped for 2-turn runs
- **Voice narration** — ElevenLabs TTS with distinct voices per agent; text streams as audio plays; silently skipped if no key is set
- **Topic length guard** — capped at 280 characters with a live counter that turns red at 90%
- **Pre-fetched responses** — next agent's API call runs in parallel with current TTS playback, eliminating dead time between turns; aborted cleanly on reset, unmount, or error via `AbortController`
- **Unmount safety** — async debate loop aborts cleanly on component unmount; audio pauses and is released

## Design

Dark glassmorphism UI with no external component library — plain React with inline styles and CSS custom properties.

- **Glass depth system** — three distinct layers: panel (outermost), agent cards (inside panel), message bubbles; each with white-tinted `rgba(255,255,255,…)` surface, visible border, and inset top-edge refraction highlight
- **Custom easing** — `--ease-out`, `--ease-in-out`, `--ease-drawer`; no default CSS easing functions used anywhere
- **Page load stagger** — six layers animate in over 370ms via `.fade-up-N` classes
- **Message animation** — `translateY(22px)` + opacity over 520ms with `--ease-out`
- **Active speaker** — agent card tints to speaker color (~16% opacity), center divider glows in speaker color, status dot inherits speaker color
- **Generating bubble** — outer glow in agent color while speaking, fades when turn ends
- **`prefers-reduced-motion`** — all animations and transitions disabled

## Stack

- React 19 + Vite (no UI library)
- Anthropic API — `claude`, `max_tokens: 300`, `temperature: 1`; called directly from the browser with `anthropic-dangerous-direct-browser-access: true`
- ElevenLabs TTS (optional) — Alice voice for The Operator, Charlie voice for The Futurist
- Deployed on Vercel

## Project structure

```
agent-dialogue/
├── src/
│   ├── App.jsx          # all app logic and layout
│   ├── api.js           # Anthropic + ElevenLabs API calls
│   ├── constants.js     # agents, stances, closing arcs, topics
│   ├── main.jsx         # React entry point
│   ├── index.css        # design tokens, animations, global elements
│   └── components/
│       └── AgentCard.jsx
├── vercel.json          # SPA routing rewrite
└── test_voices.py       # ElevenLabs voice audition utility
```

## Getting started

```bash
npm install
```

Copy the env file and fill in your keys:

```bash
cp .env.example .env
```

```env
VITE_ANTHROPIC_API_KEY=your-key-here

# Optional — enables voice narration via ElevenLabs TTS
VITE_ELEVENLABS_API_KEY=your-key-here
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deploying to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new) — Vite is auto-detected
2. Add `VITE_ANTHROPIC_API_KEY` under Settings → Environment Variables
3. Optionally add `VITE_ELEVENLABS_API_KEY` to enable voice
4. Deploy — the included `vercel.json` handles SPA routing

## Testing voices

A Python utility is included to audition the ElevenLabs voices locally:

```bash
# from the agent-dialogue directory
pip install elevenlabs
ELEVENLABS_API_KEY=your-key-here python test_voices.py
```

This saves `operator_test.mp3` and `futurist_test.mp3` in the project root (both are gitignored).
