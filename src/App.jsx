import { useState, useRef } from "react";
import { AGENTS, STANCES, CLOSING_ARCS, TOPICS, pick } from "./constants.js";
import { synthesizeAndPlay, callAPI, generateProvocation } from "./api.js";
import AgentCard from "./components/AgentCard.jsx";

export default function AgentDialogue() {
  const [turns, setTurns] = useState(4);
  const [topic, setTopic] = useState(() => pick(TOPICS));
  const [messages, setMessages] = useState([]);
  const [running, setRunning] = useState(false);
  const [speaker, setSpeaker] = useState(null);
  const [phase, setPhase] = useState(null);
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

    provocationRef.current = await generateProvocation(topic);

    const seq = Array.from({ length: turns }, (_, i) => i % 2 === 0 ? "A" : "B");

    for (let i = 0; i < seq.length; i++) {
      const k = seq[i];
      if (abortRef.current) break;

      setSpeaker(k);
      setPhase("thinking");
      setStatus(AGENTS[k].name + " is thinking...");

      let text;
      try {
        text = (await callAPI({
          agentKey: k,
          stances: stancesRef.current,
          topic,
          history: histRef.current,
          provocation: provocationRef.current,
          turnIndex: i,
          totalTurns: seq.length,
          closingArc: closingArcRef.current,
        })).replace(/[*_#~`]/g, "").replace(/\s+/g, " ").trim();
      } catch (e) {
        setError(e.message);
        break;
      }

      if (abortRef.current) break;

      const displayIndex = histRef.current.length;
      histRef.current = [...histRef.current, { k, t: text }];
      setMessages(prev => [...prev, { k, t: voiceEnabled ? "" : text }]);

      setPhase("speaking");
      setStatus(AGENTS[k].name + " is speaking...");
      await synthesizeAndPlay(text, AGENTS[k].voiceId, audioRef, (revealed) => {
        setMessages(prev => prev.map((m, idx) => idx === displayIndex ? { ...m, t: revealed } : m));
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
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
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
        <AgentCard agent={AGENTS.A} agentKey="A" isActive={speaker === "A"} phase={phase} stance={stanceDisplay.A} />
        <AgentCard agent={AGENTS.B} agentKey="B" isActive={speaker === "B"} phase={phase} stance={stanceDisplay.B} />
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
            <button onClick={reset} style={{ padding: "9px 22px", fontSize: "10px", letterSpacing: "0.16em" }}>
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
          const bubbleBg     = isB ? "rgba(61,170,132,0.05)"  : "rgba(74,144,217,0.05)";
          const bubbleBorder = isB ? "rgba(61,170,132,0.14)"  : "rgba(74,144,217,0.14)";
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
                  {msg.t || " "}
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
