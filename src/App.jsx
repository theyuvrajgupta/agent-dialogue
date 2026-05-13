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

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const AGENTS = {
  A: {
    name: "The Operator",
    color: "#185FA5",
    role: "COO, 20 yrs experience. Pragmatic. Skeptical of AI hype.",
    voiceId: "Xb7hH8MSUJpSbSDYk0k2", // Alice — British, assertive, authoritative
    baseSystem: `You are The Operator, a COO with 20 years running large enterprises. You're pragmatic, direct, and tired of AI hype cycles. Speak like you're texting a colleague mid-meeting — short, blunt, no fluff. 2 to 3 sentences max. Use contractions. Occasionally open with a natural spoken filler like "Look,", "Yeah but,", "Come on,", "Honestly,", or "Right, but..." to sound human. Drop the preamble, just respond. No em dashes.`
  },
  B: {
    name: "The Futurist",
    color: "#0F6E56",
    role: "Chief AI Officer. Systems-first. AI reshapes everything.",
    voiceId: "IKne3meq5aSn9XLyUdCD", // Charlie — confident, energetic
    baseSystem: `You are The Futurist, a Chief AI Officer who lives and breathes digital transformation. Speak like you're in a fast Slack thread — punchy, direct, maybe a rhetorical question. 2 to 3 sentences max. Use contractions. Occasionally open with a natural spoken filler like "Okay but,", "See,", "Right,", "Look,", or "Hm," to sound human and reactive. No preamble, no summaries. No em dashes.`
  }
};

