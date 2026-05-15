import { AGENTS } from "./constants.js";

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

export async function callAPI({ agentKey, stances, topic, history, provocation, turnIndex, totalTurns, closingArc, signal }) {
  const agent = AGENTS[agentKey];
  const other = AGENTS[agentKey === "A" ? "B" : "A"];
  const system = `${agent.baseSystem}\n\nYour current state of mind: ${stances[agentKey]}`;

  let prompt = history.length === 0
    ? provocation
      ? `Topic: "${topic}"\n\nSomeone just said: "${provocation}"\n\nThis sparked the debate. React to this as your opening — you're going first.`
      : `Topic: "${topic}"\n\nYou are opening the dialogue. State your position clearly and concisely.`
    : `Topic: "${topic}"\n\nConversation so far:\n${history.map(m => AGENTS[m.k].name + ": " + m.t).join("\n\n")}\n\nRespond directly to ${other.name}'s last point.`;

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
      max_tokens: 300,
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
