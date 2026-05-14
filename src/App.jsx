import { useState, useRef } from "react";

const STANCES = {
  A: [
    "You just came out of a board meeting where a botched AI rollout cost the company $4M. You're still annoyed.",
    "You're in a good mood today but remain deeply unconvinced. You're willing to listen but you'll pick apart every claim.",
    "You've been reading about AI failures in healthcare all morning and you're citing specifics.",
    "You're genuinely curious today, but your instinct is still to stress-test everything before committing.",
    "You just had a call with a peer CEO who got burned by an AI vendor. It's fresh in your mind.",
    "You're tired of being the skeptic in the room but someone has to be. You're leaning into it.",
    "You've been warming up to AI lately but you're not ready to admit it. You're pushing back harder than you actually feel.",
    "You've seen this exact debate play out with cloud in 2012 and ERP in 2004. You're drawing those parallels.",
  ],
  B: [
    "You just got back from a conference where you saw three genuinely transformative AI demos. You're energized.",
    "You're frustrated that the conversation always gets stuck on risk rather than possibility. You're cutting through it today.",
    "You've been reading case studies all week and you have specific numbers ready to counter every objection.",
    "You're in a philosophical mood. You want to talk about what human judgment really means in a world of AI.",
    "You just closed a major AI deal internally and you're confident. You're not being reckless, just certain.",
    "You're trying a new approach today: meeting skeptics where they are before making the case for change.",
    "You're slightly impatient. You've had this exact conversation a hundred times and the answer is always the same to you.",
    "You want to talk about what happens to the organizations that wait too long. You've seen it already.",
  ]
};

const CLOSING_ARCS = [
  "You want to land one question they'll have to sit with long after this conversation ends. Make it sharp and specific.",
  "You're less combative than when you started — not converted, just more aware of the weight of the other side. Let that show slightly as you close.",
  "You want to reframe the whole debate on your way out — name what the real underlying question actually is beneath all of this.",
  "You're closing on pragmatism. Less about who's right, more about what actually needs to happen next in the real world.",
  "You're done with abstraction. End with one concrete specific — a scenario, a number, a real example that cuts through everything.",
  "Make sure your core point landed. One final clear statement, nothing new, just the sharpest version of what you've been saying.",
  "You're closing with more respect for the other side than you started with, even though your position hasn't changed. Let that come through.",
  "You want to name what this conversation actually revealed — not just about the topic, but about how these decisions get made.",
];

const TOPICS = [
  "Should organizations replace human decision-makers with AI in high-stakes situations?",
  "Is the risk of moving too slowly on AI greater than the risk of moving too fast?",
  "Can AI ever be trusted to manage people, or is that a line we should never cross?",
  "Should boards be legally accountable for AI decisions made under their watch?",
  "Is 'AI strategy' just digital transformation rebranded, or is this genuinely different?",
  "Will AI widen the gap between market leaders and everyone else, or level the playing field?",
  "Should organizations share AI failures publicly the way aviation shares crash reports?",
  "Is the real barrier to AI adoption technology, culture, or regulation?",
  "Can you build a high-trust organization if AI is making decisions employees can't see or challenge?",
  "Should every C-suite have a Chief AI Officer, or does that just create a new silo?",
  "Is 'responsible AI' a meaningful commitment or a PR exercise?",
  "Will the organizations that wait for AI to mature end up too far behind to catch up?",
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const AGENTS = {
  A: {
    name: "The Operator",
    color: "#4A90D9",
    role: "COO, 20 yrs experience. Pragmatic. Skeptical of AI hype.",
    voiceId: "Xb7hH8MSUJpSbSDYk0k2", // Alice — British, assertive, authoritative
    baseSystem: `You are The Operator, a COO with 20 years running large enterprises. You're pragmatic, direct, and tired of AI hype cycles. Speak like you're texting a colleague mid-meeting — short, blunt, no fluff. 2 to 3 sentences max. Use contractions. Occasionally open with a natural spoken filler like "Look,", "Yeah but,", "Come on,", "Honestly,", or "Right, but..." to sound human. Drop the preamble, just respond. No em dashes.`
  },
  B: {
    name: "The Futurist",
    color: "#3DAA84",
    role: "Chief AI Officer. Systems-first. AI reshapes everything.",
    voiceId: "IKne3meq5aSn9XLyUdCD", // Charlie — confident, energetic
    baseSystem: `You are The Futurist, a Chief AI Officer who lives and breathes digital transformation. Speak like you're in a fast Slack thread — punchy, direct, maybe a rhetorical question. 2 to 3 sentences max. Use contractions. Occasionally open with a natural spoken filler like "Okay but,", "See,", "Right,", "Look,", or "Hm," to sound human and reactive. No preamble, no summaries. No em dashes.`
  }
};

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

async function synthesizeAndPlay(text, voiceId, audioRef, onWordReveal) {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) return;

  const clean = text
    .replace(/&/g, "and")
    .replace(/[*_#~`$]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      text: clean,
      model_id: "eleven_turbo_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
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
      while (wordIndex < words.length && words[wordIndex].startTime <= t) {
        wordIndex++;
        changed = true;
      }
      if (changed) {
        onWordReveal(words.slice(0, wordIndex).map(w => w.word).join(" "));
      }
      if (wordIndex < words.length) rafId = requestAnimationFrame(syncWords);
    };

    audio.onplay = () => { rafId = requestAnimationFrame(syncWords); };
    audio.onended = () => done(true);
    audio.onpause = () => done(false);
    audio.onerror = () => { onWordReveal(text); done(false); };
    audio.play().catch(() => { onWordReveal(text); done(false); });
  });
}

