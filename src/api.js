// ── Word-by-word reveal helpers ───────────────────────────────────────────────

function parseWordTimestamps(alignment) {
  const { characters, character_start_times_seconds } = alignment;
  const words = [];
  let word = "";
  let wordStart = null;
  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    if (char === " " || char === "\n") {
      if (word) { words.push({ word, startTime: wordStart }); word = ""; wordStart = null; }
    } else {
      if (!word) wordStart = character_start_times_seconds[i];
      word += char;
    }
  }
  if (word) words.push({ word, startTime: wordStart });
  return words;
}

// ── Voice synthesis ───────────────────────────────────────────────────────────

export async function synthesizeAndPlay(text, voiceId, audioRef, onWordReveal) {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) return;

  const clean = text
    .replace(/&/g, "and")
    .replace(/[*_#~`]/g, "")
    .replace(/\b(\d+)s\b/g, "$1's")
    .replace(/\s+/g, " ")
    .trim();

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      text: clean,
      model_id: "eleven_turbo_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) { onWordReveal(text); return; }

  const data = await res.json();
  const words = parseWordTimestamps(data.alignment);

  const audioBytes = atob(data.audio_base64);
  const buf = new Uint8Array(audioBytes.length);
  for (let i = 0; i < audioBytes.length; i++) buf[i] = audioBytes.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
  const audio = new Audio(url);
  audioRef.current = audio;

  await new Promise((resolve) => {
    let rafId;
    let wordIndex = 0;
    let resolved = false;

    const done = (showFull) => {
      if (resolved) return;
      resolved = true;
      cancelAnimationFrame(rafId);
      if (showFull) onWordReveal(clean);
      URL.revokeObjectURL(url);
      audioRef.current = null;
      resolve();
    };

    const syncWords = () => {
      const t = audio.currentTime;
      let changed = false;
      while (wordIndex < words.length && words[wordIndex].startTime <= t) { wordIndex++; changed = true; }
      if (changed) onWordReveal(words.slice(0, wordIndex).map(w => w.word).join(" "));
      if (wordIndex < words.length) rafId = requestAnimationFrame(syncWords);
    };

    audio.onplay  = () => { rafId = requestAnimationFrame(syncWords); };
    audio.onended = () => done(true);
    audio.onpause = () => done(false);
    audio.onerror = () => { onWordReveal(text); done(false); };
    audio.play().catch(() => { onWordReveal(text); done(false); });
  });
}

// ── Topic-aware stance generation ────────────────────────────────────────────

const FALLBACK_STANCE = "You're entering this debate with sharp, well-formed views and you're not in the mood for weak arguments.";

/**
 * Generates a single emotional context string grounded in both the persona and the topic.
 * Called at dialogue start unless the user has set a manual stanceHint on the persona.
 */
export async function generateStance(persona, topic) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      messages: [{
        role: "user",
        content: `Write a single sentence emotional context for a debate participant — a specific recent experience or mindset that explains why they feel the way they do going into this debate.

Persona: ${persona.name}. ${persona.description}
Topic: "${topic}"

One sentence only. Concrete and character-specific. No quotes, no explanation.`,
      }],
    }),
  });

  if (!res.ok) return FALLBACK_STANCE;
  const data = await res.json();
  return data.content?.[0]?.text?.trim() ?? FALLBACK_STANCE;
}

// ── Dialogue turn generation ──────────────────────────────────────────────────

/**
 * @param {object}  opts
 * @param {Persona} opts.persona       — The speaking agent
 * @param {Persona} opts.otherPersona  — The other agent (for context)
 * @param {string}  opts.stance        — This turn's emotional context string
 * @param {string}  opts.topic
 * @param {Array}   opts.history       — Array of { k, name, t }
 * @param {string}  opts.provocation
 * @param {number}  opts.turnIndex
 * @param {number}  opts.totalTurns
 * @param {string}  opts.closingArc
 * @param {AbortSignal} [opts.signal]
 */
