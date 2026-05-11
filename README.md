# Agent Dialogue

A two-agent AI debate interface powered by Claude. Two personas with opposing viewpoints — The Operator (skeptic COO) and The Futurist (enthusiast CAIO) — argue a topic of your choice in real time.

## Features

- Configurable debate topic and number of turns
- Randomised emotional stances per run for varied output
- Light/dark mode via CSS design tokens
- Proxied Anthropic API calls to avoid CORS issues

## Getting started

```bash
npm install
```

Copy the env file and add your Anthropic API key:

```bash
cp .env.example .env
```

```env
VITE_ANTHROPIC_API_KEY=your-key-here
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

## Stack

- React 19 + Vite
- Anthropic API (`claude-sonnet-4-20250514`)
- No UI library — plain inline styles with CSS custom properties
