# Agent Dialogue

A two-agent AI debate interface powered by Claude. Two personas with opposing viewpoints — The Operator (skeptic COO) and The Futurist (enthusiast CAIO) — argue a topic of your choice in real time.

## Features

- Configurable debate topic and number of turns
- Randomised emotional stances per run for varied output
- Optional voice narration via ElevenLabs — each agent has a distinct voice; silently skipped if no key is set
- Light/dark mode via CSS design tokens
- Direct Anthropic API calls from the browser

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
3. Deploy — the included `vercel.json` handles SPA routing

## Testing voices

A Python utility is included to audition the ElevenLabs voices locally before running the app:

```bash
# from the agent-dialogue directory
pip install elevenlabs
ELEVENLABS_API_KEY=your-key-here python test_voices.py
```

This saves `operator_test.mp3` and `futurist_test.mp3` in the project root (both are gitignored).

## Stack

- React 19 + Vite
- Anthropic API (`claude-sonnet-4-20250514`)
- ElevenLabs TTS (optional) — Alice voice for The Operator, Charlie voice for The Futurist
- No UI library — plain inline styles with CSS custom properties