export async function callAPI({ persona, otherPersona, stance, topic, history, provocation, turnIndex, totalTurns, closingArc, escalationArc, signal }) {
  const system = `${persona.toSystemPrompt()}\n\nYour current state of mind: ${stance}`;

  let prompt = history.length === 0
    ? provocation
      ? `Topic: "${topic}"\n\nSomeone just said: "${provocation}"\n\nThis sparked the debate. React to this as your opening — you're going first.`
      : `Topic: "${topic}"\n\nYou are opening the dialogue. State your position clearly and concisely.`
    : `Topic: "${topic}"\n\nConversation so far:\n${history.map(m => `${m.name}: ${m.t}`).join("\n\n")}\n\nRespond directly to ${otherPersona.name}'s last point.`;

  const phase = turnIndex === totalTurns - 1 ? 3 : Math.min(3, Math.floor(turnIndex / totalTurns * 4));
  prompt += ` Emotional temperature: ${escalationArc[phase]}`;

  const concessionTurn = totalTurns >= 4 ? Math.floor(totalTurns * 0.4) : -1;
  if (turnIndex === concessionTurn)
    prompt += " Before making your next point, briefly acknowledge the one specific thing your opponent just said that actually holds up — then pivot hard back to your position.";

  if (turnIndex === Math.floor(totalTurns / 2) && totalTurns > 2)
    prompt += " The opening positions are on the table. Stop restating yours — engage directly with the strongest specific point your opponent just made.";
  if (totalTurns > 2 && turnIndex === totalTurns - 2)
    prompt += " The conversation is entering its final stretch.";
  if (totalTurns > 2 && turnIndex === totalTurns - 1)
    prompt += ` This is your final message. ${closingArc}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 210,
      temperature: 1,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
    signal,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || "Request failed: " + res.status);
  }

  const data = await res.json();
  if (!data.content?.[0]?.text) throw new Error("Unexpected response format");
  return data.content[0].text;
}

// ── ElevenLabs voice catalogue ───────────────────────────────────────────────
// Cached per page load — the /v1/voices endpoint is called at most once.

let _voiceCache = null;

function formatVoiceLabel(v) {
  const gender = v.labels?.gender === "female" ? "F" : v.labels?.gender === "male" ? "M" : null;
  const accent = v.labels?.accent ? v.labels.accent.charAt(0).toUpperCase() + v.labels.accent.slice(1) : null;
  const tags = [gender, accent].filter(Boolean).join(", ");
  return tags ? `${v.name} (${tags})` : v.name;
}

export async function fetchVoices() {
  if (_voiceCache) return _voiceCache;

  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) return [];

  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) return [];

  const data = await res.json();
  _voiceCache = data.voices
    .filter(v => v.category === "premade")
    .map(v => ({ id: v.voice_id, label: formatVoiceLabel(v) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return _voiceCache;
}

// ── Topic utilities ───────────────────────────────────────────────────────────

export async function reframeTopic(topic) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      temperature: 0.5,
      messages: [{
        role: "user",
        content: `The following debate topic is not suitable for a senior executive audience — it may be too personal, too vague, or lack enough context for a meaningful AI debate.

Original: "${topic}"

Rewrite it as a sharp, debatable question on the closest meaningful theme involving AI, leadership, or organizational change. Return only the reframed question — no explanation, no quotes.`,
      }],
    }),
  });
  if (!res.ok) return topic;
  const data = await res.json();
  return data.content?.[0]?.text?.trim() ?? topic;
}

export async function generateProvocation(topic) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 80,
      temperature: 1,
      messages: [{
        role: "user",
        content: `Generate a single sharp, opinionated statement that would ignite a debate between a skeptical COO and an enthusiastic Chief AI Officer on this topic: "${topic}". Make it specific and slightly provocative. One sentence only, no quotes, no explanation.`,
      }],
    }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return data.content?.[0]?.text?.trim() ?? "";
}