async function synthesizeAndPlay(text, voiceId, audioRef) {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) return;

  const clean = text
    .replace(/&/g, "and")
    .replace(/[*_#~`$]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    },
    body: JSON.stringify({
      text: clean,
      model_id: "eleven_turbo_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });

  if (!res.ok) return; // silent fallback

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audioRef.current = audio;

  await new Promise((resolve) => {
    audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(); };
    audio.play().catch(() => resolve()); // autoplay blocked — resolve silently
  });
}

export default function AgentDialogue() {
  const [turns, setTurns] = useState(4);
  const [topic, setTopic] = useState("Should organizations replace human decision-makers with AI in high-stakes situations?");
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
    if (turnIndex === totalTurns - 1) prompt += " This is your final message in this conversation. End naturally in your own voice.";

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
        text = await callAPI(k, i, seq.length);
      } catch (e) {
        setError(e.message);
        break;
      }

      if (abortRef.current) break;

      const msg = { k, t: text };
      histRef.current = [...histRef.current, msg];
      setMessages(prev => [...prev, msg]);

      setPhase("speaking");
      setStatus(AGENTS[k].name + " is speaking...");
      await synthesizeAndPlay(text, AGENTS[k].voiceId, audioRef);

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
    setStanceDisplay({ A: "", B: "" });
  }

  const card = (k) => {
    const agent = AGENTS[k];
    const isB = k === "B";
    const isActive = speaker === k;
    const isSpeaking = isActive && phase === "speaking";
    return (
      <div key={k} style={{
        background: isActive
          ? `linear-gradient(135deg, var(--color-background-secondary), ${agent.color}10)`
          : "var(--color-background-secondary)",
        border: `0.5px solid ${isActive ? agent.color + "80" : "var(--color-border-tertiary)"}`,
        borderRadius: "var(--border-radius-lg)",
        padding: "1.125rem 1.25rem",
        transition: "border-color 0.3s, background 0.3s, box-shadow 0.3s",
        boxShadow: isActive ? `0 0 28px ${agent.color}18` : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", justifyContent: isB ? "flex-end" : "flex-start" }}>
          {!isB && (
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: agent.color,
              boxShadow: isActive ? `0 0 10px ${agent.color}` : "none",
              flexShrink: 0,
              transition: "box-shadow 0.3s",
            }} />
          )}
          <span style={{ fontSize: "12px", fontWeight: "600", color: agent.color, letterSpacing: "0.05em" }}>{agent.name}</span>
          {isB && (
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: agent.color,
              boxShadow: isActive ? `0 0 10px ${agent.color}` : "none",
              flexShrink: 0,
              transition: "box-shadow 0.3s",
            }} />
          )}
        </div>
        <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", margin: 0, textAlign: isB ? "right" : "left", lineHeight: "1.5" }}>
          {agent.role}
        </p>
        {stanceDisplay[k] && (
          <p style={{ fontSize: "11px", color: agent.color, margin: "8px 0 0", textAlign: isB ? "right" : "left", lineHeight: "1.5", opacity: 0.65, fontStyle: "italic" }}>
            {stanceDisplay[k]}
          </p>
        )}
        {isActive && (
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            justifyContent: isB ? "flex-end" : "flex-start",
            marginTop: "10px",
          }}>
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: agent.color,
              animation: "pulse 1.2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: "10px", color: agent.color, letterSpacing: "0.1em", opacity: 0.8 }}>
              {isSpeaking ? "SPEAKING" : "THINKING"}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "var(--font-mono)", padding: "2rem 1.5rem", maxWidth: "760px", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.35em", color: "var(--color-text-tertiary)", textTransform: "uppercase" }}>
            Agent Dialogue System
          </div>
          {voiceEnabled && (
            <div style={{
              fontSize: "9px", letterSpacing: "0.2em", color: "var(--color-text-tertiary)",
              padding: "3px 8px",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: "var(--border-radius-sm)",
            }}>
              VOICE
            </div>
          )}
        </div>
        <div style={{ fontSize: "22px", fontWeight: "600", color: "var(--color-text-primary)", letterSpacing: "-0.02em", marginBottom: "1.25rem" }}>
          Two minds. One question.
        </div>
        <div style={{ height: "0.5px", background: "var(--color-border-tertiary)" }} />
      </div>

      {/* Topic */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize: "9px", letterSpacing: "0.25em", color: "var(--color-text-tertiary)", marginBottom: "8px", textTransform: "uppercase" }}>Topic</div>
        <textarea value={topic} onChange={e => setTopic(e.target.value)} disabled={running} rows={2} style={{ resize: "none" }} />
      </div>

      {/* Agent cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "1.75rem" }}>
        {card("A")}
        {card("B")}
      </div>

      {/* Turns + controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.75rem", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)", letterSpacing: "0.1em" }}>TURNS</span>
          <div style={{ display: "flex", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", overflow: "hidden" }}>
            {[2, 4, 6].map(n => (
              <button
                key={n}
                onClick={() => setTurns(n)}
                disabled={running}
                style={{
                  padding: "5px 16px",
                  fontSize: "12px",
                  border: "none",
                  borderRight: n !== 6 ? "0.5px solid var(--color-border-tertiary)" : "none",
                  borderRadius: 0,
                  background: turns === n ? "var(--color-background-tertiary)" : "transparent",
                  fontWeight: turns === n ? "600" : "400",
                  color: turns === n ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={startDialogue}
            disabled={running}
            style={{
              padding: "8px 28px",
              fontSize: "11px",
              letterSpacing: "0.12em",
              background: running ? "transparent" : "var(--color-background-tertiary)",
              borderColor: running ? "var(--color-border-tertiary)" : "var(--color-text-tertiary)",
              fontWeight: "500",
            }}
          >
            {running ? "RUNNING..." : messages.length > 0 ? "START AGAIN" : "START DIALOGUE"}
          </button>
          {(running || messages.length > 0) && (
            <button
              onClick={reset}
              style={{ padding: "8px 20px", fontSize: "11px", letterSpacing: "0.1em" }}
            >
              RESET
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "10px 14px",
          background: "var(--color-background-danger)",
          border: "0.5px solid var(--color-border-danger)",
          borderRadius: "var(--border-radius-md)",
          fontSize: "12px",
          color: "var(--color-text-danger)",
          marginBottom: "1.25rem",
        }}>
          {error}
        </div>
      )}

      {/* Dialogue */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {messages.length === 0 && !running && (
          <div style={{
            textAlign: "center",
            color: "var(--color-text-tertiary)",
            fontSize: "12px",
            padding: "3rem 0",
            letterSpacing: "0.05em",
          }}>
            Set your topic and start the dialogue.
          </div>
        )}
        {messages.map((msg, i) => {
          const agent = AGENTS[msg.k];
          const isB = msg.k === "B";
          const bubbleBg = isB
            ? `rgba(15, 110, 86, 0.08)`
            : `rgba(24, 95, 165, 0.08)`;
          const bubbleBorder = isB
            ? `rgba(15, 110, 86, 0.22)`
            : `rgba(24, 95, 165, 0.22)`;
          const bubbleRadius = isB ? "14px 3px 14px 14px" : "3px 14px 14px 14px";
          return (
            <div key={i} style={{ display: "flex", justifyContent: isB ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "72%" }}>
                <div style={{
                  fontSize: "10px",
                  color: agent.color,
                  letterSpacing: "0.12em",
                  marginBottom: "6px",
                  textAlign: isB ? "right" : "left",
                  fontWeight: "600",
                }}>
                  {agent.name}
                </div>
                <div style={{
                  background: bubbleBg,
                  border: `0.5px solid ${bubbleBorder}`,
                  borderLeft: !isB ? `2px solid ${agent.color}` : `0.5px solid ${bubbleBorder}`,
                  borderRight: isB ? `2px solid ${agent.color}` : `0.5px solid ${bubbleBorder}`,
                  borderRadius: bubbleRadius,
                  padding: "14px 18px",
                  fontSize: "13px",
                  lineHeight: "1.75",
                  color: "var(--color-text-primary)",
                }}>
                  {msg.t}
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
          fontSize: "11px", color: "var(--color-text-tertiary)",
          marginTop: "1.5rem",
          letterSpacing: "0.05em",
        }}>
          {running && (
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "var(--color-text-tertiary)",
              animation: "pulse 1.2s ease-in-out infinite",
              flexShrink: 0,
            }} />
          )}
          {status}
        </div>
      )}
    </div>
  );
}