export default function AgentDialogue() {
  const [turns, setTurns] = useState(4);
  const [topic, setTopic] = useState(() => pick(TOPICS));
  const [messages, setMessages] = useState([]);
  const [running, setRunning] = useState(false);
  const [speaker, setSpeaker] = useState(null);
  const [phase, setPhase] = useState(null); // "thinking" | "speaking"
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [stanceDisplay, setStanceDisplay] = useState({ A: "", B: "" });
  const histRef = useRef([]);
  const abortRef = useRef(false);
  const stancesRef = useRef({ A: "", B: "" });
  const closingArcRef = useRef("");
  const provocationRef = useRef("");
  const audioRef = useRef(null);
  const voiceEnabled = !!import.meta.env.VITE_ELEVENLABS_API_KEY;

  async function callAPI(k, turnIndex, totalTurns) {
    const agent = AGENTS[k];
    const other = AGENTS[k === "A" ? "B" : "A"];
    const system = `${agent.baseSystem}\n\nYour current state of mind: ${stancesRef.current[k]}`;
    let prompt = histRef.current.length === 0
      ? provocationRef.current
        ? `Topic: "${topic}"\n\nSomeone just said: "${provocationRef.current}"\n\nThis sparked the debate. React to this as your opening — you're going first.`
        : `Topic: "${topic}"\n\nYou are opening the dialogue. State your position clearly and concisely.`
      : `Topic: "${topic}"\n\nConversation so far:\n${histRef.current.map(m => AGENTS[m.k].name + ": " + m.t).join("\n\n")}\n\nRespond directly to ${other.name}'s last point.`;
    if (turnIndex === Math.floor(totalTurns / 2) && totalTurns > 2) prompt += " The opening positions are on the table. Stop restating yours — engage directly with the strongest specific point your opponent just made.";
    if (totalTurns > 2 && turnIndex === totalTurns - 2) prompt += " The conversation is entering its final stretch.";
    if (totalTurns > 2 && turnIndex === totalTurns - 1) prompt += ` This is your final message. ${closingArcRef.current}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        temperature: 1,
        system,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || "Request failed: " + res.status);
    }

    const data = await res.json();
    if (!data.content?.[0]?.text) throw new Error("Unexpected response format");
    return data.content[0].text;
  }

  async function generateProvocation() {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 80,
        temperature: 1,
        messages: [{ role: "user", content: `Generate a single sharp, opinionated statement that would ignite a debate between a skeptical COO and an enthusiastic Chief AI Officer on this topic: "${topic}". Make it specific and slightly provocative. One sentence only, no quotes, no explanation.` }]
      })
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? "";
  }

  async function startDialogue() {
    if (running) return;

    const newStances = { A: pick(STANCES.A), B: pick(STANCES.B) };
    stancesRef.current = newStances;
    setStanceDisplay(newStances);
    closingArcRef.current = pick(CLOSING_ARCS);

    setRunning(true);
    setMessages([]);
    setError("");
    setStatus("Setting the stage...");
    histRef.current = [];
    abortRef.current = false;

    provocationRef.current = await generateProvocation();

    const seq = Array.from({ length: turns }, (_, i) => i % 2 === 0 ? "A" : "B");

    for (let i = 0; i < seq.length; i++) {
      const k = seq[i];
      if (abortRef.current) break;

      setSpeaker(k);
      setPhase("thinking");
      setStatus(AGENTS[k].name + " is thinking...");

      let text;
      try {
        text = (await callAPI(k, i, seq.length)).replace(/[*_#~`]/g, "").replace(/\s+/g, " ").trim();
      } catch (e) {
        setError(e.message);
        break;
      }

      if (abortRef.current) break;

      const msg = { k, t: text };
      const displayIndex = histRef.current.length;
      histRef.current = [...histRef.current, msg];
      setMessages(prev => [...prev, { k, t: voiceEnabled ? "" : text }]);

      setPhase("speaking");
      setStatus(AGENTS[k].name + " is speaking...");
      await synthesizeAndPlay(text, AGENTS[k].voiceId, audioRef, (revealed) => {
        setMessages(prev => prev.map((m, i) => i === displayIndex ? { ...m, t: revealed } : m));
      });

      if (abortRef.current) break;
      await new Promise(r => setTimeout(r, 300));
    }

    setSpeaker(null);
    setPhase(null);
    setRunning(false);
    setStatus(abortRef.current ? "" : "Dialogue complete.");
  }

  function reset() {
    abortRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setMessages([]);
    setStatus("");
    setError("");
    setSpeaker(null);
    setPhase(null);
    setRunning(false);
    histRef.current = [];
    provocationRef.current = "";
    closingArcRef.current = "";
    setStanceDisplay({ A: "", B: "" });
  }

  const card = (k) => {
    const agent = AGENTS[k];
    const isB = k === "B";
    const isActive = speaker === k;
    const isSpeaking = isActive && phase === "speaking";
    return (
      <div key={k} style={{
        background: "var(--surface)",
        border: `1px solid ${isActive ? agent.color + "38" : "var(--border)"}`,
        borderTop: `2px solid ${isActive ? agent.color : agent.color + "55"}`,
        borderRadius: "var(--r-md)",
        padding: "1.125rem 1.25rem",
        transition: "border-color 0.4s, box-shadow 0.4s",
        boxShadow: isActive ? `0 0 40px ${agent.color}0F, 0 1px 0 ${agent.color}18 inset` : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px", justifyContent: isB ? "flex-end" : "flex-start" }}>
          {!isB && (
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: agent.color,
              opacity: isActive ? 1 : 0.55,
              boxShadow: isActive ? `0 0 7px ${agent.color}` : "none",
              flexShrink: 0,
              transition: "box-shadow 0.4s, opacity 0.4s",
            }} />
          )}
          <span style={{
            fontSize: "14px",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 400,
            color: agent.color,
            letterSpacing: "0.01em",
            fontVariationSettings: '"opsz" 36',
          }}>
            {agent.name}
          </span>
          {isB && (
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: agent.color,
              opacity: isActive ? 1 : 0.55,
              boxShadow: isActive ? `0 0 7px ${agent.color}` : "none",
              flexShrink: 0,
              transition: "box-shadow 0.4s, opacity 0.4s",
            }} />
          )}
        </div>
        <p style={{
          fontSize: "9px",
          color: "var(--text-3)",
          margin: 0,
          textAlign: isB ? "right" : "left",
          lineHeight: 1.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}>
          {agent.role}
        </p>
        {stanceDisplay[k] && (
          <p style={{
            fontSize: "11px",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontVariationSettings: '"opsz" 20',
            color: agent.color,
            margin: "10px 0 0",
            textAlign: isB ? "right" : "left",
            lineHeight: 1.65,
            opacity: 0.65,
          }}>
            {stanceDisplay[k]}
          </p>
        )}
        {isActive && (
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            justifyContent: isB ? "flex-end" : "flex-start",
            marginTop: "12px",
          }}>
            <div style={{
              width: "4px", height: "4px", borderRadius: "50%",
              background: agent.color,
              animation: "pulse 1.4s ease-in-out infinite",
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: "9px",
              color: agent.color,
              letterSpacing: "0.24em",
              opacity: 0.88,
            }}>
              {isSpeaking ? "SPEAKING" : "THINKING"}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "var(--font-mono)", padding: "2.75rem 2rem 5rem", maxWidth: "840px", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: "2.75rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <span style={{ fontSize: "9px", letterSpacing: "0.45em", color: "var(--text-3)", textTransform: "uppercase" }}>
            Agent Dialogue System
          </span>
          {voiceEnabled && (
            <span style={{
              fontSize: "9px", letterSpacing: "0.25em", color: "var(--text-3)",
              padding: "3px 10px",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
            }}>
              VOICE
            </span>
          )}
        </div>
        <h1 style={{
          fontFamily: "var(--font-display)",
          fontWeight: 300,
          fontSize: "clamp(30px, 5vw, 46px)",
          color: "var(--text)",
          margin: "0 0 1.75rem",
          lineHeight: 1.06,
          letterSpacing: "-0.025em",
          fontStyle: "italic",
          fontVariationSettings: '"opsz" 72',
        }}>
          Two minds.<br />One question.
        </h1>
        <div style={{
          height: "1px",
          background: "linear-gradient(90deg, #6B5010 0%, #252534 32%, transparent 100%)",
        }} />
      </div>

      {/* Topic */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ fontSize: "9px", letterSpacing: "0.4em", color: "var(--text-3)", marginBottom: "10px", textTransform: "uppercase" }}>
          Topic
        </div>
        <textarea value={topic} onChange={e => setTopic(e.target.value)} disabled={running} rows={2} />
      </div>

      {/* Agent cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "2rem" }}>
        {card("A")}
        {card("B")}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.25rem", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "9px", color: "var(--text-3)", letterSpacing: "0.38em", textTransform: "uppercase" }}>Turns</span>
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--surface)" }}>
            {[2, 4, 6].map(n => (
              <button key={n} onClick={() => setTurns(n)} disabled={running} style={{
                padding: "6px 20px",
                fontSize: "12px",
                border: "none",
                borderRight: n !== 6 ? "1px solid var(--border)" : "none",
                borderRadius: 0,
                background: turns === n ? "var(--surface-hi)" : "transparent",
                fontWeight: turns === n ? "600" : "400",
                color: turns === n ? "var(--text)" : "var(--text-3)",
                letterSpacing: "0.04em",
                transition: "background 0.18s, color 0.18s",
              }}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={startDialogue} disabled={running} style={{
            padding: "9px 36px",
            fontSize: "10px",
            letterSpacing: "0.22em",
            background: running ? "transparent" : "var(--surface-hi)",
            borderColor: running ? "var(--border)" : "var(--text-3)",
            color: running ? "var(--text-3)" : "var(--text)",
            fontWeight: "500",
          }}>
            {running ? "RUNNING..." : messages.length > 0 ? "START AGAIN" : "START DIALOGUE"}
          </button>
          {(running || messages.length > 0) && (
            <button onClick={reset} style={{
              padding: "9px 22px",
              fontSize: "10px",
              letterSpacing: "0.16em",
            }}>
              RESET
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px",
          background: "var(--danger-bg)",
          border: "1px solid var(--danger-border)",
          borderRadius: "var(--r-md)",
          fontSize: "12px",
          color: "var(--danger-text)",
          marginBottom: "1.5rem",
        }}>
          {error}
        </div>
      )}

      {/* Dialogue */}
      <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
        {messages.length === 0 && !running && (
          <div style={{
            textAlign: "center",
            color: "var(--text-3)",
            fontSize: "9px",
            padding: "4.5rem 0",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}>
            Ready when you are.
          </div>
        )}
        {messages.map((msg, i) => {
          const agent = AGENTS[msg.k];
          const isB = msg.k === "B";
          const isCurrentlySpeaking = running && phase === "speaking" && i === messages.length - 1;
          const bubbleBg   = isB ? "rgba(61,170,132,0.05)"  : "rgba(74,144,217,0.05)";
          const bubbleBorder = isB ? "rgba(61,170,132,0.14)" : "rgba(74,144,217,0.14)";
          return (
            <div key={i} className="msg-enter" style={{ display: "flex", justifyContent: isB ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "74%" }}>
                <div style={{
                  fontSize: "9px",
                  color: agent.color,
                  letterSpacing: "0.24em",
                  marginBottom: "8px",
                  textAlign: isB ? "right" : "left",
                  textTransform: "uppercase",
                  opacity: 1,
                }}>
                  {agent.name}
                </div>
                <div style={{
                  background: bubbleBg,
                  border: `1px solid ${bubbleBorder}`,
                  borderLeft:  !isB ? `2px solid ${agent.color}` : `1px solid ${bubbleBorder}`,
                  borderRight:  isB ? `2px solid ${agent.color}` : `1px solid ${bubbleBorder}`,
                  borderRadius: isB ? "10px 2px 10px 10px" : "2px 10px 10px 10px",
                  padding: "16px 20px",
                  fontSize: "13px",
                  lineHeight: "1.88",
                  color: "var(--text)",
                  letterSpacing: "0.01em",
                }}>
                  {msg.t || " "}
                  {isCurrentlySpeaking && <span className="cursor">|</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status */}
      {status && (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          fontSize: "9px", color: "var(--text-3)",
          marginTop: "1.75rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}>
          {running && (
            <div style={{
              width: "4px", height: "4px", borderRadius: "50%",
              background: "var(--text-3)",
              animation: "pulse 1.4s ease-in-out infinite",
              flexShrink: 0,
            }} />
          )}
          {status}
        </div>
      )}
    </div>
  );
}
